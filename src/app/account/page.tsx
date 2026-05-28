"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useState } from "react";

type BrandActivity = {
  brandName: string;
  call: number;
  tasting: number;
  event: number;
  bartender_training: number;
};

function getWeekStart(offsetWeeks: number): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day; // days to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff - offsetWeeks * 7);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

function formatWeekLabel(weekStart: number): string {
  const date = new Date(weekStart);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function AccountPage() {
  const { isLoaded } = useUser();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = getWeekStart(weekOffset);
  const weekLabel = formatWeekLabel(weekStart);

  const activities = useQuery(
    anyApi.account.getMyActivities,
    isLoaded ? { weekStart } : "skip"
  ) as BrandActivity[] | undefined;

  // Summary totals
  const summary =
    activities && activities.length > 0
      ? activities.reduce(
          (acc, row) => ({
            call: acc.call + row.call,
            tasting: acc.tasting + row.tasting,
            event: acc.event + row.event,
            bartender_training: acc.bartender_training + row.bartender_training,
          }),
          { call: 0, tasting: 0, event: 0, bartender_training: 0 }
        )
      : null;

  return (
    <main className="flex flex-col gap-8 px-4 py-10 max-w-4xl mx-auto w-full">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your activity performance per brand.
        </p>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setWeekOffset((prev) => Math.min(prev + 1, 11))}
          disabled={weekOffset >= 11}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm font-medium min-w-[140px] text-center">
          Week of {weekLabel}
        </span>
        <button
          onClick={() => setWeekOffset((prev) => Math.max(prev - 1, 0))}
          disabled={weekOffset <= 0}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {/* Loading state */}
      {activities === undefined && (
        <div className="h-48 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
      )}

      {/* Empty state */}
      {activities !== undefined && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No activities recorded for week of {weekLabel}
          </p>
        </div>
      )}

      {/* Activity table */}
      {activities !== undefined && activities.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-right font-medium">Calls</th>
                <th className="px-4 py-3 text-right font-medium">Tastings</th>
                <th className="px-4 py-3 text-right font-medium">Events</th>
                <th className="px-4 py-3 text-right font-medium">Bartender Trainings</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((row) => {
                const total =
                  row.call + row.tasting + row.event + row.bartender_training;
                return (
                  <tr
                    key={row.brandName}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium">{row.brandName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.call}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.tasting}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.event}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.bartender_training}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{total}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary row */}
            {summary && (
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{summary.call}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{summary.tasting}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{summary.event}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{summary.bartender_training}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {summary.call + summary.tasting + summary.event + summary.bartender_training}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </main>
  );
}
