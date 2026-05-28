import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    role: v.union(
      v.literal("admin"),
      v.literal("account_manager"),
      v.literal("brand_partner")
    ),
    brandId: v.optional(v.id("brands")),
  }),

  brands: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    partnerEmails: v.array(v.string()),
  }),

  sales_data: defineTable({
    source: v.string(),
    channel: v.string(),
    brandId: v.id("brands"),
    sku: v.string(),
    volume: v.number(),
    revenueCents: v.number(),
    date: v.number(),
    uploadId: v.id("uploads"),
  }).index("by_brandId", ["brandId"]),

  activities: defineTable({
    brandId: v.id("brands"),
    accountManagerId: v.string(),
    type: v.union(
      v.literal("call"),
      v.literal("tasting"),
      v.literal("event"),
      v.literal("bartender_training")
    ),
    count: v.number(),
    weekStart: v.number(),
  }).index("by_brandId", ["brandId"]),

  deals: defineTable({
    brandId: v.id("brands"),
    stage: v.string(),
    valueCents: v.number(),
    probability: v.optional(v.number()),
    date: v.number(),
  }).index("by_brandId", ["brandId"]),

  uploads: defineTable({
    source: v.string(),
    fileId: v.id("_storage"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    ),
    agentUsed: v.optional(v.string()),
    parsedAt: v.optional(v.number()),
  }),

  reports: defineTable({
    brandId: v.id("brands"),
    period: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual")
    ),
    periodStart: v.number(),
    snapshotData: v.any(),
    createdAt: v.number(),
  }).index("by_brandId", ["brandId"]),

  highlights: defineTable({
    brandId: v.id("brands"),
    fileId: v.id("_storage"),
    caption: v.string(),
    uploadedBy: v.string(),
    date: v.number(),
  }).index("by_brandId", ["brandId"]),

  notifications: defineTable({
    brandId: v.id("brands"),
    type: v.string(),
    sentAt: v.number(),
    reportId: v.id("reports"),
    periodStart: v.number(),
  }).index("by_brandId", ["brandId"]),
});
