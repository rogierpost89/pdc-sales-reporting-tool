"use client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { anyApi } from "convex/server";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function UserSync() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(anyApi.users.upsertUser);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const role =
      (user.publicMetadata?.role as "admin" | "account_manager" | "brand_partner") ??
      "brand_partner";
    const brandId = user.publicMetadata?.brandId as string | undefined;
    upsertUser({
      clerkId: user.id,
      name: user.fullName ?? user.firstName ?? user.emailAddresses[0]?.emailAddress ?? "Unknown",
      email: user.emailAddresses[0]?.emailAddress,
      role,
      brandId,
    }).catch(console.error);
  }, [isLoaded, user, upsertUser]);

  return null;
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  );
}
