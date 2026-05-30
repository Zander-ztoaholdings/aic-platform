import NextAuth, { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { query } from "./db"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@enterprise.co.za" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        try {
          const result = await query(`
            SELECT
              u.id,
              u.email,
              u.password_hash,
              u.name,
              u.role,
              u.org_id,
              u.is_active,
              u.is_super_admin,
              u.permissions,
              o.name as org_name,
              o.tier
            FROM users u
            LEFT JOIN organizations o ON u.org_id = o.id
            WHERE u.email = $1
          `, [credentials.email.toString().toLowerCase()])

          if (result.rows.length > 0) {
            const user = result.rows[0]

            if (!user.is_active) {
              throw new Error("Account is deactivated")
            }

            const isValid = await bcrypt.compare(credentials.password.toString(), user.password_hash)

            if (!isValid) {
              throw new Error("Invalid credentials")
            }

            // Update last login
            await query(
              'UPDATE users SET last_login = NOW() WHERE id = $1',
              [user.id]
            )

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              orgId: user.org_id,
              orgName: user.org_name || 'Unknown',
              tier: user.tier || 'TIER_3',
              isSuperAdmin: user.is_super_admin,
              permissions: user.permissions
            }
          }
        } catch (dbError) {
          console.warn("Database auth failed:", dbError)
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
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.orgId = user.orgId
        token.orgName = user.orgName
        token.tier = user.tier
        token.isSuperAdmin = user.isSuperAdmin
        token.permissions = user.permissions
      }
      return token
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.orgId = token.orgId as string
        session.user.orgName = token.orgName as string
        session.user.tier = token.tier as string
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
        session.user.permissions = token.permissions
      }
      return session
    }
  },
  debug: process.env.NODE_ENV === 'development',
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
