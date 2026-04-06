import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import db from "@/lib/db";
import { verifyOTP } from "@/lib/otp";

const credentialsSchema = z.object({
  phone: z
    .string()
    .regex(/^94\d{9}$/, "Phone must be in Sri Lanka format: 94xxxxxxxxx"),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must be numeric"),
  role: z.enum(["BUS_OWNER", "ADMIN"], {
    error: "role must be BUS_OWNER or ADMIN",
  }),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone",  type: "text" },
        otp:   { label: "OTP",   type: "text" },
        role:  { label: "Role",  type: "text" },
      },

      async authorize(credentials) {
        // 1. Validate inputs
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { phone, otp, role } = parsed.data;

        // 2. Verify the OTP — checks hash, expiry, and marks as used
        const valid = await verifyOTP(phone, otp, role);
        if (!valid) return null;

        // 3. Fetch the user record and return a serialisable user object
        if (role === "BUS_OWNER") {
          const owner = await db.busOwner.findUnique({ where: { phone } });
          // Return null (generic auth failure) if account not found or deactivated by admin
          if (!owner || !owner.isActive) return null;
          return {
            id:    owner.id,
            name:  owner.name,
            phone: owner.phone,
            role:  "BUS_OWNER" as const,
          };
        }

        // role === "ADMIN"
        const admin = await db.admin.findUnique({ where: { phone } });
        if (!admin) return null;
        return {
          id:    admin.id,
          name:  admin.name,
          phone: admin.phone,
          role:  "ADMIN" as const,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in
      if (user) {
        token.id    = user.id;
        token.phone = (user as { phone: string }).phone;
        token.role  = (user as { role: "BUS_OWNER" | "ADMIN" }).role;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id    = token.id    as string;
      session.user.phone = token.phone as string;
      session.user.role  = token.role  as "BUS_OWNER" | "ADMIN";
      return session;
    },
  },
};
