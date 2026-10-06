/**
 * One browser holds one session cookie, shared by every tab. Signing in as a
 * second account in a new tab therefore swaps the account under every tab
 * already open: a page still showing organisation A would save its next form
 * into organisation B. This module pins each page to the account it was
 * loaded for and tells the server which one that is, so the server can refuse
 * (see EXPECTED_USER_HEADER in @aic/auth) and the page can say why.
 */

export const EXPECTED_USER_HEADER = 'x-aic-expected-user';
export const SESSION_CHANGE_KEY = 'aic-session-change';

let pinned: string | null = null;
let patched = false;
const listeners = new Set<() => void>();

export function pinnedUser(): string | null {
  return pinned;
}

export function pinUser(id: string | null): void {
  if (!pinned && id) pinned = id;
}

/** Called just before this page deliberately signs in or out. */
export function announceSessionChange(): void {
  pinned = null;
  try {
    localStorage.setItem(SESSION_CHANGE_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the other tabs still notice when they regain focus.
  }
}

/** Something suggests the account may have changed; listeners re-check. */
export function onSuspectChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Whether a request should carry the pinned account. Same-origin API calls only, and never the sign-in endpoints themselves. */
export function shouldTag(url: string, origin: string): boolean {
  let u: URL;
  try {
    u = new URL(url, origin);
  } catch {
    return false;
  }
  return u.origin === origin && u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/auth/');
}

/** Add the header to every same-origin API call made through window.fetch. Idempotent. */
export function patchFetch(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!pinned || !shouldTag(url, window.location.origin)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(EXPECTED_USER_HEADER, pinned);
    const res = await original(input, { ...init, headers });
    if (res.status === 401 || res.status === 403) listeners.forEach((fn) => fn());
    return res;
  };
}
