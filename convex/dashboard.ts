import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getSalesMetrics = query({
  args: {
    brandId: v.optional(v.id("brands")),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Compute cutoff timestamp from period
    const now = Date.now();
    let cutoff = 0;
    if (args.period === "7d") {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.period === "30d") {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    } else if (args.period === "90d") {
      cutoff = now - 90 * 24 * 60 * 60 * 1000;
    }
    // "all" or undefined → cutoff stays 0

    // Fetch all brands for building id→name map
    const allBrands = await ctx.db.query("brands").collect();
    const brandMap: Record<string, string> = {};
    for (const brand of allBrands) {
      brandMap[brand._id] = brand.name;
    }

    // Fetch sales_data, applying brandId index if provided
    let records;
    if (args.brandId) {
      records = await ctx.db
        .query("sales_data")
        .withIndex("by_brandId", (q) => q.eq("brandId", args.brandId!))
        .collect();
    } else {
      records = await ctx.db.query("sales_data").collect();
    }

    // Apply date filter
    if (cutoff > 0) {
      records = records.filter((r) => r.date >= cutoff);
    }

    // Aggregate metrics
    let totalRevenueCents = 0;
    let totalVolume = 0;
    const channelBreakdown: Record<string, { revenue: number; volume: number }> = {};
    const brandBreakdown: Record<string, { revenue: number; volume: number; name: string }> = {};

    for (const record of records) {
      totalRevenueCents += record.revenueCents;
      totalVolume += record.volume;

      // Channel breakdown
      if (!channelBreakdown[record.channel]) {
        channelBreakdown[record.channel] = { revenue: 0, volume: 0 };
      }
      channelBreakdown[record.channel].revenue += record.revenueCents;
      channelBreakdown[record.channel].volume += record.volume;

      // Brand breakdown
      const brandId = record.brandId as string;
      if (!brandBreakdown[brandId]) {
        brandBreakdown[brandId] = {
          revenue: 0,
          volume: 0,
          name: brandMap[brandId] ?? "Unknown",
        };
      }
      brandBreakdown[brandId].revenue += record.revenueCents;
      brandBreakdown[brandId].volume += record.volume;
    }

    // Limit records to 100 for the table
    const tableRecords = records.slice(0, 100).map((r) => ({
      _id: r._id,
      date: r.date,
      brandId: r.brandId as string,
      brandName: brandMap[r.brandId as string] ?? "Unknown",
      sku: r.sku,
      channel: r.channel,
      volume: r.volume,
      revenueCents: r.revenueCents,
    }));

    return {
      totalRevenueCents,
      totalVolume,
      channelBreakdown,
      brandBreakdown,
      records: tableRecords,
      brandMap,
    };
  },
});
