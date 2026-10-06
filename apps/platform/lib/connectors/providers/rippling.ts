/**
 * Rippling, read with an API token (Bearer) through the REST workers list.
 * Docs: https://developer.rippling.com/documentation/rest-api
 */
import { call, need } from '../http';
import type { ConnectorImpl, Credentials, PersonRecord } from '../types';
import { isoDate, lowerEmail, textOf, peopleListCheck } from '../hr';

const API = 'https://rest.ripplingapis.com';

// Unverified: the whole worker shape. The docs site is rendered in the browser and could not be read in full.
// Confirm against a live account: the list key (results or data), the next-page key (next_link or next),
// the name fields, title, department, start_date, end_date and the status values for leavers.
type Worker = Record<string, unknown>;
type Page = { results?: Worker[]; data?: Worker[]; next_link?: string | null; next?: string | null };

async function workers(c: Credentials): Promise<Worker[]> {
  const token = need(c, 'token', 'The API token');
  const out: Worker[] = [];
  let next: string | null = `${API}/workers?limit=100`;
  for (let i = 0; next && i < 30; i++) {
    const j: Page = await call<Page>(next, { headers: { Authorization: `Bearer ${token}` } });
    out.push(...(j.results ?? j.data ?? []));
    const link = j.next_link ?? j.next ?? null;
    next = link ? new URL(link, API).toString() : null;
  }
  return out;
}

const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function nameOf(w: Worker): string | null {
  const user = obj(w.user);
  const userName = user.name;
  if (typeof userName === 'string' && userName.trim()) return userName.trim();
  const un = obj(userName);
  const structured = textOf(un.formatted) ?? ([textOf(un.given_name), textOf(un.family_name)].filter(Boolean).join(' ') || null);
  if (structured) return structured;
  return textOf(w.display_name) ?? textOf(user.display_name) ?? ([textOf(w.legal_first_name), textOf(w.legal_last_name)].filter(Boolean).join(' ') || null);
}

const left = (w: Worker) => /terminated|inactive|ended/i.test(String(w.status ?? ''));

function toPerson(w: Worker): PersonRecord {
  const email = lowerEmail(w.work_email ?? obj(w.user).work_email ?? w.email);
  return {
    externalId: String(w.id ?? email ?? ''),
    name: nameOf(w) ?? email ?? String(w.id ?? ''),
    email,
    jobTitle: textOf(w.title),
    department: textOf(obj(w.department).name ?? w.department),
    startDate: isoDate(w.start_date),
    endDate: isoDate(w.end_date ?? obj(w.termination_details).date),
  };
}

export const rippling: ConnectorImpl = {
  async run(c, ctx) {
    const list = await workers(c);
    const people = list.map(toPerson);
    const inactiveNoDate = list.filter((w, i) => left(w) && !people[i].endDate).length;
    const label = 'Rippling';
    return { results: [peopleListCheck('rippling.people_list', label, people, ctx.now, inactiveNoDate)], label };
  },

  async people(c) {
    return (await workers(c)).map(toPerson);
  },
};
