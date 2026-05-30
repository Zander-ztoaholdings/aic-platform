import { DefaultSession } from "next-auth";
import { AICSessionUser } from "./index";

declare module "next-auth" {
  interface Session {
    user: AICSessionUser & DefaultSession["user"];
  }

  interface User extends Partial<AICSessionUser> {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends AICSessionUser {
    id: string;
  }
}
