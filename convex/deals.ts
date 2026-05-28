import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";

export const insert = internalMutation({
  args: {
    brandId: v.id("brands"),
    stage: v.string(),
    valueCents: v.number(),
    probability: v.optional(v.number()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("deals", args);
  },
});
