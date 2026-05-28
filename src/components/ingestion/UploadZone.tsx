"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloudIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
const ACCEPTED_MIME_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export type DataSource = "exact" | "woocommerce" | "pipedrive" | "manual";

export interface UploadZoneProps {
  source: DataSource | null;
  onFileSelected: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number; // 0-100
  uploadedFileName?: string | null;
  error?: string | null;
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
    name.endsWith(ext)
  );
  const hasValidMime =
    ACCEPTED_MIME_TYPES.includes(file.type) || file.type === "";

  // Validate by extension first (most reliable), fall back to MIME
  if (!hasValidExtension) {
    return "Only CSV and Excel files are accepted";
  }

  // If extension is valid but MIME type is explicitly wrong (non-empty and not in list), reject
  if (file.type !== "" && !hasValidMime) {
    return "Only CSV and Excel files are accepted";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "File exceeds the 20 MB size limit";
  }

  return null;
}

export function UploadZone({
  source,
  onFileSelected,
  isUploading = false,
  uploadProgress = 0,
  uploadedFileName = null,
  error = null,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error ?? localError;
  const isSuccess = !!uploadedFileName && !isUploading && !displayError;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const validationError = validateFile(file);
      if (validationError) {
        setLocalError(validationError);
        return;
      }
      setLocalError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isUploading) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so the same file can be re-selected after an error
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-disabled={isUploading}
        aria-label="Upload file — click or drag and drop"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          // Idle / default
          "border-border bg-muted/30 hover:bg-muted/50 hover:border-ring/50",
          // Drag-over highlight
          isDragOver && "border-ring bg-accent/40",
          // Uploading — non-interactive
          isUploading && "pointer-events-none cursor-not-allowed opacity-60",
          // Success
          isSuccess && "border-green-500/40 bg-green-50/40 dark:bg-green-950/20",
          // Error
          displayError &&
            !isSuccess &&
            "border-destructive/40 bg-destructive/5"
        )}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Icon */}
        {isSuccess ? (
          <CheckCircle2Icon className="size-10 text-green-500" />
        ) : displayError ? (
          <XCircleIcon className="size-10 text-destructive" />
        ) : (
          <UploadCloudIcon
            className={cn(
              "size-10 text-muted-foreground",
              isDragOver && "text-foreground"
            )}
          />
        )}

        {/* Status text */}
        {isSuccess ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Upload successful
            </p>
            <p className="text-xs text-muted-foreground break-all">
              {uploadedFileName}
            </p>
          </div>
        ) : displayError ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-destructive">
              {displayError}
            </p>
            <p className="text-xs text-muted-foreground">
              Click or drag to try again
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {isDragOver
                ? "Release to upload"
                : "Drag & drop or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              CSV or Excel files only — max 20 MB
            </p>
          </div>
        )}
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            Uploading… {Math.round(uploadProgress)}%
          </p>
          <Progress value={uploadProgress} max={100} />
        </div>
      )}
    </div>
  );
}
