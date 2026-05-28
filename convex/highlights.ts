import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    brandId: v.id("brands"),
    storageId: v.id("_storage"),
    caption: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("highlights", {
      brandId: args.brandId,
      fileId: args.storageId,
      caption: args.caption,
      uploadedBy: args.uploadedBy,
      date: Date.now(),
    });
  },
});
