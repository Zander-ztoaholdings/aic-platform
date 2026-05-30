import { auth } from "./index"
import { redirect } from 'next/navigation'
import { AICSessionUser, UserRole, hasRole } from '@aic/types'

/**
 * Get current user or redirect to login (Server-side)
 */
export async function getCurrentUser(): Promise<AICSessionUser> {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return session.user as unknown as AICSessionUser
}

/**
 * Require a specific role or redirect to unauthorized (Server-side)
 */
export async function requireAuth(minRole?: UserRole) {
  const user = await getCurrentUser()

  if (minRole && !hasRole(user.role, minRole)) {
    redirect('/unauthorized')
  }

  return user
}
