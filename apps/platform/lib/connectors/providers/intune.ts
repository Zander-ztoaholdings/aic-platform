/**
 * Microsoft Intune, read through the Microsoft 365 connection: an app-only Graph token with DeviceManagementManagedDevices.Read.All.
 * Docs: https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list
 */
import { call, result, listSome, plural, daysSince } from '../http';
import { ConnectorError, type ConnectorImpl } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import { microsoftToken } from './azure';

const SUBJECT = 'Intune';
const SELECT = 'id,deviceName,userPrincipalName,operatingSystem,osVersion,isEncrypted,complianceState,lastSyncDateTime';

type Device = { id: string; deviceName?: string; userPrincipalName?: string | null; operatingSystem?: string; isEncrypted?: boolean | null; complianceState?: string; lastSyncDateTime?: string | null };

const label = (d: Device) => (d.userPrincipalName ? `${d.deviceName ?? d.id} (${d.userPrincipalName})` : d.deviceName ?? d.id);
const isLaptop = (d: Device) => /^(windows|macos|mac os)/i.test(d.operatingSystem ?? '');

function encryption(devices: Device[]): CheckResult {
  const key = 'intune.device_encryption';
  const laptops = devices.filter(isLaptop);
  if (!laptops.length) return result(key, SUBJECT, 'unknown', 'Intune manages no Windows or Mac computers.');
  const plain = laptops.filter((d) => d.isEncrypted === false).map(label);
  // Unverified: isEncrypted can be missing for some device types; those are not counted against you.
  const unknown = laptops.filter((d) => d.isEncrypted === undefined || d.isEncrypted === null).length;
  if (plain.length) return result(key, SUBJECT, 'fail', `${plural(plain.length, 'computer is', 'computers are')} not encrypted: ${listSome(plain)}.`, { devices: plain });
  if (unknown === laptops.length) return result(key, SUBJECT, 'unknown', 'Intune did not report encryption for any computer.');
  return result(key, SUBJECT, 'pass', `All ${plural(laptops.length - unknown, 'computer')} that report it are encrypted.`);
}

function compliance(devices: Device[]): CheckResult {
  const key = 'intune.device_compliant';
  if (!devices.length) return result(key, SUBJECT, 'unknown', 'Intune manages no devices.');
  const non = devices.filter((d) => d.complianceState === 'noncompliant').map(label);
  const grace = devices.filter((d) => d.complianceState === 'inGracePeriod').map(label);
  if (non.length) return result(key, SUBJECT, 'fail', `${plural(non.length, 'device does', 'devices do')} not meet your compliance policy: ${listSome(non)}.`, { devices: non, inGracePeriod: grace });
  if (grace.length) return result(key, SUBJECT, 'warn', `${plural(grace.length, 'device is', 'devices are')} in the grace period before being marked non-compliant: ${listSome(grace)}.`, { inGracePeriod: grace });
  return result(key, SUBJECT, 'pass', `None of the ${plural(devices.length, 'device')} is marked non-compliant.`);
}

function checkin(devices: Device[], now: Date): CheckResult {
  const key = 'intune.device_checkin';
  if (!devices.length) return result(key, SUBJECT, 'unknown', 'Intune manages no devices.');
  // Graph uses 0001-01-01 for a device that has never synced.
  const late = devices.filter((d) => {
    if (!d.lastSyncDateTime || d.lastSyncDateTime.startsWith('0001-')) return true;
    return (daysSince(d.lastSyncDateTime, now) ?? 0) > 14;
  }).map(label);
  return late.length
    ? result(key, SUBJECT, 'fail', `${plural(late.length, 'device has', 'devices have')} not checked in for over 14 days: ${listSome(late)}.`, { devices: late })
    : result(key, SUBJECT, 'pass', `All ${plural(devices.length, 'device')} checked in within 14 days.`);
}

export const intune: ConnectorImpl = {
  async run(_c, ctx) {
    const token = await microsoftToken(ctx, undefined, 'Intune');
    const devices: Device[] = [];
    try {
      let next: string | undefined = `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$select=${SELECT}`;
      for (let i = 0; next && i < 50; i++) {
        const page: { value?: Device[]; '@odata.nextLink'?: string } = await call(next, { headers: { Authorization: `Bearer ${token}` } });
        devices.push(...(page.value ?? []));
        next = page['@odata.nextLink'];
      }
    } catch (e) {
      if (!(e instanceof ConnectorError) || e.status === 401 || ![403, 404, 400].includes(e.status)) throw e;
      const why = `Could not read Intune devices. The tenant may have no Intune licence, or the device read permission has not been approved: ${e.message}`;
      return { results: ['intune.device_encryption', 'intune.device_compliant', 'intune.device_checkin'].map((k) => result(k, SUBJECT, 'unknown', why)), label: SUBJECT };
    }
    return { results: [encryption(devices), compliance(devices), checkin(devices, ctx.now)], label: SUBJECT };
  },
};
