import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import YandexProvider from 'next-auth/providers/yandex'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
// import { authAdapter } from './adapter'

export const authOptions: NextAuthOptions = {
  // adapter: authAdapter,

  providers: [
    // Email/Password authentication
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Find user by email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .limit(1)

        if (!user) {
          throw new Error('Invalid email or password')
        }

        // Check if user has password (OAuth users don't have passwords)
        if (!user.passwordHash) {
          throw new Error('Please sign in with the provider you used to create your account')
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password, user.passwordHash)

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        // Return user object
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),

    // Yandex OAuth
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID || '',
      clientSecret: process.env.YANDEX_CLIENT_SECRET || '',
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = (user as any).role || 'user'
      }

      // OAuth sign in
      if (account?.provider && account.provider !== 'credentials') {
        // Fetch user from database to get role
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email!))
          .limit(1)

        if (dbUser) {
          token.role = dbUser.role
          token.id = dbUser.id
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: (token.role as 'user' | 'admin') || 'user',
        }
      }
      return session
    },

    async signIn({ user, account, profile }) {
      // Allow credentials sign in
      if (account?.provider === 'credentials') {
        return true
      }

      // For OAuth providers, ensure user exists in database
      if (account?.provider && profile?.email) {
        try {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, profile.email))
            .limit(1)

          // If user doesn't exist, create them
          if (!existingUser) {
            await db.insert(users).values({
              email: profile.email,
              name: profile.name || null,
              role: 'user',
              generationsLeft: 3,
            })
          }

          return true
        } catch (error) {
          console.error('Error during OAuth sign in:', error)
          return false
        }
      }

      return true
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
