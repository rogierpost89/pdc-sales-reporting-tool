import { auth, currentUser } from "@clerk/nextjs/server";

export type UserRole = "admin" | "account_manager" | "brand_partner";

export async function getUserRole(): Promise<UserRole | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return (user?.publicMetadata?.role as UserRole) ?? null;
}

export async function getUserBrandId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return (user?.publicMetadata?.brandId as string) ?? null;
}
