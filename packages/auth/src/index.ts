import NextAuth, { NextAuthConfig } from "next-auth"
import { type JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import MicrosoftEntraIDProvider from "next-auth/providers/microsoft-entra-id"
import { getSystemDb, users, organizations, auditLogs, eq, like } from "@aic/db"
import { UserRole, CertificationTier, Permissions } from "@aic/types"
import jwt from 'jsonwebtoken';
import { MFAService } from "./services/mfa";

const PRIVATE_KEY = process.env.PLATFORM_PRIVATE_KEY?.replace(/\\n/g, '\n');
const PUBLIC_KEY = process.env.PLATFORM_PUBLIC_KEY?.replace(/\\n/g, '\n');

async function logAuthEvent(eventType: string, details: Record<string, unknown>, orgId?: string | null) {
  const db = getSystemDb();
  try {
    await db.insert(auditLogs).values({
      orgId: orgId || null,
      eventType: `AUTH_${eventType}`,
      systemName: 'AIC_AUTH',
      details,
      status: 'VERIFIED',
      createdAt: new Date()
    });
  } catch (error) {
    console.error(`[AUTH] Critical: Failed to log auth event ${eventType}:`, error);
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
// ... (providers mapping remains same)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    MicrosoftEntraIDProvider({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "",
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0` : undefined,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@enterprise.co.za" },
        password: { label: "Password", type: "password" },
        mfaToken: { label: "MFA Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const mfaToken = credentials.mfaToken as string | undefined;

        const db = getSystemDb();
        try {
          const [user] = await db
            .select({
              id: users.id,
              email: users.email,
              passwordHash: users.passwordHash,
              name: users.name,
              role: users.role,
              orgId: users.orgId,
              isActive: users.isActive,
              isSuperAdmin: users.isSuperAdmin,
              permissions: users.permissions,
              failedLoginAttempts: users.failedLoginAttempts,
              lockoutUntil: users.lockoutUntil,
              twoFactorSecret: users.twoFactorSecret,
              twoFactorEnabled: users.twoFactorEnabled,
              backupCodes: users.backupCodes,
              orgName: organizations.name,
              tier: organizations.tier,
            })
            .from(users)
            .leftJoin(organizations, eq(users.orgId, organizations.id))
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (user) {
            if (!user.isActive) {
              await logAuthEvent('LOGIN_REJECTED', { email, reason: 'Account deactivated' }, user.orgId);
              throw new Error("Account is deactivated")
            }

            // Check for lockout
            if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
              const minutesLeft = Math.ceil((new Date(user.lockoutUntil).getTime() - new Date().getTime()) / 60000);
              await logAuthEvent('LOGIN_REJECTED', { email, reason: 'Account locked' }, user.orgId);
              throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`)
            }

            const bcrypt = await import("bcryptjs")
            const isValid = await bcrypt.default.compare(password, user.passwordHash)

            if (!isValid) {
              const newAttempts = (user.failedLoginAttempts || 0) + 1;
              const updateData: { failedLoginAttempts: number; lockoutUntil?: Date } = { failedLoginAttempts: newAttempts };
              
              if (newAttempts >= 5) {
                const backoffs = [30_000, 120_000, 300_000, 900_000, 3_600_000]; // 30s, 2m, 5m, 15m, 1h
                const backoffIndex = Math.min(newAttempts - 5, backoffs.length - 1);
                const lockoutDurationMs = backoffs[backoffIndex];
                
                updateData.lockoutUntil = new Date(Date.now() + lockoutDurationMs);
                await logAuthEvent('ACCOUNT_LOCKED', { 
                  email, 
                  attempts: newAttempts, 
                  lockoutDurationMs 
                }, user.orgId);
              }

              await db.update(users).set(updateData).where(eq(users.id, user.id));
              await logAuthEvent('LOGIN_FAILURE', { email, reason: 'Invalid credentials', attempts: newAttempts }, user.orgId);
              throw new Error("Invalid credentials")
            }

            // Institutional Hardening: MFA Check
            const isMfaMandatory = (user.role === 'ADMIN' || user.role === 'COMPLIANCE_OFFICER') && !user.isSuperAdmin;

            if (user.twoFactorEnabled && user.twoFactorSecret) {
              if (!mfaToken) {
                // Signal to UI that MFA is required
                throw new Error("MFA_REQUIRED")
              }

              const isMFAValid = MFAService.verifyToken(user.twoFactorSecret, mfaToken);
              
              if (!isMFAValid) {
                // Check backup codes (Phase 1-1)
                const backupCodes = user.backupCodes as string[] | null;
                if (backupCodes && backupCodes.includes(mfaToken)) {
                  const newBackupCodes = backupCodes.filter(c => c !== mfaToken);
                  await db.update(users).set({ backupCodes: newBackupCodes }).where(eq(users.id, user.id));
                  await logAuthEvent('BACKUP_CODE_USED', { email: user.email, userId: user.id }, user.orgId);
                } else {
                  await logAuthEvent('MFA_FAILURE', { email: user.email, userId: user.id }, user.orgId);
                  throw new Error("Invalid MFA token")
                }
              }
            } else if (isMfaMandatory) {
              // Forced redirection to MFA setup for privileged roles
              throw new Error("MFA_SETUP_REQUIRED")
            }

            // Update last login and reset failed attempts
            await db.update(users).set({ 
              lastLogin: new Date(),
              failedLoginAttempts: 0,
              lockoutUntil: null
            }).where(eq(users.id, user.id));

            await logAuthEvent('LOGIN_SUCCESS', { email: user.email, userId: user.id }, user.orgId);

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role as UserRole,
              orgId: user.orgId || 'INTERNAL',
              orgName: user.orgName || 'AIC Internal',
              tier: (user.tier as CertificationTier) || 'TIER_3',
              isSuperAdmin: user.isSuperAdmin || false,
              permissions: (user.permissions as unknown as Permissions) || { can_view_audits: true, can_view_incidents: true, can_view_intelligence: true }
            }
          } else {
            await logAuthEvent('LOGIN_FAILURE', { email, reason: 'User not found' });
          }
        } catch (dbError) {
          console.warn("[AUTH] Login failed:", dbError)
          throw dbError;
        }

        throw new Error("Invalid credentials")
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  events: {
    async signOut(message) {
      if ('token' in message && message.token) {
        const { token } = message;
        if (token.jti && token.exp) {
          const { RevocationService } = await import("./services/revocation");
          await RevocationService.revoke(token.jti as string, token.exp as number);
          await logAuthEvent('LOGOUT', { userId: token.id, jti: token.jti }, token.orgId as string);
        }
      }
    }
  },
  ...(PRIVATE_KEY && PUBLIC_KEY ? {
    jwt: {
      async encode({ token }) {
          // Ensure JTI is present (Phase 0-4)
          if (token && !token.jti) {
            const crypto = await import("crypto");
            token.jti = crypto.randomUUID();
          }
          
          return jwt.sign(token!, PRIVATE_KEY, { algorithm: 'RS256' });
      },
      async decode({ token }) {
          if (!token) return null;
          try {
              return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }) as JWT;
          } catch {
              return null;
          }
      }
    }
  } : {}),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'microsoft-entra-id') {
        const db = getSystemDb();
        try {
          const [existingUser] = await db
            .select({ id: users.id, orgId: users.orgId, role: users.role })
            .from(users)
            .where(eq(users.email, user.email?.toLowerCase() || ""))
            .limit(1);

          if (existingUser) {
            user.orgId = existingUser.orgId || 'INTERNAL'
            user.role = existingUser.role as UserRole
            user.id = existingUser.id
            await logAuthEvent('SSO_LOGIN_SUCCESS', { email: user.email, provider: account.provider }, existingUser.orgId);
            return true
          }

          // Domain-based discovery for institutional auto-link
          const domain = user.email?.split('@')[1]
          if (domain) {
            const [org] = await db
              .select({ id: organizations.id })
              .from(organizations)
              .where(like(organizations.contactEmail, `%@${domain}`))
              .limit(1);

            if (org) {
              const [newUser] = await db.insert(users).values({
                email: (user.email || "").toLowerCase(),
                name: user.name || "SSO User",
                orgId: org.id,
                role: 'VIEWER',
                passwordHash: 'SSO_ONLY',
                isActive: true,
                emailVerified: true
              }).returning({ id: users.id, role: users.role });
              
              user.id = newUser.id
              user.orgId = org.id
              user.role = newUser.role as UserRole
              await logAuthEvent('SSO_USER_CREATED', { email: user.email, orgId: org.id }, org.id);
              return true
            }
          }
          await logAuthEvent('SSO_LOGIN_REJECTED', { email: user.email, reason: 'No organization found for domain' });
          return false; // Reject SSO if no org found
        } catch (error) {
          console.error("[AUTH] SSO SignIn Error:", error)
          return false;
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role as UserRole
        token.orgId = user.orgId as string
        token.orgName = user.orgName as string
        token.tier = user.tier as CertificationTier
        token.isSuperAdmin = user.isSuperAdmin as boolean
        token.permissions = user.permissions as Permissions
        
        // Generate JTI if not present (Institutional Hardening P0)
        if (!token.jti) {
          const crypto = await import("crypto");
          token.jti = crypto.randomUUID();
        }
      }

      // Task P1: Token Revocation Check
      try {
        const { RevocationService } = await import("./services/revocation");
        if (token.jti && await RevocationService.isRevoked(token.jti)) {
          return null; // Invalidate session
        }
      } catch (revocationError) {
        console.warn("[AUTH] Revocation check skipped:", revocationError);
      }

      if (token.orgId && !token.orgName) {
        const db = getSystemDb();
        try {
          const [org] = await db
            .select({ name: organizations.name, tier: organizations.tier })
            .from(organizations)
            .where(eq(organizations.id, token.orgId))
            .limit(1);
          if (org) {
            token.orgName = org.name
            token.tier = org.tier as CertificationTier
          }
        } catch {
          // Ignore fetch errors during JWT enrichment
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.orgId = token.orgId
        session.user.orgName = token.orgName
        session.user.tier = token.tier
        session.user.isSuperAdmin = token.isSuperAdmin
        session.user.permissions = token.permissions
      }
      return session
    }
  },
}

const nextAuth = NextAuth(authConfig);
export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    orgId: string;
    orgName: string;
    tier: CertificationTier;
    isSuperAdmin: boolean;
    permissions: Permissions;
  }
  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    orgId: string;
    orgName: string;
    tier: CertificationTier;
    isSuperAdmin: boolean;
    permissions: Permissions;
    jti?: string;
  }
}

export * from "./services/signing"
export * from "./services/revocation"
export * from "./services/mfa"
export * from "./helpers"
