"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ChannelBreakdown {
  revenue: number;
  volume: number;
}

interface MetricCardsProps {
  totalRevenueCents: number;
  totalVolume: number;
  channelBreakdown: Record<string, ChannelBreakdown>;
}

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

function getTopChannel(channelBreakdown: Record<string, ChannelBreakdown>): string {
  const entries = Object.entries(channelBreakdown);
  if (entries.length === 0) return "—";
  const top = entries.reduce((best, curr) =>
    curr[1].revenue > best[1].revenue ? curr : best
  );
  return top[0];
}

export function MetricCards({
  totalRevenueCents,
  totalVolume,
  channelBreakdown,
}: MetricCardsProps) {
  const topChannel = getTopChannel(channelBreakdown);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {formatRevenue(totalRevenueCents)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {totalVolume.toLocaleString("nl-NL")} units
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{topChannel}</p>
        </CardContent>
      </Card>
    </div>
  );
}
