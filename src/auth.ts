import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authenticateCredentials, AccountLockedError, RateLimitedError } from "@/lib/auth/credentials";
import { getClientIp } from "@/lib/rateLimit";
import { isDbConnectionError } from "@/lib/apiError";
import { recordAudit } from "@/lib/audit";

class AccountLockedSignInError extends CredentialsSignin {
  code = "account-locked";
}

class RateLimitedSignInError extends CredentialsSignin {
  code = "rate-limited";
}

class DbUnavailableSignInError extends CredentialsSignin {
  code = "db-unavailable";
}

class UnexpectedSignInError extends CredentialsSignin {
  code = "unexpected-error";
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

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { username: true, role: true, mustChangePassword: true },
          });

          session.user.username = dbUser?.username ?? "";
          session.user.role = dbUser?.role ?? "USER";
          session.user.mustChangePassword = dbUser?.mustChangePassword ?? false;
        } catch (error) {
          if (isDbConnectionError(error)) {
            console.error("Database connection error during session lookup:", error);
            session.user.dbUnavailable = true;
            session.user.username = "";
            session.user.role = "USER";
            session.user.mustChangePassword = false;
          } else {
            throw error;
          }
        }
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
        const ip = getClientIp(request);
        const attempted =
          typeof credentials?.username === "string" ? credentials.username : null;

        try {
          const user = await authenticateCredentials(credentials, ip);

          await recordAudit(
            user
              ? {
                  level: "INFO",
                  category: "auth",
                  action: "login.success",
                  message: `"${attempted}" signed in`,
                  actorId: user.id,
                  actorName: attempted,
                  ip,
                }
              : {
                  level: "WARN",
                  category: "auth",
                  action: "login.failed",
                  message: `Failed sign-in attempt for "${attempted ?? "(no username)"}"`,
                  actorName: attempted,
                  ip,
                }
          );

          return user;
        } catch (error) {
          if (error instanceof AccountLockedError) {
            await recordAudit({
              level: "WARN",
              category: "auth",
              action: "login.locked",
              message: `Sign-in refused: account "${attempted}" is locked after too many failed attempts`,
              actorName: attempted,
              ip,
            });
            throw new AccountLockedSignInError();
          }
          if (error instanceof RateLimitedError) {
            await recordAudit({
              level: "WARN",
              category: "auth",
              action: "login.rate_limited",
              message: `Too many sign-in attempts from this address`,
              actorName: attempted,
              ip,
            });
            throw new RateLimitedSignInError();
          }
          if (isDbConnectionError(error)) {
            // No audit row: the database is the thing that is down.
            console.error("Database connection error during login:", error);
            throw new DbUnavailableSignInError();
          }
          console.error("Unexpected error during login:", error);
          await recordAudit({
            level: "ERROR",
            category: "auth",
            action: "login.error",
            message: `Unexpected error while signing in "${attempted ?? "(no username)"}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            actorName: attempted,
            ip,
          });
          throw new UnexpectedSignInError();
        }
      },
    }),
  ],
});
