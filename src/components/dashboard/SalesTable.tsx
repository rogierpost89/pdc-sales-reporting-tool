"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SalesRecord {
  _id: string;
  date: number;
  brandId: string;
  brandName: string;
  sku: string;
  channel: string;
  volume: number;
  revenueCents: number;
}

interface SalesTableProps {
  records: SalesRecord[];
  brandMap: Record<string, string>;
}

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SalesTable({ records }: SalesTableProps) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                No records match the current filters
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record._id}>
                <TableCell>{formatDate(record.date)}</TableCell>
                <TableCell>{record.brandName}</TableCell>
                <TableCell className="font-mono text-xs">{record.sku}</TableCell>
                <TableCell>{record.channel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {record.volume.toLocaleString("nl-NL")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRevenue(record.revenueCents)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
