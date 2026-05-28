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
    brandId: v.string(),
  },
  handler: async (ctx, args) => {
    const uploadId = await ctx.db.insert("uploads", {
      fileId: args.storageId,
      source: args.source,
      brandId: args.brandId,
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
    brandId: v.string(),
  },
  handler: async (ctx, args) => {
    // Mark as processing
    await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
      uploadId: args.uploadId,
      status: "processing",
    });

    try {
      if (args.source === "exact") {
        const summary = await ctx.runAction(
          anyApi.agents.exactAgent.runExactAgent,
          {
            uploadId: args.uploadId,
            storageId: args.storageId,
            brandId: args.brandId,
          }
        );
        await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
          uploadId: args.uploadId,
          status: "done",
          agentUsed: "exactAgent",
        });
        return summary;
      }

      if (args.source === "woocommerce") {
        const summary = await ctx.runAction(
          anyApi.agents.woocommerceAgent.runWoocommerceAgent,
          {
            uploadId: args.uploadId,
            storageId: args.storageId,
            brandId: args.brandId,
          }
        );
        await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
          uploadId: args.uploadId,
          status: "done",
          agentUsed: "woocommerceAgent",
        });
        return summary;
      }

      if (args.source === "pipedrive") {
        const summary = await ctx.runAction(
          anyApi.agents.pipedriveAgent.runPipedriveAgent,
          {
            uploadId: args.uploadId,
            storageId: args.storageId,
            brandId: args.brandId,
          }
        );
        await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
          uploadId: args.uploadId,
          status: "done",
          agentUsed: "pipedriveAgent",
        });
        return summary;
      }

      // Fallback path: explicit "manual" source, or any unrecognised source.
      // The manual agent decides which table(s) the data maps to and updates the
      // upload status itself (done if confidence >= 0.6, failed if below).
      const summary = await ctx.runAction(
        anyApi.agents.manualAgent.runManualAgent,
        {
          uploadId: args.uploadId,
          storageId: args.storageId,
          brandId: args.brandId,
        }
      );
      return summary;
    } catch (error) {
      const agentUsed = {
        exact: "exactAgent",
        woocommerce: "woocommerceAgent",
        pipedrive: "pipedriveAgent",
        manual: "manualAgent",
      }[args.source];
      await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
        uploadId: args.uploadId,
        status: "failed",
        agentUsed,
      });
      throw error;
    }
  },
});
