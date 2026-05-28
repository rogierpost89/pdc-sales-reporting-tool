"use client";

import { useState } from "react";
import { SourceSelector, type DataSource } from "@/components/ingestion/SourceSelector";
import { UploadZone } from "@/components/ingestion/UploadZone";

export default function UploadPage() {
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function handleFileSelected(file: File) {
    // Real upload to Convex storage is handled in ticket #14.
    // For now, log the file and record the filename for success display.
    console.log("[UploadPage] file selected:", file.name, file.size, "bytes", "source:", selectedSource);
    setUploadedFileName(file.name);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-8 px-4 py-12 md:py-20">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a data source and upload a CSV or Excel file for ingestion.
          </p>
        </div>

        {/* Step 1 — source selector */}
        <SourceSelector value={selectedSource} onChange={(v) => {
          setSelectedSource(v);
          // Reset success state when source changes
          setUploadedFileName(null);
        }} />

        {/* Step 2 — upload zone, shown only when a source is selected */}
        {selectedSource && (
          <UploadZone
            source={selectedSource}
            onFileSelected={handleFileSelected}
            uploadedFileName={uploadedFileName}
          />
        )}
      </div>
    </main>
  );
}
