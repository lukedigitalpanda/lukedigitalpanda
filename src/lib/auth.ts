import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Microsoft 365 / Azure AD login
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID!,
          }),
        ]
      : []),
    // Email/password login for dev or fallback
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            client: {
              select: { id: true, name: true, logoUrl: true },
            },
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        // In production, use bcrypt to verify password hash
        // For now, simple check for development
        if (!user.passwordHash) {
          return null;
        }

        // Simple password check for development (seed data uses plaintext "demo")
        // TODO: Replace with bcrypt.compare in production
        const isValid = credentials.password === user.passwordHash;
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          clientId: user.clientId || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.clientId = (user as any).clientId;

        // Fetch client details for CLIENT_USER
        if ((user as any).clientId) {
          const client = await prisma.client.findUnique({
            where: { id: (user as any).clientId },
            select: { name: true, logoUrl: true },
          });
          if (client) {
            token.clientName = client.name;
            token.clientLogoUrl = client.logoUrl || undefined;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).clientId = token.clientId;
        (session.user as any).clientName = token.clientName;
        (session.user as any).clientLogoUrl = token.clientLogoUrl;
      }
      return session;
    },
  },
};
