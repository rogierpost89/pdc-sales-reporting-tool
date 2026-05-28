import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";

export const insert = internalMutation({
  args: {
    brandId: v.id("brands"),
    accountManagerId: v.id("users"),
    type: v.union(
      v.literal("call"),
      v.literal("tasting"),
      v.literal("event"),
      v.literal("bartender_training")
    ),
    count: v.number(),
    weekStart: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", args);
  },
});
