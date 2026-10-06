/**
 * Kandji (Iru Endpoint Management), read with an API token limited to device list and device details.
 * Docs: api-docs.iru.com
 */
import { call, need, result, listSome, plural, daysSince } from '../http';
import type { ConnectorImpl } from '../types';
import type { CheckResult } from '../../integrations/catalog';

type Device = {
  device_id: string;
  device_name?: string;
  platform?: string;
  os_version?: string | null;
  last_check_in?: string | null;
  user?: { email?: string } | string | null;
  // Unverified: whether the list endpoint carries filevault_enabled; the details call is the fallback.
  filevault_enabled?: boolean | null;
};
// Unverified: details field path filevault.filevault_enabled (Iru docs render client-side and were not confirmed).
type Details = { filevault?: { filevault_enabled?: boolean | null } | null };

const major = (v: string | null | undefined) => { const n = parseInt(String(v ?? '').split('.')[0], 10); return Number.isFinite(n) ? n : null; };

export const kandji: ConnectorImpl = {
  async run(c, ctx) {
    const sub = need(c, 'subdomain', 'The Kandji subdomain').replace(/^https?:\/\//, '').split('.')[0];
    const token = need(c, 'token', 'The API token');
    const region = (c.region ?? '').trim() === 'eu' ? 'eu' : 'us';
    const minMacos = parseInt((c.minMacos ?? '').trim() || '14', 10) || 14;
    const base = region === 'eu' ? `https://${sub}.api.eu.kandji.io` : `https://${sub}.api.kandji.io`;
    const subject = new URL(base).host;
    const get = <T>(path: string) => call<T>(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });

    const devices: Device[] = [];
    for (let page = 0; page < 20; page++) {
      const rows = await get<Device[]>(`/api/v1/devices?limit=300&offset=${page * 300}`);
      devices.push(...(Array.isArray(rows) ? rows : []));
      if (!Array.isArray(rows) || rows.length < 300) break;
    }
    const nameOf = (d: Device) => d.device_name || d.device_id;
    const macs = devices.filter((d) => (d.platform ?? '').toLowerCase() === 'mac');
    const results: CheckResult[] = [];

    // FileVault, Macs only. Fetch details for Macs the list does not cover, up to 200.
    let detailsDenied = false;
    let detailsCalls = 0;
    const fv = new Map<string, boolean | null>();
    for (const d of macs) {
      if (typeof d.filevault_enabled === 'boolean') { fv.set(d.device_id, d.filevault_enabled); continue; }
      if (detailsDenied || detailsCalls >= 200) { fv.set(d.device_id, null); continue; }
      detailsCalls++;
      try {
        const det = await get<Details>(`/api/v1/devices/${d.device_id}/details`);
        const v = det.filevault?.filevault_enabled;
        fv.set(d.device_id, typeof v === 'boolean' ? v : null);
      } catch (e) {
        const s = (e as { status?: number }).status;
        if (s === 403 || s === 404) detailsDenied = true; else throw e;
        fv.set(d.device_id, null);
      }
    }
    const known = macs.filter((d) => fv.get(d.device_id) !== null && fv.get(d.device_id) !== undefined);
    const off = known.filter((d) => fv.get(d.device_id) === false).map(nameOf);
    const unknownFv = macs.length - known.length;
    results.push(!macs.length
      ? result('kandji.filevault_enabled', subject, 'unknown', 'Kandji returned no Macs.')
      : !known.length
        ? result('kandji.filevault_enabled', subject, 'unknown', `Kandji did not report FileVault status for any Mac.${detailsDenied ? ' The token may not be allowed to read device details.' : ''}`)
        : off.length
          ? result('kandji.filevault_enabled', subject, 'fail', `${plural(off.length, 'Mac')} without FileVault: ${listSome(off)}.`, { devices: off })
          : result('kandji.filevault_enabled', subject, 'pass', `All ${plural(known.length, 'Mac')} with a reported status have FileVault on.${unknownFv ? ` ${plural(unknownFv, 'Mac')} did not report a status.` : ''}`));

    // macOS version, Macs only.
    const withOs = macs.filter((d) => major(d.os_version) !== null);
    const old = withOs.filter((d) => (major(d.os_version) as number) < minMacos).map((d) => `${nameOf(d)} (${d.os_version})`);
    results.push(!withOs.length
      ? result('kandji.os_up_to_date', subject, 'unknown', macs.length ? 'Kandji did not report a macOS version for any Mac.' : 'Kandji returned no Macs.')
      : old.length
        ? result('kandji.os_up_to_date', subject, 'fail', `${plural(old.length, 'Mac')} older than macOS ${minMacos}: ${listSome(old)}.`, { devices: old })
        : result('kandji.os_up_to_date', subject, 'pass', `All ${plural(withOs.length, 'Mac')} run macOS ${minMacos} or later.`));

    // Check-in, every device.
    const late = devices.filter((d) => { const n = daysSince(d.last_check_in ?? null, ctx.now); return n === null || n > 14; }).map(nameOf);
    results.push(!devices.length
      ? result('kandji.device_checkin', subject, 'unknown', 'Kandji returned no devices.')
      : late.length
        ? result('kandji.device_checkin', subject, 'fail', `${plural(late.length, 'device')} not checked in for over 14 days: ${listSome(late)}.`, { devices: late })
        : result('kandji.device_checkin', subject, 'pass', `All ${plural(devices.length, 'device')} checked in within 14 days.`));

    return { results, label: subject };
  },
};
