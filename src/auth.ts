import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

async function logLoginAttempt(
  success: boolean,
  email: string,
  userId: string | null,
  reason?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: success ? "LOGIN_SUCCESS" : "LOGIN_FAILURE",
        entity: "User",
        entityId: userId,
        metadata: {
          email,
          ...(reason ? { reason } : {}),
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch {
    // Audit logging should never break the login flow
    console.error("Failed to write audit log for login attempt");
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          await logLoginAttempt(false, email, null, "User not found");
          return null;
        }

        if (user.status !== "ACTIVE") {
          await logLoginAttempt(false, email, user.id, "Account inactive");
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          await logLoginAttempt(false, email, user.id, "Invalid password");
          return null;
        }

        await logLoginAttempt(true, email, user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_MAX_AGE ?? "86400", 10),
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
