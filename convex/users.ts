import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("account_manager"),
      v.literal("brand_partner")
    ),
    brandId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role,
        ...(args.brandId !== undefined
          ? { brandId: args.brandId as import("convex/values").GenericId<"brands"> }
          : {}),
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      role: args.role,
      ...(args.brandId !== undefined
        ? { brandId: args.brandId as import("convex/values").GenericId<"brands"> }
        : {}),
    });
  },
});
