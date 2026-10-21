import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authenticateCredentials, AccountLockedError, RateLimitedError } from "@/lib/auth/credentials";
import { getClientIp } from "@/lib/rateLimit";

class AccountLockedSignInError extends CredentialsSignin {
  code = "account-locked";
}

class RateLimitedSignInError extends CredentialsSignin {
  code = "rate-limited";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;

        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { username: true, role: true, mustChangePassword: true },
        });

        session.user.username = dbUser?.username ?? "";
        session.user.role = dbUser?.role ?? "USER";
        session.user.mustChangePassword = dbUser?.mustChangePassword ?? false;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        try {
          return await authenticateCredentials(credentials, getClientIp(request));
        } catch (error) {
          if (error instanceof AccountLockedError) {
            throw new AccountLockedSignInError();
          }
          if (error instanceof RateLimitedError) {
            throw new RateLimitedSignInError();
          }
          throw error;
        }
      },
    }),
  ],
});
