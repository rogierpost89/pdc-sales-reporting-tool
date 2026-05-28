"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { GenericId } from "convex/values";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { SalesTable } from "@/components/dashboard/SalesTable";
import { ActivityPanel } from "@/components/dashboard/ActivityPanel";
import { DealsPanel } from "@/components/dashboard/DealsPanel";

const PERIODS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const brandIdParam = searchParams.get("brandId") ?? undefined;
  const periodParam = searchParams.get("period") ?? "all";

  const brands = useQuery(anyApi.brands.list) as Array<{ _id: string; name: string }> | undefined;
  const metrics = useQuery(anyApi.dashboard.getSalesMetrics, {
    brandId: brandIdParam as GenericId<"brands"> | undefined,
    period: periodParam,
  }) as {
    totalRevenueCents: number;
    totalVolume: number;
    channelBreakdown: Record<string, { revenue: number; volume: number }>;
    brandBreakdown: Record<string, { revenue: number; volume: number; name: string }>;
    records: Array<{
      _id: string;
      date: number;
      brandId: string;
      brandName: string;
      sku: string;
      channel: string;
      volume: number;
      revenueCents: number;
    }>;
    brandMap: Record<string, string>;
  } | undefined;

  function setParam(key: string, value: string | null | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <main className="flex flex-col gap-8 px-4 py-10 max-w-6xl mx-auto w-full">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated sales metrics across all brands.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <Select
            value={brandIdParam ?? ""}
            onValueChange={(v) => setParam("brandId", v || undefined)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All brands</SelectItem>
              {brands?.map((brand) => (
                <SelectItem key={brand._id} value={brand._id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Period</Label>
          <Select
            value={periodParam}
            onValueChange={(v) => setParam("period", v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric cards */}
      {metrics !== undefined ? (
        <MetricCards
          totalRevenueCents={metrics.totalRevenueCents}
          totalVolume={metrics.totalVolume}
          channelBreakdown={metrics.channelBreakdown}
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

      {/* Sales table */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium">Records</h2>
        {metrics !== undefined ? (
          <SalesTable
            records={metrics.records}
            brandMap={metrics.brandMap}
          />
        ) : (
          <div className="h-48 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
        )}
      </div>

      {/* Activity panel */}
      <ActivityPanel brandId={brandIdParam ?? undefined} />

      {/* Deals panel */}
      <DealsPanel brandId={brandIdParam ?? undefined} />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
