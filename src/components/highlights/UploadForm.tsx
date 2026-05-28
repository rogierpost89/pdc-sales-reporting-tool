"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type SuccessState = {
  previewUrl: string;
  caption: string;
};

export function UploadForm() {
  const { user } = useUser();
  const brands = useQuery(anyApi.brands.list);

  const [brandId, setBrandId] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(anyApi.ingestion.generateUploadUrl);
  const createHighlight = useMutation(anyApi.highlights.create);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    setUploadError(null);
    setSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setValidationError("Only JPEG, PNG, and WebP images are accepted.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError("File exceeds the 10 MB limit.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !selectedFile || !caption.trim() || !user) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Step 1: Get pre-signed upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
      }

      const { storageId } = (await uploadResponse.json()) as {
        storageId: string;
      };

      // Step 3: Create highlights record
      await createHighlight({
        brandId: brandId as Parameters<typeof createHighlight>[0]["brandId"],
        storageId:
          storageId as Parameters<typeof createHighlight>[0]["storageId"],
        caption: caption.trim(),
        uploadedBy: user.id,
      });

      // Step 4: Show success state
      setSuccess({ previewUrl: previewUrl!, caption: caption.trim() });

      // Reset form fields
      setBrandId("");
      setCaption("");
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed — please try again."
      );
    } finally {
      setIsUploading(false);
    }
  }

  const isSubmitDisabled =
    !brandId || !selectedFile || !caption.trim() || isUploading;

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload highlight
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share field activity photos tagged to a brand.
        </p>
      </div>

      {success ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={success.previewUrl}
              alt={success.caption}
              className="w-full max-h-64 object-cover"
            />
          </div>
          <p className="text-sm text-foreground">{success.caption}</p>
          <p className="text-sm text-green-600 font-medium">
            Highlight uploaded successfully.
          </p>
          <Button
            variant="outline"
            onClick={() => setSuccess(null)}
          >
            Upload another
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Brand selector */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-select">Brand</Label>
            <Select value={brandId} onValueChange={(v) => setBrandId(v ?? "")}>
              <SelectTrigger id="brand-select" className="w-full">
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands === undefined ? (
                  <SelectItem value="__loading" disabled>
                    Loading…
                  </SelectItem>
                ) : brands.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    No brands found
                  </SelectItem>
                ) : (
                  brands.map((brand: { _id: string; name: string }) => (
                    <SelectItem key={brand._id} value={brand._id}>
                      {brand.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Image file input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="highlight-image">Image</Label>
            <input
              ref={fileInputRef}
              id="highlight-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-fit"
            >
              {selectedFile ? selectedFile.name : "Choose image…"}
            </Button>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP — max 10 MB
            </p>
          </div>

          {/* Image preview */}
          {previewUrl && (
            <div className="rounded-lg border border-border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-48 object-cover"
              />
            </div>
          )}

          {/* Validation error */}
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          {/* Caption */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              type="text"
              placeholder="Describe the activity…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Upload error */}
          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isSubmitDisabled}>
            {isUploading ? "Uploading…" : "Upload highlight"}
          </Button>
        </form>
      )}
    </div>
  );
}
