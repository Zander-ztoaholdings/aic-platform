/**
 * CrowdStrike Falcon, read with an API client (OAuth client credentials) holding Hosts: Read and, optionally, Vulnerabilities: Read.
 * Docs: developer.crowdstrike.com/api-reference/collections/hosts
 */
import { call, need, result, listSome, plural, daysSince, clientCredentials } from '../http';
import type { ConnectorImpl } from '../types';
import type { CheckResult } from '../../integrations/catalog';

type Host = { device_id: string; hostname?: string; last_seen?: string | null; reduced_functionality_mode?: string | null };
type Vuln = { cve?: { id?: string }; host_info?: { hostname?: string } };

const CLOUDS: Record<string, string> = { 'us-1': 'https://api.crowdstrike.com', 'us-2': 'https://api.us-2.crowdstrike.com', 'eu-1': 'https://api.eu-1.crowdstrike.com' };

export const crowdstrike: ConnectorImpl = {
  async run(c, ctx) {
    const clientId = need(c, 'clientId', 'The client id');
    const clientSecret = need(c, 'clientSecret', 'The client secret');
    const base = CLOUDS[(c.cloud ?? '').trim()] ?? CLOUDS['us-1'];
    const subject = 'CrowdStrike Falcon';
    const token = await clientCredentials(`${base}/oauth2/token`, clientId, clientSecret);
    const get = <T>(path: string) => call<T>(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const results: CheckResult[] = [];

    // Sensors: every host seen in the last 7 days and not in reduced functionality mode.
    const ids = (await get<{ resources?: string[] }>('/devices/queries/devices/v1?limit=5000')).resources ?? [];
    const hosts: Host[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const qs = ids.slice(i, i + 100).map((id) => `ids=${encodeURIComponent(id)}`).join('&');
      hosts.push(...((await get<{ resources?: Host[] }>(`/devices/entities/devices/v2?${qs}`)).resources ?? []));
    }
    const nameOf = (h: Host) => h.hostname || h.device_id;
    const silent = hosts.filter((h) => { const n = daysSince(h.last_seen ?? null, ctx.now); return n === null || n > 7; }).map(nameOf);
    const reduced = hosts.filter((h) => h.reduced_functionality_mode === 'yes').map(nameOf);
    const problems: string[] = [];
    if (silent.length) problems.push(`${plural(silent.length, 'host')} not seen for over 7 days: ${listSome(silent)}.`);
    if (reduced.length) problems.push(`${plural(reduced.length, 'host')} running with reduced protection: ${listSome(reduced)}.`);
    results.push(!hosts.length
      ? result('crowdstrike.edr_coverage', subject, 'unknown', 'Falcon returned no hosts. The API client may not be allowed to read hosts.')
      : problems.length
        ? result('crowdstrike.edr_coverage', subject, 'fail', problems.join(' '), { silent, reduced })
        : result('crowdstrike.edr_coverage', subject, 'pass', `All ${plural(hosts.length, 'host')} reported in within 7 days with full protection.`));

    // Open critical vulnerabilities, from Spotlight (a separate module).
    try {
      const filter = encodeURIComponent("status:'open'+cve.severity:'CRITICAL'");
      const j = await get<{ resources?: Vuln[]; meta?: { pagination?: { total?: number } } }>(`/spotlight/combined/vulnerabilities/v1?filter=${filter}&limit=400`);
      const vulns = j.resources ?? [];
      const total = j.meta?.pagination?.total ?? vulns.length;
      const hostNames = [...new Set(vulns.map((v) => v.host_info?.hostname).filter((x): x is string => !!x))];
      const cves = [...new Set(vulns.map((v) => v.cve?.id).filter((x): x is string => !!x))];
      results.push(total
        ? result('crowdstrike.no_open_critical_vulns', subject, 'fail', `${plural(total, 'open critical vulnerability', 'open critical vulnerabilities')} on ${listSome(hostNames)}, including ${listSome(cves)}.`, { hosts: hostNames, cves, total })
        : result('crowdstrike.no_open_critical_vulns', subject, 'pass', 'No open critical vulnerabilities on any host.'));
    } catch (e) {
      const s = (e as { status?: number }).status;
      if (s === 403) results.push(result('crowdstrike.no_open_critical_vulns', subject, 'unknown', 'Falcon would not share vulnerability data. Spotlight is a separate module, and the API client also needs Vulnerabilities: Read.'));
      else results.push(result('crowdstrike.no_open_critical_vulns', subject, 'unknown', `Could not read vulnerabilities: ${(e as Error).message}`));
    }

    return { results, label: subject };
  },
};
