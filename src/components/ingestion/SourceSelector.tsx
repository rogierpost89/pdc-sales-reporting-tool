"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
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
  brandId: string | null;
  onBrandChange: (brandId: string) => void;
}

export function SourceSelector({ value, onChange, brandId, onBrandChange }: SourceSelectorProps) {
  const brands = useQuery(anyApi.brands.list) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* source selector */}
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

      {/* brand picker */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="brand-select">Brand</Label>
        <Select
          value={brandId ?? undefined}
          onValueChange={(v) => { if (v) onBrandChange(v); }}
        >
          <SelectTrigger id="brand-select" className="w-64">
            <SelectValue placeholder="Select a brand…" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b: { _id: string; name: string }) => (
              <SelectItem key={b._id} value={b._id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
