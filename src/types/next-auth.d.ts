import { UserRole } from "@prisma/client";
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      role: UserRole;
      clientId?: string;
      clientName?: string;
      clientLogoUrl?: string;
    };
  }

  interface User {
    role: UserRole;
    clientId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    clientId?: string;
    clientName?: string;
    clientLogoUrl?: string;
  }
}
