"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { GenericId } from "convex/values";

interface ActivityRow {
  brandId: string;
  brandName: string;
  call: number;
  tasting: number;
  event: number;
  bartender_training: number;
}

interface ActivityPanelProps {
  brandId?: string;
}

export function ActivityPanel({ brandId }: ActivityPanelProps) {
  const activities = useQuery(anyApi.dashboard.getActivities, {
    brandId: brandId as GenericId<"brands"> | undefined,
  }) as ActivityRow[] | undefined;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium">Activity Overview</h2>
      {activities === undefined ? (
        <div className="h-32 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
      ) : activities.length === 0 ? (
        <div className="rounded-xl ring-1 ring-foreground/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No activities found for the selected period
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-muted/30">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Brand</th>
                <th className="px-4 py-2.5 text-right font-medium">Calls</th>
                <th className="px-4 py-2.5 text-right font-medium">Tastings</th>
                <th className="px-4 py-2.5 text-right font-medium">Events</th>
                <th className="px-4 py-2.5 text-right font-medium">Bartender Trainings</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((row) => (
                <tr
                  key={row.brandId}
                  className="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5">{row.brandName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.call}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.tasting}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.event}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.bartender_training}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
