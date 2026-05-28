"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DataSource = "exact" | "woocommerce" | "pipedrive" | "manual";

const SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: "exact", label: "Exact Online" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "manual", label: "Manual" },
];

interface SourceSelectorProps {
  value: DataSource | null;
  onChange: (value: DataSource) => void;
}

export function SourceSelector({ value, onChange }: SourceSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="source-select">Data source</Label>
      <Select
        value={value ?? undefined}
        onValueChange={(v) => onChange(v as DataSource)}
      >
        <SelectTrigger id="source-select" className="w-64">
          <SelectValue placeholder="Select a source…" />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
