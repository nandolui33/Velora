import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/db";

const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    // En local permitimos enlazar una cuenta existente con el mismo email
    // verificado por Google. En producción se sustituirá por un flujo de
    // vinculación explícito o por invitaciones verificadas.
    allowDangerousEmailAccountLinking: process.env.NODE_ENV !== "production",
  }),
  Nodemailer({
    server: process.env.EMAIL_SERVER ?? "",
    from: process.env.EMAIL_FROM ?? "Velora <no-reply@velora.test>",
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?checkEmail=1",
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.id) {
        return true;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });

      return dbUser?.status !== "disabled";
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isSuperadmin = user.isSuperadmin;
      }

      return session;
    },
  },
});
