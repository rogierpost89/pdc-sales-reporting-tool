import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";

export const insert = internalMutation({
  args: {
    source: v.string(),
    channel: v.string(),
    brandId: v.id("brands"),
    sku: v.string(),
    volume: v.number(),
    revenueCents: v.number(),
    date: v.number(),
    uploadId: v.id("uploads"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sales_data", args);
  },
});
