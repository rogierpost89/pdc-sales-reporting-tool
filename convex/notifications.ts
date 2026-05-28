import {
  actionGeneric as action,
  mutationGeneric as mutation,
  queryGeneric as query,
  anyApi,
} from "convex/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { renderMonthlyEmail, renderQuarterlyEmail } from "./email/renderEmail";

// Lightweight stand-in for generated Id types
type BrandId = string & { __tableName: "brands" };
type ReportId = string & { __tableName: "reports" };

/** Format a Unix timestamp (ms) into "Month YYYY", e.g. "May 2026" */
function formatMonthLabel(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Format a Unix timestamp (ms) into "Q# YYYY", e.g. "Q2 2026" */
function formatQuarterLabel(ts: number): string {
  const d = new Date(ts);
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} ${d.getFullYear()}`;
}

// ─── Internal mutation: insert a notifications record ────────────────────────

export const insertNotification = mutation({
  args: {
    brandId: v.string(),
    type: v.string(),
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("notifications", {
      brandId: args.brandId as unknown as BrandId,
      type: args.type,
      sentAt: Date.now(),
      reportId: args.reportId as unknown as ReportId,
    });
  },
});

// ─── Action: send monthly notification email ─────────────────────────────────

export const sendMonthlyEmail = action({
  args: {
    brandId: v.string(),
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch brand
    const brands = await ctx.runQuery(anyApi.brands.list, {});
    const brand = brands.find(
      (b: { _id: string }) => b._id === args.brandId
    ) as
      | {
          _id: string;
          name: string;
          logoUrl?: string;
          partnerEmails: string[];
        }
      | undefined;

    if (!brand) throw new Error("Brand not found");
    if (!brand.partnerEmails?.length) throw new Error("No partner emails");

    // 2. Fetch report
    const report = await ctx.runQuery(anyApi.reports.getReportById, {
      reportId: args.reportId,
    });
    if (!report) throw new Error("Report not found");

    const snapshot = report.snapshotData as {
      totalRevenueCents: number;
      totalVolume: number;
      highlights?: Array<{ url: string | null; caption: string }>;
    };

    // 3. Render email HTML
    const html = await renderMonthlyEmail({
      brandName: brand.name,
      brandLogoUrl: brand.logoUrl ?? null,
      monthLabel: formatMonthLabel(report.periodStart as number),
      totalRevenueCents: snapshot.totalRevenueCents,
      totalVolume: snapshot.totalVolume,
      highlights: snapshot.highlights ?? [],
      reportUrl: `https://yourapp.vercel.app/partner/reports/${args.reportId}`,
      unsubscribeUrl: "https://yourapp.vercel.app/unsubscribe",
    });

    // 4. Send via Resend — if this throws, the notification record is NOT written
    const resend = new Resend(process.env.RESEND_API_KEY);
    const monthLabel = formatMonthLabel(report.periodStart as number);
    await resend.emails.send({
      from: "reports@spiritedunion.com",
      to: brand.partnerEmails,
      subject: `Your ${monthLabel} Report is Ready`,
      html,
    });

    // 5. Write notifications record
    await ctx.runMutation(anyApi.notifications.insertNotification, {
      brandId: args.brandId,
      type: "monthly",
      reportId: args.reportId,
    });
  },
});

// ─── Action: send quarterly notification email ────────────────────────────────

export const sendQuarterlyEmail = action({
  args: {
    brandId: v.string(),
    reportId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch brand
    const brands = await ctx.runQuery(anyApi.brands.list, {});
    const brand = brands.find(
      (b: { _id: string }) => b._id === args.brandId
    ) as
      | {
          _id: string;
          name: string;
          logoUrl?: string;
          partnerEmails: string[];
        }
      | undefined;

    if (!brand) throw new Error("Brand not found");
    if (!brand.partnerEmails?.length) throw new Error("No partner emails");

    // 2. Fetch report
    const report = await ctx.runQuery(anyApi.reports.getReportById, {
      reportId: args.reportId,
    });
    if (!report) throw new Error("Report not found");

    const snapshot = report.snapshotData as {
      totalRevenueCents: number;
      totalVolume: number;
      highlights?: Array<{ url: string | null; caption: string }>;
    };

    // 3. Render email HTML
    const html = await renderQuarterlyEmail({
      brandName: brand.name,
      brandLogoUrl: brand.logoUrl ?? null,
      quarterLabel: formatQuarterLabel(report.periodStart as number),
      totalRevenueCents: snapshot.totalRevenueCents,
      totalVolume: snapshot.totalVolume,
      highlights: snapshot.highlights ?? [],
      reportUrl: `https://yourapp.vercel.app/partner/reports/${args.reportId}`,
      unsubscribeUrl: "https://yourapp.vercel.app/unsubscribe",
    });

    // 4. Send via Resend — if this throws, the notification record is NOT written
    const resend = new Resend(process.env.RESEND_API_KEY);
    const quarterLabel = formatQuarterLabel(report.periodStart as number);
    await resend.emails.send({
      from: "reports@spiritedunion.com",
      to: brand.partnerEmails,
      subject: `Your ${quarterLabel} Report is Ready`,
      html,
    });

    // 5. Write notifications record
    await ctx.runMutation(anyApi.notifications.insertNotification, {
      brandId: args.brandId,
      type: "quarterly",
      reportId: args.reportId,
    });
  },
});

