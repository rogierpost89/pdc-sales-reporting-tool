"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { GenericId } from "convex/values";

interface StageRow {
  stage: string;
  count: number;
  totalValueCents: number;
}

interface DealsResult {
  totalDeals: number;
  totalPipelineValueCents: number;
  stages: StageRow[];
}

interface DealsPanelProps {
  brandId?: string;
}

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function DealsPanel({ brandId }: DealsPanelProps) {
  const deals = useQuery(anyApi.dashboard.getDeals, {
    brandId: brandId as GenericId<"brands"> | undefined,
  }) as DealsResult | undefined;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium">Pipeline Overview</h2>
      {deals === undefined ? (
        <div className="h-32 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
      ) : deals.totalDeals === 0 ? (
        <div className="rounded-xl ring-1 ring-foreground/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No deals found
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Summary row */}
          <div className="flex flex-wrap gap-6 rounded-xl bg-muted/30 ring-1 ring-foreground/10 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Deals</span>
              <span className="text-lg font-semibold tabular-nums">{deals.totalDeals}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Pipeline Value</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatEuros(deals.totalPipelineValueCents)}
              </span>
            </div>
          </div>

          {/* Stage breakdown table */}
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-muted/30">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Stage</th>
                  <th className="px-4 py-2.5 text-right font-medium">Deals</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pipeline Value (€)</th>
                </tr>
              </thead>
              <tbody>
                {deals.stages.map((row) => (
                  <tr
                    key={row.stage}
                    className="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 capitalize">{row.stage}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatEuros(row.totalValueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
