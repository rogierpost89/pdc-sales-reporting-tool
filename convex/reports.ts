import {
  actionGeneric as action,
  mutationGeneric as mutation,
  queryGeneric as query,
  anyApi,
} from "convex/server";
import { v } from "convex/values";

// Lightweight stand-in for the generated Id type (avoids depending on _generated/).
type BrandId = string & { __tableName: "brands" };

const PERIOD_DURATION: Record<string, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  quarterly: 90 * 24 * 60 * 60 * 1000,
  annual: 365 * 24 * 60 * 60 * 1000,
};

// Internal query: idempotency check — look for existing report with same brandId+period+periodStart
export const getExistingReport = query({
  args: {
    brandId: v.string(),
    period: v.string(),
    periodStart: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("reports")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", args.brandId as unknown as BrandId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("period"), args.period),
          q.eq(q.field("periodStart"), args.periodStart)
        )
      )
      .first();
  },
});

// Internal query: fetch sales records for a brand within a time window
export const getSalesForPeriod = query({
  args: {
    brandId: v.string(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sales_data")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", args.brandId as unknown as BrandId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.from),
          q.lt(q.field("date"), args.to)
        )
      )
      .collect();
  },
});

// Internal query: fetch activity records for a brand within a time window
export const getActivitiesForPeriod = query({
  args: {
    brandId: v.string(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("activities")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", args.brandId as unknown as BrandId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("weekStart"), args.from),
          q.lt(q.field("weekStart"), args.to)
        )
      )
      .collect();
  },
});

// Internal mutation: insert a new report record
export const insertReport = mutation({
  args: {
    brandId: v.string(),
    period: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual")
    ),
    periodStart: v.number(),
    snapshotData: v.any(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("reports", {
      brandId: args.brandId as unknown as BrandId,
      period: args.period,
      periodStart: args.periodStart,
      snapshotData: args.snapshotData,
      createdAt: Date.now(),
    });
  },
});

// Main action: generate (or return existing) a snapshot report for a brand+period
export const generateSnapshot = action({
  args: {
    brandId: v.string(),
    period: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual")
    ),
    periodStart: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Idempotency check
    const existing = await ctx.runQuery(anyApi.reports.getExistingReport, {
      brandId: args.brandId,
      period: args.period,
      periodStart: args.periodStart,
    });
    if (existing) return existing._id as string;

    // 2. Compute period window
    const periodEnd = args.periodStart + PERIOD_DURATION[args.period];

    // 3. Fetch data in parallel
    const [salesRecords, activityRecords, highlights] = await Promise.all([
      ctx.runQuery(anyApi.reports.getSalesForPeriod, {
        brandId: args.brandId,
        from: args.periodStart,
        to: periodEnd,
      }),
      ctx.runQuery(anyApi.reports.getActivitiesForPeriod, {
        brandId: args.brandId,
        from: args.periodStart,
        to: periodEnd,
      }),
      ctx.runQuery(anyApi.highlights.getByBrand, {
        brandId: args.brandId as unknown as BrandId,
        limit: 6,
      }),
    ]);

    // 4. Aggregate sales by channel
    let totalRevenueCents = 0;
    let totalVolume = 0;
    const channelMap: Record<string, { volume: number; revenueCents: number }> =
      {};

    for (const r of salesRecords) {
      totalRevenueCents += r.revenueCents;
      totalVolume += r.volume;
      if (!channelMap[r.channel]) {
        channelMap[r.channel] = { volume: 0, revenueCents: 0 };
      }
      channelMap[r.channel].volume += r.volume;
      channelMap[r.channel].revenueCents += r.revenueCents;
    }

    // 5. Aggregate activity counts by type
    const activitySummary: Record<string, number> = {
      call: 0,
      tasting: 0,
      event: 0,
      bartender_training: 0,
    };
    for (const r of activityRecords) {
      if (r.type in activitySummary) {
        activitySummary[r.type] += r.count;
      }
    }

    // 6. Assemble snapshotData (plain JSON — no Convex Ids)
    const snapshotData = {
      totalRevenueCents,
      totalVolume,
      channelBreakdown: Object.entries(channelMap).map(([channel, vals]) => ({
        channel,
        volume: vals.volume,
        revenueCents: vals.revenueCents,
      })),
      activitySummary,
      highlights: (highlights as Array<{ url: string | null; caption: string }>).map((h) => ({
        url: h.url,
        caption: h.caption,
      })),
    };

    // 7. Write and return the new report id
    const id = await ctx.runMutation(anyApi.reports.insertReport, {
      brandId: args.brandId,
      period: args.period,
      periodStart: args.periodStart,
      snapshotData,
    });

    return id as string;
  },
});
