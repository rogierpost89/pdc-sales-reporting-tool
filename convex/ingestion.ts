import {
  mutationGeneric as mutation,
  actionGeneric as action,
  anyApi,
} from "convex/server";
import { v } from "convex/values";

const sourceValidator = v.union(
  v.literal("exact"),
  v.literal("woocommerce"),
  v.literal("pipedrive"),
  v.literal("manual")
);

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("failed")
);

// 1. Generate a pre-signed upload URL — browser calls this first.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// 2. Create an uploads record with status "pending".
export const createUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const uploadId = await ctx.db.insert("uploads", {
      fileId: args.storageId,
      source: args.source,
      status: "pending",
      parsedAt: undefined,
      agentUsed: undefined,
    });
    return uploadId;
  },
});

// 3. Update upload status — called by the ingestion action and the client.
export const updateUploadStatus = mutation({
  args: {
    uploadId: v.id("uploads"),
    status: statusValidator,
    agentUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, {
      status: args.status,
      ...(args.agentUsed !== undefined ? { agentUsed: args.agentUsed } : {}),
      ...(args.status === "done" || args.status === "failed"
        ? { parsedAt: Date.now() }
        : {}),
    });
  },
});

// 4. Ingestion action stub — routes to the correct agent (#15-18 will fill this out).
export const runIngestionAgent = action({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    // Mark as processing
    await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
      uploadId: args.uploadId,
      status: "processing",
    });

    try {
      // TODO: Route to the correct agent based on source (#15, #16, #17, #18)
      // Stub: mark as done immediately
      await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
        uploadId: args.uploadId,
        status: "done",
        agentUsed: "stub",
      });
    } catch (error) {
      await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
        uploadId: args.uploadId,
        status: "failed",
      });
      throw error;
    }
  },
});