// ─── Query: deduplication check ─────────────────────────────────────────────

export const getExistingNotification = query({
  args: {
    brandId: v.string(),
    type: v.string(),
    periodStart: v.number(),
  },
  handler: async (ctx, args) => {
    // periodEnd is defined as periodStart + the period's duration (31 days covers any month)
    const periodEnd = args.periodStart + 31 * 24 * 60 * 60 * 1000;
    return ctx.db
      .query("notifications")
      .withIndex("by_brandId", (q) =>
        q.eq("brandId", args.brandId as unknown as BrandId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), args.type),
          q.gte(q.field("sentAt"), args.periodStart),
          q.lt(q.field("sentAt"), periodEnd)
        )
      )
      .first();
  },
});

// ─── Helpers: compute period starts from a given timestamp ──────────────────

function getMonthStart(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function getQuarterStart(ts: number): number {
  const d = new Date(ts);
  const quarterStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return Date.UTC(d.getUTCFullYear(), quarterStartMonth, 1);
}

// ─── Action: orchestrate monthly notifications for all brands ─────────────

export const triggerMonthly = action({
  args: {},
  handler: async (ctx, _args) => {
    const periodStart = getMonthStart(Date.now());

    const brands = (await ctx.runQuery(anyApi.brands.list, {})) as Array<{
      _id: string;
      name: string;
      logoUrl?: string;
      partnerEmails: string[];
    }>;

    for (const brand of brands) {
      try {
        // Deduplication: skip if already notified this period
        const existing = await ctx.runQuery(
          anyApi.notifications.getExistingNotification,
          { brandId: brand._id, type: "monthly", periodStart }
        );
        if (existing) continue;

        // Generate (or retrieve existing) snapshot
        const reportId = (await ctx.runAction(
          anyApi.reports.generateSnapshot,
          { brandId: brand._id, period: "monthly", periodStart }
        )) as string;

        // Send email — errors here do not affect other brands
        try {
          await ctx.runAction(anyApi.notifications.sendMonthlyEmail, {
            brandId: brand._id,
            reportId,
          });
        } catch (emailErr) {
          console.error(
            `[triggerMonthly] email failed for brand ${brand._id}:`,
            emailErr
          );
        }
      } catch (err) {
        console.error(
          `[triggerMonthly] snapshot failed for brand ${brand._id}:`,
          err
        );
      }
    }
  },
});

// ─── Action: orchestrate quarterly notifications for all brands ───────────

export const triggerQuarterly = action({
  args: {},
  handler: async (ctx, _args) => {
    const periodStart = getQuarterStart(Date.now());

    const brands = (await ctx.runQuery(anyApi.brands.list, {})) as Array<{
      _id: string;
      name: string;
      logoUrl?: string;
      partnerEmails: string[];
    }>;

    for (const brand of brands) {
      try {
        // Deduplication: skip if already notified this period
        const existing = await ctx.runQuery(
          anyApi.notifications.getExistingNotification,
          { brandId: brand._id, type: "quarterly", periodStart }
        );
        if (existing) continue;

        // Generate (or retrieve existing) snapshot
        const reportId = (await ctx.runAction(
          anyApi.reports.generateSnapshot,
          { brandId: brand._id, period: "quarterly", periodStart }
        )) as string;

        // Send email — errors here do not affect other brands
        try {
          await ctx.runAction(anyApi.notifications.sendQuarterlyEmail, {
            brandId: brand._id,
            reportId,
          });
        } catch (emailErr) {
          console.error(
            `[triggerQuarterly] email failed for brand ${brand._id}:`,
            emailErr
          );
        }
      } catch (err) {
        console.error(
          `[triggerQuarterly] snapshot failed for brand ${brand._id}:`,
          err
        );
      }
    }
  },
});
