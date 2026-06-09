import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      employeeNo: string
      firstName: string
      lastName: string
      profilePhoto: string | null
      roles: string[]
      permissions: string[]
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
    profilePhoto: string | null
    roles: string[]
    permissions: string[]
  }
}
