// middleware.ts
// NOTE: For role checks to work in production, configure a Clerk JWT template that
// includes publicMetadata: { "metadata": "{{user.public_metadata}}" }
// In the Clerk Dashboard → JWT Templates → Sessions token → add that claim.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isDashboard = createRouteMatcher(["/dashboard(.*)"]);
const isAccount = createRouteMatcher(["/account(.*)"]);
const isPartner = createRouteMatcher(["/partner(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  const isProtected = isDashboard(req) || isAccount(req) || isPartner(req);

  // Unauthenticated users are redirected to /sign-in
  if (isProtected && !userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (userId && isProtected) {
    const role = (sessionClaims?.metadata as { role?: string } | undefined)
      ?.role;

    let requiredRole: string | null = null;
    if (isDashboard(req)) requiredRole = "admin";
    if (isAccount(req)) requiredRole = "account_manager";
    if (isPartner(req)) requiredRole = "brand_partner";

    // Wrong-role users are redirected to /unauthorised
    if (requiredRole && role !== requiredRole) {
      return NextResponse.redirect(new URL("/unauthorised", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
