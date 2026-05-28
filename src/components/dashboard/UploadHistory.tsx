"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UploadStatus = "pending" | "processing" | "done" | "failed";

interface Upload {
  _id: string;
  _creationTime: number;
  source: string;
  status: UploadStatus;
  agentUsed?: string;
  parsedAt?: number;
}

const badgeClass: Record<UploadStatus, string> = {
  done: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  processing: "bg-yellow-100 text-yellow-800",
  pending: "bg-gray-100 text-gray-800",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExpandedContent({ upload }: { upload: Upload }) {
  if (upload.status === "done") {
    return (
      <p className="text-sm text-muted-foreground">
        {upload.agentUsed ? `Agent: ${upload.agentUsed}` : "No agent recorded"}
        {upload.parsedAt ? `. Parsed at: ${formatDate(upload.parsedAt)}` : ""}
      </p>
    );
  }
  if (upload.status === "failed") {
    return (
      <p className="text-sm text-muted-foreground">
        Raw file preserved.{" "}
        {upload.agentUsed ? `Agent: ${upload.agentUsed}` : "No agent summary available."}
      </p>
    );
  }
  if (upload.status === "processing") {
    return <p className="text-sm text-muted-foreground">Processing…</p>;
  }
  // pending
  return <p className="text-sm text-muted-foreground">Awaiting processing.</p>;
}

export function UploadHistory() {
  const uploads = useQuery(anyApi.dashboard.getUploads) as Upload[] | undefined;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium">Upload History</h2>

      {uploads === undefined ? (
        <div className="h-32 rounded-xl bg-muted/40 animate-pulse ring-1 ring-foreground/10" />
      ) : uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No uploads yet.</p>
      ) : (
        <div className="rounded-xl border ring-1 ring-foreground/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uploaded At</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agent Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <>
                  <TableRow
                    key={upload._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpandedId(expandedId === upload._id ? null : upload._id)
                    }
                  >
                    <TableCell className="text-sm">
                      {formatDate(upload._creationTime)}
                    </TableCell>
                    <TableCell className="text-sm">{upload.source}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={badgeClass[upload.status]}
                      >
                        {upload.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {upload.agentUsed ?? "—"}
                    </TableCell>
                  </TableRow>
                  {expandedId === upload._id && (
                    <TableRow key={`${upload._id}-expanded`}>
                      <TableCell colSpan={4} className="bg-muted/30 px-4 py-3">
                        <ExpandedContent upload={upload} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
