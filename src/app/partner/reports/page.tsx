"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

function formatPeriod(period: string, periodStart: number): string {
  const d = new Date(periodStart);
  if (period === "weekly") return `Week of ${d.toLocaleDateString("en-GB")}`;
  if (period === "monthly")
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  if (period === "quarterly")
    return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
  return `${d.getFullYear()} Annual`;
}

function formatCreatedDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const PERIOD_BADGE_COLOURS: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-800",
  monthly: "bg-green-100 text-green-800",
  quarterly: "bg-purple-100 text-purple-800",
  annual: "bg-orange-100 text-orange-800",
};

export default function PartnerReportsPage() {
  const reports = useQuery(anyApi.partner.getMyReports) as
    | Array<{
        _id: string;
        period: "weekly" | "monthly" | "quarterly" | "annual";
        periodStart: number;
        createdAt: number;
        snapshotData: unknown;
        brandName: string;
        brandLogoUrl: string | null;
      }>
    | undefined;

  return (
    <main className="flex flex-col gap-8 px-4 py-10 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Link
          href="/partner"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Your brand&apos;s generated sales reports.
        </p>
      </div>

      {/* Reports list */}
      {reports === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10"
            />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl ring-1 ring-foreground/10 px-4 py-12 text-center text-sm text-muted-foreground">
          No reports available yet
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Link
              key={r._id}
              href={`/partner/reports/${r._id}`}
              className="group flex items-center justify-between rounded-xl px-5 py-4 ring-1 ring-foreground/10 hover:ring-foreground/25 hover:bg-muted/20 transition-all"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm group-hover:text-foreground transition-colors">
                  {formatPeriod(r.period, r.periodStart)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Generated {formatCreatedDate(r.createdAt)}
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  PERIOD_BADGE_COLOURS[r.period] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {r.period}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
