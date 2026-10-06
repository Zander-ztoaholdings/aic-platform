/**
 * Personio, read with API credentials (OAuth client credentials at /v2/auth/token) through the v2 persons and employments endpoints.
 * Docs: https://developer.personio.de/reference/get_v2-persons
 */
import { call, need, clientCredentials } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials, type PersonRecord } from '../types';
import { isoDate, lowerEmail, textOf, peopleListCheck } from '../hr';

const API = 'https://api.personio.de/v2';

type Person = { id: string | number; first_name?: string; last_name?: string; preferred_name?: string; email?: string; status?: string };
type Employment = Record<string, unknown>;
type Page<T> = { _data?: T[]; data?: T[]; _meta?: { links?: { next?: { href?: string } | string } }; next_cursor?: string | null };

const items = <T>(p: Page<T>): T[] => p._data ?? p.data ?? [];

/** The next page's URL, from `_meta.links.next.href` or a bare `next_cursor`. */
function nextUrl<T>(p: Page<T>, current: string): string | null {
  const link = p._meta?.links?.next;
  const href = typeof link === 'string' ? link : link?.href;
  if (href) return new URL(href, API).toString();
  if (p.next_cursor) { const u = new URL(current); u.searchParams.set('cursor', p.next_cursor); return u.toString(); }
  return null;
}

// Unverified: the employment date field names. The v2 reference names start_date and termination_date;
// hire_date and end_date are tried as fallbacks. Confirm against a live account.
const startOf = (e: Employment) => isoDate(e.start_date ?? e.hire_date);
const endOf = (e: Employment) => isoDate(e.termination_date ?? e.end_date);

/** The most recent employment: latest start date, falling back to list order. */
function latest(list: Employment[]): Employment | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => (startOf(b) ?? '').localeCompare(startOf(a) ?? ''))[0];
}

async function load(c: Credentials): Promise<{ people: PersonRecord[]; inactiveNoDate: number }> {
  const token = await clientCredentials(`${API}/auth/token`, need(c, 'clientId', 'The client id'), need(c, 'clientSecret', 'The client secret'));
  const get = <T>(url: string) => call<T>(url, { headers: { Authorization: `Bearer ${token}` } });

  const persons: Person[] = [];
  let next: string | null = `${API}/persons?limit=50`;
  for (let i = 0; next && i < 40; i++) {
    const page: Page<Person> = await get<Page<Person>>(next);
    persons.push(...items(page));
    next = nextUrl(page, next);
  }

  // One call per person for dates, capped so a large company does not take minutes.
  let employmentsReadable = true;
  const people: PersonRecord[] = [];
  let inactiveNoDate = 0;
  for (const [i, p] of persons.entries()) {
    let emp: Employment | null = null;
    if (employmentsReadable && i < 300) {
      try {
        emp = latest(items(await get<Page<Employment>>(`${API}/persons/${encodeURIComponent(String(p.id))}/employments`)));
      } catch (e) {
        if (e instanceof ConnectorError && (e.status === 403 || e.status === 404)) employmentsReadable = false;
        else throw e;
      }
    }
    const name = [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || String(p.id);
    const position = emp?.position as Record<string, unknown> | undefined;
    const person: PersonRecord = {
      externalId: String(p.id),
      name,
      email: lowerEmail(p.email),
      jobTitle: textOf(position?.title ?? emp?.job_title ?? emp?.position),
      department: textOf(emp?.department ?? (emp?.org_units as unknown[] | undefined)?.[0]),
      startDate: emp ? startOf(emp) : null,
      endDate: emp ? endOf(emp) : null,
    };
    if (!person.endDate && (String(p.status ?? emp?.status ?? '').toUpperCase() === 'INACTIVE')) inactiveNoDate++;
    people.push(person);
  }
  return { people, inactiveNoDate };
}

export const personio: ConnectorImpl = {
  async run(c, ctx) {
    const { people, inactiveNoDate } = await load(c);
    const label = 'Personio';
    return { results: [peopleListCheck('personio.people_list', label, people, ctx.now, inactiveNoDate)], label };
  },

  async people(c) {
    return (await load(c)).people;
  },
};
