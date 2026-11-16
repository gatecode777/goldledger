import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for NextAuth v5 on Vercel / any non-localhost host.
  // Without this the host-header check silently fails and authorize() returns null.
  trustHost: true,

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminHash  = process.env.ADMIN_PASSWORD_HASH;

        if (!adminEmail || !adminHash) {
          console.error('[auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH env vars are missing');
          return null;
        }

        const inputEmail = String(credentials.email).trim().toLowerCase();
        const targetEmail = adminEmail.trim().toLowerCase();

        if (inputEmail !== targetEmail) {
          console.error(`[auth] Email mismatch. Received: "${inputEmail}", Expected: "${targetEmail}"`);
          return null;
        }

        // Clean any quotes, whitespace, or escaped backslashes in ADMIN_PASSWORD_HASH
        // (Vercel environment variables sometimes keep literal backslashes from \$, or surrounding quotes)
        const cleanHash = adminHash.trim().replace(/^["']|["']$/g, '').replace(/\\(\$)/g, '$1');

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          cleanHash
        );

        if (!passwordMatch) {
          console.error('[auth] Password mismatch: bcrypt.compare returned false');
          return null;
        }

        return {
          id:    'admin',
          email: adminEmail,
          name:  'Admin',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id    = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
