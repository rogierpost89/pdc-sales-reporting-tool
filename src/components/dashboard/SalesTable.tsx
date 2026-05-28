"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, records.length);
  const paginatedRecords = records.slice(start, end);

  return (
    <div className="space-y-3">
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
              paginatedRecords.map((record) => (
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

      {records.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            Showing {start + 1}–{end} of {records.length} records
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
