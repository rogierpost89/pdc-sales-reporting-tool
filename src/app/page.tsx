import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role === "admin") redirect("/dashboard");
  if (role === "account_manager") redirect("/account");
  if (role === "brand_partner") redirect("/partner");

  redirect("/unauthorised");
}
