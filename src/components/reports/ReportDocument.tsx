import "./ReportDocument.print.css";

interface SnapshotData {
  totalRevenueCents: number;
  totalVolume: number;
  channelBreakdown: Array<{ channel: string; volume: number; revenueCents: number }>;
  activitySummary: { call: number; tasting: number; event: number; bartender_training: number };
  highlights: Array<{ url: string | null; caption: string }>;
}

interface ReportDocumentProps {
  snapshotData: SnapshotData;
  brandName: string;
  brandLogoUrl: string | null;
  period: "weekly" | "monthly" | "quarterly" | "annual";
  periodStart: number; // Unix ms
}

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

function formatPeriodLabel(period: string, periodStart: number): string {
  const date = new Date(periodStart);
  const month = date.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const labels: Record<string, string> = {
    weekly: `Week of ${date.toLocaleDateString("en-GB")}`,
    monthly: month,
    quarterly: `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`,
    annual: `${date.getFullYear()} Annual Report`,
  };
  return labels[period as keyof typeof labels] ?? period;
}

function formatGeneratedDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReportDocument({
  snapshotData,
  brandName,
  brandLogoUrl,
  period,
  periodStart,
}: ReportDocumentProps) {
  const { totalRevenueCents, totalVolume, channelBreakdown, activitySummary, highlights } =
    snapshotData;

  const generatedDate = formatGeneratedDate(Date.now());
  const periodLabel = formatPeriodLabel(period, periodStart);
  const visibleHighlights = highlights.slice(0, 6);

  return (
    <div id="report-document" className="max-w-4xl mx-auto p-8 bg-white">
      {/* Header */}
      <header className="flex justify-between items-start mb-8">
        <div>
          <span className="font-bold text-xl tracking-wide">SPIRITED UNION</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt={brandName} className="h-12 object-contain" />
          ) : (
            <div className="h-12 w-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
              {brandName}
            </div>
          )}
        </div>

        <div className="text-right text-sm text-gray-600">
          <p className="font-semibold text-gray-800">{periodLabel}</p>
          <p>Generated: {generatedDate}</p>
        </div>
      </header>

      {/* Sales Summary */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Sales Summary</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatRevenue(totalRevenueCents)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500 mb-1">Total Volume</p>
            <p className="text-2xl font-semibold tabular-nums">
              {totalVolume.toLocaleString("nl-NL")} units
            </p>
          </div>
        </div>

        {channelBreakdown.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-700">Channel</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-700">Volume</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {channelBreakdown.map((row) => (
                  <tr key={row.channel} className="border-b last:border-0">
                    <td className="px-4 py-2.5">{row.channel}</td>
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
      </section>

      {/* Activity Summary */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Activity Summary</h2>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{activitySummary.call}</p>
            <p className="text-sm text-gray-500 mt-1">Calls</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{activitySummary.tasting}</p>
            <p className="text-sm text-gray-500 mt-1">Tastings</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{activitySummary.event}</p>
            <p className="text-sm text-gray-500 mt-1">Events</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">
              {activitySummary.bartender_training}
            </p>
            <p className="text-sm text-gray-500 mt-1">Bartender Trainings</p>
          </div>
        </div>
      </section>

      {/* Highlights from the Field */}
      {visibleHighlights.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Highlights from the Field</h2>

          <div className="grid grid-cols-3 gap-4">
            {visibleHighlights.map((highlight, index) => (
              <div key={index} className="flex flex-col gap-2">
                {highlight.url ? (
                  <img
                    src={highlight.url}
                    alt={highlight.caption}
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
                    No image
                  </div>
                )}
                {highlight.caption && (
                  <p className="text-xs text-gray-600">{highlight.caption}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t pt-4 text-sm text-gray-500">
        Confidential — prepared for {brandName} · {generatedDate}
      </footer>
    </div>
  );
}
