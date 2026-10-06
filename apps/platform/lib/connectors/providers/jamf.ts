/**
 * Jamf Pro, read with an API client (client credentials) whose API role only reads computer inventory.
 * Docs: developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory
 */
import { call, baseUrl, need, result, listSome, plural, daysSince, clientCredentials } from '../http';
import type { ConnectorImpl } from '../types';
import type { CheckResult } from '../../integrations/catalog';

type Computer = {
  id: string;
  general?: { name?: string; lastContactTime?: string | null };
  diskEncryption?: { bootPartitionEncryptionDetails?: { partitionFileVault2State?: string | null } | null } | null;
  operatingSystem?: { version?: string | null } | null;
  userAndLocation?: { email?: string | null } | null;
};

const SECTIONS = ['GENERAL', 'DISK_ENCRYPTION', 'OPERATING_SYSTEM', 'USER_AND_LOCATION'].map((s) => `section=${s}`).join('&');
const major = (v: string | null | undefined) => { const n = parseInt(String(v ?? '').split('.')[0], 10); return Number.isFinite(n) ? n : null; };

export const jamf: ConnectorImpl = {
  async run(c, ctx) {
    const base = baseUrl(need(c, 'baseUrl', 'The Jamf Pro address'));
    const clientId = need(c, 'clientId', 'The client id');
    const clientSecret = need(c, 'clientSecret', 'The client secret');
    const minMacos = parseInt((c.minMacos ?? '').trim() || '14', 10) || 14;
    const subject = new URL(base).host;

    const token = await clientCredentials(`${base}/api/oauth/token`, clientId, clientSecret);
    const computers: Computer[] = [];
    for (let page = 0; page < 50; page++) {
      const j = await call<{ totalCount?: number; results?: Computer[] }>(`${base}/api/v1/computers-inventory?${SECTIONS}&page=${page}&page-size=100`, { headers: { Authorization: `Bearer ${token}` } });
      const rows = j.results ?? [];
      computers.push(...rows);
      if (rows.length < 100 || (j.totalCount !== undefined && computers.length >= j.totalCount)) break;
    }
    const nameOf = (d: Computer) => d.general?.name || `Computer ${d.id}`;
    const results: CheckResult[] = [];

    if (!computers.length) {
      for (const k of ['jamf.filevault_enabled', 'jamf.os_up_to_date', 'jamf.device_checkin']) results.push(result(k, subject, 'unknown', 'Jamf Pro returned no computers.'));
      return { results, label: subject };
    }

    // FileVault: a device with no reported state is unknown, not a failure.
    const withState = computers.filter((d) => d.diskEncryption?.bootPartitionEncryptionDetails?.partitionFileVault2State);
    const notEncrypted = withState.filter((d) => d.diskEncryption?.bootPartitionEncryptionDetails?.partitionFileVault2State !== 'ENCRYPTED').map(nameOf);
    const unknownFv = computers.length - withState.length;
    results.push(!withState.length
      ? result('jamf.filevault_enabled', subject, 'unknown', 'Jamf Pro did not report FileVault status for any computer. The API role may not be allowed to read disk encryption.')
      : notEncrypted.length
        ? result('jamf.filevault_enabled', subject, 'fail', `${plural(notEncrypted.length, 'Mac')} without FileVault: ${listSome(notEncrypted)}.`, { devices: notEncrypted })
        : result('jamf.filevault_enabled', subject, 'pass', `All ${plural(withState.length, 'Mac')} with a reported status have FileVault on.${unknownFv ? ` ${plural(unknownFv, 'Mac')} did not report a status.` : ''}`));

    // macOS version against the configured minimum major version.
    const withOs = computers.filter((d) => major(d.operatingSystem?.version) !== null);
    const old = withOs.filter((d) => (major(d.operatingSystem?.version) as number) < minMacos).map((d) => `${nameOf(d)} (${d.operatingSystem?.version})`);
    results.push(!withOs.length
      ? result('jamf.os_up_to_date', subject, 'unknown', 'Jamf Pro did not report a macOS version for any computer.')
      : old.length
        ? result('jamf.os_up_to_date', subject, 'fail', `${plural(old.length, 'Mac')} older than macOS ${minMacos}: ${listSome(old)}.`, { devices: old })
        : result('jamf.os_up_to_date', subject, 'pass', `All ${plural(withOs.length, 'Mac')} run macOS ${minMacos} or later.`));

    // Check-in within 14 days; no contact time at all counts as not checked in.
    const late = computers.filter((d) => { const n = daysSince(d.general?.lastContactTime ?? null, ctx.now); return n === null || n > 14; }).map(nameOf);
    results.push(late.length
      ? result('jamf.device_checkin', subject, 'fail', `${plural(late.length, 'computer')} not checked in for over 14 days: ${listSome(late)}.`, { devices: late })
      : result('jamf.device_checkin', subject, 'pass', `All ${plural(computers.length, 'computer')} checked in within 14 days.`));

    return { results, label: subject };
  },
};
