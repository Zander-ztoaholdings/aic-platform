/**
 * Deel, read with an organisation token (Bearer, people:read scope) through the people list.
 * Docs: https://developer.deel.com/api/endpoints/people/get-list-of-people
 */
import { call, need } from '../http';
import type { ConnectorImpl, Credentials, PersonRecord } from '../types';
import { isoDate, lowerEmail, textOf, peopleListCheck } from '../hr';

const LIMIT = 200;

type Email = { type?: string; value?: string } | string;
type Worker = {
  id: string | number; full_name?: string; first_name?: string; last_name?: string; emails?: Email[]; email?: string;
  job_title?: string; department?: { name?: string } | string | null; start_date?: string | null; termination_date?: string | null;
  hiring_status?: string; hiring_type?: string;
};
type Page = { data?: Worker[]; page?: { total_rows?: number } };

async function workers(c: Credentials): Promise<Worker[]> {
  const token = need(c, 'token', 'The organisation token');
  const out: Worker[] = [];
  for (let i = 0; i < 25; i++) {
    const j = await call<Page>(`https://api.letsdeel.com/rest/v2/people?limit=${LIMIT}&offset=${i * LIMIT}`, { headers: { Authorization: `Bearer ${token}` } });
    const rows = j.data ?? [];
    out.push(...rows);
    const total = j.page?.total_rows;
    if (rows.length < LIMIT || (typeof total === 'number' && out.length >= total)) break;
  }
  return out;
}

/** The work email if there is one, otherwise the first. Items may be strings or {type, value}. */
function emailOf(w: Worker): string | null {
  const list = (w.emails ?? []).map((e) => (typeof e === 'string' ? { type: undefined, value: e } : e));
  return lowerEmail((list.find((e) => /work/i.test(e.type ?? '')) ?? list[0])?.value ?? w.email);
}

const terminated = (w: Worker) => /terminated|offboard/i.test(w.hiring_status ?? '');

function toPerson(w: Worker): PersonRecord {
  const email = emailOf(w);
  return {
    externalId: String(w.id),
    name: (w.full_name || [w.first_name, w.last_name].filter(Boolean).join(' ') || email || String(w.id)).trim(),
    email,
    jobTitle: textOf(w.job_title),
    department: textOf(w.department),
    startDate: isoDate(w.start_date),
    endDate: isoDate(w.termination_date),
  };
}

export const deel: ConnectorImpl = {
  async run(c, ctx) {
    const list = await workers(c);
    const people = list.map(toPerson);
    const inactiveNoDate = list.filter((w, i) => terminated(w) && !people[i].endDate).length;
    const label = 'Deel';
    return { results: [peopleListCheck('deel.people_list', label, people, ctx.now, inactiveNoDate)], label };
  },

  async people(c) {
    return (await workers(c)).map(toPerson);
  },
};
