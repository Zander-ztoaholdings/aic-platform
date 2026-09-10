import { NextResponse, type NextRequest } from "next/server";

/**
 * The gate.
 *
 * PREVIOUSLY: this wrapped NextAuth's `auth()`, which pulls in the database
 * client and jsonwebtoken — neither of which runs on the edge runtime — so it
 * declared `runtime: "nodejs"`. Node middleware is experimental in Next 15 and
 * requires `experimental.nodeMiddleware` in next.config, which was never set.
 * The middleware therefore did not run in production, and since no page checks
 * a session for itself, app.aiccertified.cloud served the client dashboard to
 * anonymous visitors.
 *
 * NOW: a deliberately dumb cookie check that runs on the default runtime with
 * no imports beyond next/server, so there is nothing here that can fail to
 * build or fail open. It answers one question — is there a session cookie at
 * all — and redirects to /login if not.
 *
 * This is a GATE, not authentication. It does not verify the token. Server
 * code must still establish identity properly before trusting anything; what
 * this guarantees is that an anonymous visitor cannot browse the application,
 * which is the hole that was actually open.
 */

// Auth.js v5 names the cookie differently under HTTPS, and older deployments
// may still carry the v4 name. Checking all four avoids locking anyone out
// during a rollover.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

// Everything an anonymous visitor legitimately needs, and nothing else.
//
// /signup, /api/signup and /onboard were NOT here when the gate was closed,
// which silently made account creation impossible — the page and the API both
// existed and both redirected to /login. It went unnoticed because there were
// no real users yet. Anything added here is a hole by definition, so each
// entry has to earn its place: these three are the account-creation path, and
// an application nobody can create an account for is not secured, it is shut.
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/api/auth",
  "/signup",
  "/api/signup",
  "/onboard",
  // Enrolment for accounts that cannot hold a session until they have a second
  // factor. It authorises itself against a short-lived grant cookie rather than
  // a session — see lib/mfa-grant.ts — so a session check here would lock out
  // exactly the people it exists for.
  "/mfa/setup",
  // A health check that requires a session cannot tell anyone the service is
  // unhealthy. It reports status and latency only — no internal error strings.
  "/api/health",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // So a bookmarked deep link still lands where it was going after sign-in.
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and the favicon. /api is NOT excluded:
  // the previous matcher let every API route through unauthenticated, which is
  // the larger half of the same hole.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
