import { users, eq, getTenantDb, getSystemDb } from '../db';

/**
 * INSTITUTIONAL USER SERVICE
 * 
 * Facade for user management, ensuring RLS and role-based access control.
 */
export class UserService {
  /**
   * Fetch a user by ID within their organization context
   */
  static async getById(userId: string, orgId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return user;
    });
  }

  /**
   * Fetch a user by email (System-wide, usually for Auth)
   */
  static async getByEmail(email: string) {
    const db = getSystemDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user;
  }

  /**
   * List all users in an organization
   */
  static async listByOrg(orgId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      return await tx
        .select()
        .from(users)
        .where(eq(users.orgId, orgId));
    });
  }
}
