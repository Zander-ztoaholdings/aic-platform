/**
 * SharePoint for agents: what a tool may reach, checked by AIC.
 *
 * Two fences, both outside the model's control. Microsoft's: AIC's agent app
 * holds only Sites.Selected, so it can open nothing until the client's
 * administrator grants it one named site, read or write. AIC's: the tool is
 * fixed to one site, one document library and optionally one folder in it;
 * every address is built by AIC from those, and the model supplies only a
 * path inside them. Search is never offered, because Microsoft Graph search
 * answers across the whole tenant whatever the app was granted.
 *
 * Pure: tested in __tests__/lib/agents-sharepoint.test.ts.
 */
import type { Approval } from './config';

export type SharePointTool = {
  kind: 'sharepoint';
  name: string;
  description: string;
  /** The client's Microsoft 365 tenant, set when its administrator consents. */
  tenantId: string | null;
  /** https://contoso.sharepoint.com/sites/Policies */
  siteUrl: string;
  /** Document library display name, e.g. "Documents". */
  library: string;
  /** Optional folder inside the library the agent is kept to, without slashes at either end. */
  folder: string;
  access: 'read' | 'write';
  /** For writes; reads never wait unless this is 'always'. */
  approval: Approval;
};

export const SP_WRITE_EXT = ['md', 'txt', 'csv', 'json', 'html'] as const;
export const SP_READ_EXT = ['md', 'txt', 'csv', 'json', 'html', 'docx'] as const;
export const SP_MAX_WRITE = 1_000_000;
export const SP_MAX_READ_BYTES = 10 * 1024 * 1024;

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path segment AIC will put in a Graph address: no traversal, no Graph path syntax, nothing SharePoint forbids. */
const BAD_CHARS = /[\\:*?"<>|#%]/;
const hasControl = (p: string) => [...p].some((ch) => ch.charCodeAt(0) < 32);
const BAD_SEGMENT = { test: (p: string) => BAD_CHARS.test(p) || hasControl(p) };
function cleanPath(raw: string): string | null {
  const parts = raw.replace(/^\/+|\/+$/g, '').split('/').map((s) => s.trim());
  if (parts.length === 1 && parts[0] === '') return '';
  if (parts.some((p) => !p || p === '.' || p === '..' || BAD_SEGMENT.test(p) || p.length > 200)) return null;
  const out = parts.join('/');
  return out.length > 400 ? null : out;
}

/** Validates a SharePoint tool from a request. */
export function cleanSharePointTool(o: Record<string, unknown>, name: string, description: string): { tool: SharePointTool } | { error: string } {
  let site: URL;
  try { site = new URL(str(o.siteUrl, 300)); } catch { return { error: `${name}: paste the site’s address, like https://yourcompany.sharepoint.com/sites/Policies` }; }
  if (site.protocol !== 'https:' || !/^[a-z0-9-]+\.sharepoint\.com$/i.test(site.hostname)) return { error: `${name}: the address must be a SharePoint Online site on sharepoint.com.` };
  const sitePath = site.pathname.replace(/\/+$/, '');
  if (!/^\/(sites|teams)\/[^/]+$/i.test(sitePath)) return { error: `${name}: use the site’s own address, ending in /sites/name or /teams/name, not a page or a folder in it.` };
  const library = str(o.library, 120) || 'Documents';
  if (BAD_SEGMENT.test(library) || library.includes('/')) return { error: `${name}: that library name has characters SharePoint does not allow.` };
  const folder = cleanPath(str(o.folder, 400));
  if (folder === null) return { error: `${name}: the folder may not contain “..” or characters SharePoint does not allow.` };
  const tenantId = typeof o.tenantId === 'string' && UUID.test(o.tenantId) ? o.tenantId.toLowerCase() : null;
  const access = o.access === 'write' ? 'write' : 'read';
  const approval: Approval = o.approval === 'never' || o.approval === 'always' ? o.approval : 'writes';
  return { tool: { kind: 'sharepoint', name, description, tenantId, siteUrl: `https://${site.hostname.toLowerCase()}${sitePath}`, library, folder, access, approval } };
}

export type SpOp =
  | { op: 'list'; path: string }
  | { op: 'read'; path: string }
  | { op: 'write'; path: string; content: string; replace: boolean };

export type SpDecision = { allowed: false; reason: string } | { allowed: true; call: SpOp; needsApproval: boolean; where: string };

/** Checks one call the model asked for. The returned path is inside the tool's folder. */
export function checkSharePointCall(tool: SharePointTool, input: Record<string, unknown>): SpDecision {
  const action = String(input.action ?? '');
  if (!['list', 'read', 'write'].includes(action)) return { allowed: false, reason: 'Use list, read or write.' };
  if (action === 'write' && tool.access !== 'write') return { allowed: false, reason: `${tool.name} is read-only.` };
  const rel = cleanPath(String(input.path ?? ''));
  if (rel === null) return { allowed: false, reason: 'That path is not allowed: no “..”, and none of \\ : * ? " < > | # %.' };
  const path = [tool.folder, rel].filter(Boolean).join('/');
  const where = `${tool.siteUrl} / ${tool.library}${path ? ` / ${path}` : ''}`;
  if (action === 'list') return { allowed: true, call: { op: 'list', path }, needsApproval: tool.approval === 'always', where };
  if (!rel) return { allowed: false, reason: 'Give the path of a file.' };
  const ext = (rel.split('.').pop() ?? '').toLowerCase();
  if (action === 'read') {
    if (!(SP_READ_EXT as readonly string[]).includes(ext)) return { allowed: false, reason: `AIC can read ${SP_READ_EXT.join(', ')} files for agents.` };
    return { allowed: true, call: { op: 'read', path }, needsApproval: tool.approval === 'always', where };
  }
  if (!(SP_WRITE_EXT as readonly string[]).includes(ext)) return { allowed: false, reason: `Agents can write ${SP_WRITE_EXT.join(', ')} files.` };
  const content = typeof input.content === 'string' ? input.content : '';
  if (!content) return { allowed: false, reason: 'Give the content to write.' };
  if (Buffer.byteLength(content) > SP_MAX_WRITE) return { allowed: false, reason: 'That is more than 1 MB.' };
  return { allowed: true, call: { op: 'write', path, content, replace: input.replace === true }, needsApproval: tool.approval !== 'never', where };
}

/** The tool definition the model sees. */
export function sharePointSpec(t: SharePointTool) {
  const actions = t.access === 'write' ? ['list', 'read', 'write'] : ['list', 'read'];
  return {
    name: t.name,
    description: `${t.description} SharePoint library “${t.library}”${t.folder ? `, folder ${t.folder}` : ''}. list shows a folder (empty path for the top); read returns a file’s text (${SP_READ_EXT.join(', ')}).${t.access === 'write' ? ` write creates a ${SP_WRITE_EXT.join(', ')} file; set replace to true to overwrite one that exists.` : ''} There is no search: list folders to find files.`,
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: actions },
        path: { type: 'string', description: 'Path inside the library, like Policies/Leave.docx' },
        ...(t.access === 'write' ? { content: { type: 'string' }, replace: { type: 'boolean' } } : {}),
      },
      required: ['action', 'path'],
    },
  };
}

/** Graph addresses, built only from the tool's fixed site and drive. */
export function graphItemPath(driveId: string, path: string, suffix: '' | ':/children' | ':/content'): string {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  if (!path) return `/drives/${encodeURIComponent(driveId)}/root${suffix === ':/children' ? '/children' : ''}`;
  return `/drives/${encodeURIComponent(driveId)}/root:/${enc}${suffix}`;
}

/** /sites/{hostname}:/sites/{name} for a site address. */
export function graphSitePath(siteUrl: string): string {
  const u = new URL(siteUrl);
  return `/sites/${u.hostname}:${u.pathname}`;
}
