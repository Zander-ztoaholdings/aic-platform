/**
 * BambooHR, read with an API key (Basic auth, key as the user, "x" as the password) through a custom report.
 * Docs: https://documentation.bamboohr.com/reference/request-custom-report-1
 */
import { call, basic, need } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials, type PersonRecord } from '../types';
import { isoDate, lowerEmail, textOf, peopleListCheck } from '../hr';

type Row = { id: string | number; displayName?: string; firstName?: string; lastName?: string; workEmail?: string; jobTitle?: string; department?: string; hireDate?: string; terminationDate?: string; status?: string };

const FIELDS = ['id', 'displayName', 'firstName', 'lastName', 'workEmail', 'jobTitle', 'department', 'hireDate', 'terminationDate', 'status'];

function setup(c: Credentials) {
  const subdomain = need(c, 'subdomain', 'The company domain').replace(/^https?:\/\//i, '').replace(/\.bamboohr\.com.*$/i, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9-]+$/i.test(subdomain)) throw new ConnectorError(400, 'The company domain should be the part before .bamboohr.com, for example yourcompany.');
  return { subdomain, token: need(c, 'token', 'The API key') };
}

async function rows(c: Credentials): Promise<{ subdomain: string; rows: Row[] }> {
  const { subdomain, token } = setup(c);
  // Deprecated in favour of the Datasets API but still documented; returns active and inactive employees with onlyCurrent=false.
  const j = await call<{ employees?: Row[] }>(`https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1/reports/custom?format=JSON&onlyCurrent=false`, {
    method: 'POST', headers: { Authorization: basic(token, 'x'), Accept: 'application/json' }, body: { title: 'AIC people', fields: FIELDS },
  });
  return { subdomain, rows: j.employees ?? [] };
}

const toPerson = (r: Row): PersonRecord => ({
  externalId: String(r.id),
  name: (r.displayName || [r.firstName, r.lastName].filter(Boolean).join(' ') || r.workEmail || String(r.id)).trim(),
  email: lowerEmail(r.workEmail),
  jobTitle: textOf(r.jobTitle),
  department: textOf(r.department),
  startDate: isoDate(r.hireDate),
  endDate: isoDate(r.terminationDate),
});

export const bamboohr: ConnectorImpl = {
  async run(c, ctx) {
    const { subdomain, rows: list } = await rows(c);
    const people = list.map(toPerson);
    const inactiveNoDate = list.filter((r, i) => r.status === 'Inactive' && !people[i].endDate).length;
    const label = `${subdomain}.bamboohr.com`;
    return { results: [peopleListCheck('bamboohr.people_list', label, people, ctx.now, inactiveNoDate)], label };
  },

  async people(c) {
    return (await rows(c)).rows.map(toPerson);
  },
};
