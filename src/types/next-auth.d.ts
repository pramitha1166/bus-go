import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:    string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone: string;
      role:  "BUS_OWNER" | "ADMIN";
    };
  }

  interface User {
    id:    string;
    name:  string;
    phone: string;
    role:  "BUS_OWNER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:    string;
    phone: string;
    role:  "BUS_OWNER" | "ADMIN";
  }
}
