import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  queryGeneric as query,
  anyApi,
} from "convex/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { GenericId } from "convex/values";

// Lightweight stand-in for the generated Id type (avoids depending on _generated/).
type BrandId = string & { __tableName: "brands" };

function periodEndFor(period: string, start: number): number {
  const d = new Date(start);
  if (period === "monthly")
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  if (period === "quarterly")
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
  if (period === "annual")
    return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  // weekly
  return start + 7 * 24 * 60 * 60 * 1000;
}

// Query: fetch a single report by its ID — gated on auth; brand_partner scoped to their own brand
export const getReportById = query({
  args: {
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const report = await ctx.db.get(args.reportId as unknown as GenericId<"reports">);
    if (!report) return null;
    const role = (identity as any).publicMetadata?.role;
    if (role === "brand_partner") {
      const brandId = (identity as any).publicMetadata?.brandId;
      if ((report.brandId as string) !== brandId) throw new Error("Access denied");
    }
    return report;
  },
});

// Internal query: idempotency check — look for existing report with same brandId+period+periodStart
export const getExistingReport = internalQuery({
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
export const getSalesForPeriod = internalQuery({
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
export const getActivitiesForPeriod = internalQuery({
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

// Internal mutation: insert a new report record (atomically idempotent)
export const insertReport = internalMutation({
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
    // Atomic idempotency: serialized mutation makes this check+insert race-free
    const existing = await ctx.db
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
    if (existing) return existing._id as string;

    return ctx.db.insert("reports", {
      brandId: args.brandId as unknown as BrandId,
      period: args.period,
      periodStart: args.periodStart,
      snapshotData: args.snapshotData,
      createdAt: Date.now(),
    }) as unknown as string;
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
    const existing = await ctx.runQuery(internal.reports.getExistingReport, {
      brandId: args.brandId,
      period: args.period,
      periodStart: args.periodStart,
    });
    if (existing) return existing._id as string;

    // 2. Compute period window using calendar arithmetic to avoid boundary drift
    const periodEnd = periodEndFor(args.period, args.periodStart);

    // 3. Fetch data in parallel
    const [salesRecords, activityRecords, highlights] = await Promise.all([
      ctx.runQuery(internal.reports.getSalesForPeriod, {
        brandId: args.brandId,
        from: args.periodStart,
        to: periodEnd,
      }),
      ctx.runQuery(internal.reports.getActivitiesForPeriod, {
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
    const id = await ctx.runMutation(internal.reports.insertReport, {
      brandId: args.brandId,
      period: args.period,
      periodStart: args.periodStart,
      snapshotData,
    });

    return id as string;
  },
});

// ─── Helper: compute Monday 00:00 UTC for the current week ──────────────────
function getWeekStart(ts: number): number {
  const d = new Date(ts);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday …
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + daysToMonday
  );
}

// ─── Orchestrator: generate weekly snapshots for all brands ─────────────────
export const generateWeeklySnapshots = action({
  args: {},
  handler: async (ctx, _args) => {
    // Snapshot the just-completed week (Mon–Sun), not the current week.
    const periodStart = getWeekStart(Date.now()) - 7 * 24 * 60 * 60 * 1000;

    const brands = (await ctx.runQuery(internal.brands.listInternal, {})) as Array<{
      _id: string;
    }>;

    for (const brand of brands) {
      try {
        await ctx.runAction(anyApi.reports.generateSnapshot, {
          brandId: brand._id,
          period: "weekly",
          periodStart,
        });
      } catch (err) {
        console.error(
          `[generateWeeklySnapshots] failed for brand ${brand._id}:`,
          err
        );
      }
    }
  },
});

// ─── Orchestrator: generate annual snapshots for all brands ─────────────────
export const generateAnnualSnapshots = action({
  args: {},
  handler: async (ctx, _args) => {
    // Annual snapshot covers the previous calendar year
    const now = new Date(Date.now());
    const periodStart = Date.UTC(now.getUTCFullYear() - 1, 0, 1); // Jan 1 of prior year

    const brands = (await ctx.runQuery(internal.brands.listInternal, {})) as Array<{
      _id: string;
    }>;

    for (const brand of brands) {
      try {
        await ctx.runAction(anyApi.reports.generateSnapshot, {
          brandId: brand._id,
          period: "annual",
          periodStart,
        });
      } catch (err) {
        console.error(
          `[generateAnnualSnapshots] failed for brand ${brand._id}:`,
          err
        );
      }
    }
  },
});
