import {
  queryGeneric as query,
  internalQueryGeneric as internalQuery,
} from "convex/server";

// Public — returns name + logoUrl only (no partnerEmails). Gated on any authenticated user.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const brands = await ctx.db.query("brands").collect();
    return brands.map(({ _id, _creationTime, name, logoUrl }) => ({
      _id,
      _creationTime,
      name,
      logoUrl,
    }));
  },
});

// Internal — full record including partnerEmails. Only callable from server-side Convex functions.
export const listInternal = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("brands").collect(),
});
