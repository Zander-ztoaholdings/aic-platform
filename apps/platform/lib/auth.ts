export * from "@aic/auth"
import { auth } from "@aic/auth"

/**
 * Get the current session (server-side)
 */
export async function getSession() {
  return await auth()
}
