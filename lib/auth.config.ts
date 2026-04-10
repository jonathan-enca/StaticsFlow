// Edge-safe Auth.js config — no Node.js-only imports (no bcrypt, no Prisma)
// Used by middleware.ts which runs in the Edge runtime.
// The full config (with Prisma adapter + bcrypt) lives in lib/auth.ts.

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
};
