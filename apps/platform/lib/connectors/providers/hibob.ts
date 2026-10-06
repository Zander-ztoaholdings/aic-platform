/**
 * HiBob (Bob), read with a service user (Basic auth, service user id and token) through the people search.
 * Docs: https://apidocs.hibob.com/reference/post_people-search
 */
import { call, basic, need } from '../http';
import type { ConnectorImpl, Credentials, PersonRecord } from '../types';
import { isoDate, lowerEmail, textOf, peopleListCheck } from '../hr';

type Employee = Record<string, unknown>;

const FIELDS = ['root.id', 'root.displayName', 'root.email', 'work.title', 'work.department', 'work.startDate', 'internal.terminationDate', 'internal.status'];

/**
 * A field from an employee, nested (employee.work.startDate) or flat
 * (employee['work.startDate'] or employee['/work/startDate']). Root fields also sit at the top level.
 */
function field(e: Employee, path: string): unknown {
  const [group, name] = path.split('.');
  const nested = group === 'root' ? e[name] : (e[group] as Record<string, unknown> | undefined)?.[name];
  if (nested !== undefined && nested !== null) return nested;
  return e[path] ?? e[`/${group}/${name}`] ?? (group === 'root' ? (e.root as Record<string, unknown> | undefined)?.[name] : undefined);
}

async function employees(c: Credentials): Promise<Employee[]> {
  const userId = need(c, 'userId', 'The service user id');
  const token = need(c, 'token', 'The service user token');
  // Unverified: humanReadable "REPLACE" should swap list ids (department, status) for their display names
  // and leave dates as ISO; confirm the date format and whether department comes back as text.
  const j = await call<{ employees?: Employee[] }>('https://api.hibob.com/v1/people/search', {
    method: 'POST', headers: { Authorization: basic(userId, token) }, body: { fields: FIELDS, showInactive: true, humanReadable: 'REPLACE' },
  });
  return j.employees ?? [];
}

function toPerson(e: Employee): PersonRecord {
  const email = lowerEmail(field(e, 'root.email'));
  const name = textOf(field(e, 'root.displayName')) ?? ([textOf(e.firstName), textOf(e.surname)].filter(Boolean).join(' ') || email || String(field(e, 'root.id') ?? ''));
  return {
    externalId: String(field(e, 'root.id') ?? email ?? name),
    name,
    email,
    jobTitle: textOf(field(e, 'work.title')),
    department: textOf(field(e, 'work.department')),
    startDate: isoDate(field(e, 'work.startDate')),
    endDate: isoDate(field(e, 'internal.terminationDate')),
  };
}

export const hibob: ConnectorImpl = {
  async run(c, ctx) {
    const list = await employees(c);
    const people = list.map(toPerson);
    const inactiveNoDate = list.filter((e, i) => /inactive|terminated/i.test(String(textOf(field(e, 'internal.status')) ?? '')) && !people[i].endDate).length;
    const label = 'HiBob';
    return { results: [peopleListCheck('hibob.people_list', label, people, ctx.now, inactiveNoDate)], label };
  },

  async people(c) {
    return (await employees(c)).map(toPerson);
  },
};
