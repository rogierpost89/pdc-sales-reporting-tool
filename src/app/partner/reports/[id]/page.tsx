"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { ReportDocument } from "@/components/reports/ReportDocument";

export default function PartnerReportDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const reports = useQuery(anyApi.partner.getMyReports) as
    | Array<{
        _id: string;
        period: "weekly" | "monthly" | "quarterly" | "annual";
        periodStart: number;
        createdAt: number;
        snapshotData: {
          totalRevenueCents: number;
          totalVolume: number;
          channelBreakdown: Array<{
            channel: string;
            volume: number;
            revenueCents: number;
          }>;
          activitySummary: {
            call: number;
            tasting: number;
            event: number;
            bartender_training: number;
          };
          highlights: Array<{ url: string | null; caption: string }>;
        };
        brandName: string;
        brandLogoUrl: string | null;
      }>
    | undefined;

  const report = reports?.find((r) => r._id === id);

  return (
    <>
      {/* Navigation — hidden on print */}
      <div className="print:hidden flex items-center justify-between px-4 py-4 max-w-4xl mx-auto w-full gap-4">
        <Link
          href="/partner/reports"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to reports
        </Link>
        {report && (
          <button
            onClick={() => window.print()}
            className="print:hidden rounded-lg px-4 py-2 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Save as PDF
          </button>
        )}
      </div>

      {/* Report content */}
      <div className="px-4 pb-10">
        {reports === undefined ? (
          <div className="max-w-4xl mx-auto mt-8 h-96 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
        ) : !report ? (
          <div className="max-w-4xl mx-auto mt-8 rounded-xl ring-1 ring-foreground/10 px-4 py-12 text-center text-sm text-muted-foreground">
            Report not found.
          </div>
        ) : (
          <ReportDocument
            snapshotData={report.snapshotData}
            brandName={report.brandName}
            brandLogoUrl={report.brandLogoUrl}
            period={report.period}
            periodStart={report.periodStart}
          />
        )}
      </div>
    </>
  );
}
