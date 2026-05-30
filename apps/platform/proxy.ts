import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * AIC Platform Hardened Middleware (Closed by Default)
 * 
 * DESIGN PRINCIPLE:
 * Any route NOT explicitly listed in PUBLIC_ROUTES is locked.
 * This prevents accidental exposure when new routes are added.
 */
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/unauthorized',
  '/public-registry'
]

// Routes that require specific elevated roles
const ROLE_REQUIREMENTS: Record<string, string[]> = {
  '/settings': ['ADMIN', 'COMPLIANCE_OFFICER'],
  '/audit-logs': ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  '/incidents': ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR']
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Allow explicit public routes
  const isPublic = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  if (isPublic) {
    return NextResponse.next()
  }

  // 2. Auth Check (Closed by Default)
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET
  })

  // Deny access if no session exists
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 3. Institutional Boundary Enforcement
  // Ensure session has an orgId or is a Super Admin
  if (!token.orgId && !token.isSuperAdmin) {
    console.warn(`[SECURITY] Access denied to ${pathname}: Missing orgId for user ${token.email}`)
    return NextResponse.redirect(new URL('/unauthorized?reason=MISSING_INSTITUTION', request.url))
  }

  // 4. RBAC (Role-Based Access Control) Enforcement
  const matchedRole = Object.entries(ROLE_REQUIREMENTS).find(
    ([route]) => pathname === route || pathname.startsWith(route + '/')
  )
  
  if (matchedRole) {
    const [, requiredRoles] = matchedRole
    if (!requiredRoles.includes(token.role as string)) {
      console.warn(`[SECURITY] RBAC Failure: User ${token.email} (${token.role}) attempted to access ${pathname}`)
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // 5. Hardened Security Headers
  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;")

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth - though handled in PUBLIC_ROUTES, this is a safety matcher)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
