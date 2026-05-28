import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

const PERIOD_MS: Record<string, number> = {
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  all: 0,
};

export const getBrandMetrics = query({
  args: {
    period: v.optional(v.string()), // "30d" | "90d" | "all"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // brandId comes from Clerk publicMetadata — never from args
    const brandId = (
      identity as { publicMetadata?: { brandId?: string } }
    ).publicMetadata?.brandId;
    if (!brandId) throw new Error("No brandId in publicMetadata");

    const periodKey = args.period ?? "30d";
    const periodMs = PERIOD_MS[periodKey] ?? PERIOD_MS["30d"];
    const cutoff = periodMs > 0 ? Date.now() - periodMs : 0;

    // Sales data scoped to this brand
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let salesRecords = await ctx.db
      .query("sales_data")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", brandId as unknown as any)
      )
      .collect();

    if (cutoff > 0) {
      salesRecords = salesRecords.filter((r) => r.date >= cutoff);
    }

    // Aggregate — uses "revenue" key to match MetricCards expectations
    let totalRevenueCents = 0;
    let totalVolume = 0;
    const channelMap: Record<string, { revenue: number; volume: number }> = {};

    for (const r of salesRecords) {
      totalRevenueCents += r.revenueCents;
      totalVolume += r.volume;
      if (!channelMap[r.channel]) {
        channelMap[r.channel] = { revenue: 0, volume: 0 };
      }
      channelMap[r.channel].revenue += r.revenueCents;
      channelMap[r.channel].volume += r.volume;
    }

    // Channel breakdown as array for the table
    const channelBreakdown = Object.entries(channelMap).map(([channel, v]) => ({
      channel,
      volume: v.volume,
      revenueCents: v.revenue,
    }));

    // Activity summary for this brand
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activityRecords = await ctx.db
      .query("activities")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", brandId as unknown as any)
      )
      .collect();

    const activitySummary: Record<string, number> = {
      call: 0,
      tasting: 0,
      event: 0,
      bartender_training: 0,
    };
    for (const r of activityRecords) {
      activitySummary[r.type] += r.count;
    }

    // IMPORTANT: never return COGS, margin, or other brands' data
    return {
      totalRevenueCents,
      totalVolume,
      channelBreakdown,
      channelBreakdownMap: channelMap,
      activitySummary,
    };
  },
});
