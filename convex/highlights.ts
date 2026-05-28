import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getByBrand = query({
  args: {
    brandId: v.id("brands"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const role = (identity as any).publicMetadata?.role;
    if (role === "brand_partner") {
      const ownBrandId = (identity as any).publicMetadata?.brandId;
      if ((args.brandId as string) !== ownBrandId) throw new Error("Access denied");
    }

    const limit = args.limit ?? 12;
    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_brandId", (q) => q.eq("brandId", args.brandId))
      .order("desc")
      .take(limit);

    return Promise.all(
      highlights.map(async (h) => ({
        ...h,
        url: await ctx.storage.getUrl(h.fileId),
      }))
    );
  },
});

export const create = mutation({
  args: {
    brandId: v.id("brands"),
    storageId: v.id("_storage"),
    caption: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const role = (identity as any).publicMetadata?.role;
    if (!["admin", "account_manager"].includes(role)) throw new Error("Insufficient role");

    return ctx.db.insert("highlights", {
      brandId: args.brandId,
      fileId: args.storageId,
      caption: args.caption,
      uploadedBy: args.uploadedBy,
      date: Date.now(),
    });
  },
});
