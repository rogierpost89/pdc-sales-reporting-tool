"use client";

import { useState, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { anyApi } from "convex/server";
import { SourceSelector, type DataSource } from "@/components/ingestion/SourceSelector";
import { UploadZone } from "@/components/ingestion/UploadZone";

export default function UploadPage() {
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(anyApi.ingestion.generateUploadUrl);
  const createUpload = useMutation(anyApi.ingestion.createUpload);
  const runIngestionAgent = useAction(anyApi.ingestion.runIngestionAgent);

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!selectedSource || !selectedBrandId) return;

      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setUploadedFileName(null);

      try {
        // Step 1: Get a pre-signed upload URL from Convex
        setUploadProgress(10);
        const uploadUrl = await generateUploadUrl();

        // Step 2: Upload the file directly to Convex storage
        setUploadProgress(30);
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
        }

        const { storageId } = await uploadResponse.json() as { storageId: string };
        setUploadProgress(60);

        // Step 3: Create the uploads record in Convex DB
        const uploadId = await createUpload({
          storageId: storageId as Parameters<typeof createUpload>[0]["storageId"],
          source: selectedSource,
          brandId: selectedBrandId,
        });
        setUploadProgress(75);

        // Step 4: Dispatch the ingestion agent
        await runIngestionAgent({
          uploadId,
          storageId: storageId as Parameters<typeof runIngestionAgent>[0]["storageId"],
          source: selectedSource,
          brandId: selectedBrandId,
        });

        setUploadProgress(100);
        setUploadedFileName(file.name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed — please try again.";
        setUploadError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [selectedSource, selectedBrandId, generateUploadUrl, createUpload, runIngestionAgent]
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-8 px-4 py-12 md:py-20">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a data source and brand, then upload a CSV or Excel file for ingestion.
          </p>
        </div>

        {/* Step 1 — source and brand selectors */}
        <SourceSelector
          value={selectedSource}
          onChange={(v) => {
            setSelectedSource(v);
            // Reset state when source changes
            setSelectedBrandId(null);
            setUploadedFileName(null);
            setUploadError(null);
            setUploadProgress(0);
          }}
          brandId={selectedBrandId}
          onBrandChange={setSelectedBrandId}
        />

        {/* Step 2 — upload zone, shown only when both source and brand are selected */}
        {selectedSource && selectedBrandId && (
          <UploadZone
            source={selectedSource}
            onFileSelected={handleFileSelected}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadedFileName={uploadedFileName}
            error={uploadError}
          />
        )}
      </div>
    </main>
  );
}
