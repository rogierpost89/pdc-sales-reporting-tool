"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Period = "30d" | "90d" | "all";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
];

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

export default function PartnerPage() {
  const [period, setPeriod] = useState<Period>("30d");

  const metrics = useQuery(anyApi.partner.getBrandMetrics, { period }) as
    | {
        totalRevenueCents: number;
        totalVolume: number;
        channelBreakdown: Array<{
          channel: string;
          volume: number;
          revenueCents: number;
        }>;
        channelBreakdownMap: Record<string, { revenue: number; volume: number }>;
        activitySummary: {
          call: number;
          tasting: number;
          event: number;
          bartender_training: number;
        };
      }
    | undefined;

  return (
    <main className="flex flex-col gap-8 px-4 py-10 max-w-4xl mx-auto w-full">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Brand Partner Portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your brand&apos;s sales performance and activity summary.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-foreground text-background"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      {metrics !== undefined ? (
        <MetricCards
          totalRevenueCents={metrics.totalRevenueCents}
          totalVolume={metrics.totalVolume}
          channelBreakdown={metrics.channelBreakdownMap}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10"
            />
          ))}
        </div>
      )}

      {/* Channel breakdown table */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium">Channel Breakdown</h2>
        {metrics === undefined ? (
          <div className="h-32 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
        ) : metrics.channelBreakdown.length === 0 ? (
          <div className="rounded-xl ring-1 ring-foreground/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No sales data for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-muted/30">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Channel
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Volume
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.channelBreakdown.map((row) => (
                  <tr
                    key={row.channel}
                    className="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 capitalize">{row.channel}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.volume.toLocaleString("nl-NL")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatRevenue(row.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity summary */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium">Activity Summary</h2>
        {metrics === undefined ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {metrics.activitySummary.call}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tastings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {metrics.activitySummary.tasting}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {metrics.activitySummary.event}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bartender Trainings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {metrics.activitySummary.bartender_training}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
