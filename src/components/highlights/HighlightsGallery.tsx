"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { GenericId } from "convex/values";
import Link from "next/link";

// Grey placeholder as a 1x1 data URL
const GREY_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/OtXPQAIcANgBmMhKwAAAABJRU5ErkJggg==";

interface HighlightRecord {
  _id: string;
  brandId: string;
  fileId: string;
  caption: string;
  uploadedBy: string;
  date: number;
  url: string | null;
}

interface HighlightsGalleryProps {
  brandId: string; // Convex Id<"brands"> as string
  limit?: number;
  compact?: boolean;
  showUploadCta?: boolean; // true for admin/AM, false for partners
}

export function HighlightsGallery({
  brandId,
  limit,
  compact = false,
  showUploadCta = false,
}: HighlightsGalleryProps) {
  const effectiveLimit = compact ? 6 : (limit ?? 12);

  const highlights = useQuery(anyApi.highlights.getByBrand, {
    brandId: brandId as GenericId<"brands">,
    limit: effectiveLimit,
  }) as HighlightRecord[] | undefined;

  if (highlights === undefined) {
    // Loading skeleton
    return (
      <div
        className={
          compact
            ? "grid grid-cols-3 gap-2"
            : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        }
      >
        {Array.from({ length: compact ? 6 : 3 }).map((_, i) => (
          <div
            key={i}
            className={`bg-muted rounded animate-pulse ${compact ? "aspect-square" : "aspect-video"}`}
          />
        ))}
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 py-4">
        <p className="text-sm text-muted-foreground">No highlights yet.</p>
        {showUploadCta && (
          <Link
            href="/highlights/upload"
            className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Upload a highlight
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "grid grid-cols-3 gap-2"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      }
    >
      {highlights.map((highlight) => (
        <HighlightItem
          key={highlight._id}
          url={highlight.url}
          caption={highlight.caption}
          compact={compact}
        />
      ))}
    </div>
  );
}

interface HighlightItemProps {
  url: string | null;
  caption: string;
  compact: boolean;
}

function HighlightItem({ url, caption, compact }: HighlightItemProps) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = GREY_PLACEHOLDER;
    e.currentTarget.className = compact
      ? "w-full aspect-square bg-muted object-cover"
      : "w-full aspect-video bg-muted object-cover";
  };

  return (
    <figure className="flex flex-col gap-1">
      <div
        className={`overflow-hidden rounded-md bg-muted ${compact ? "aspect-square" : "aspect-video"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url ?? GREY_PLACEHOLDER}
          alt={caption}
          onError={handleError}
          className="w-full h-full object-cover"
        />
      </div>
      {caption && (
        <figcaption
          className={`text-muted-foreground leading-snug ${compact ? "text-xs" : "text-sm"}`}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
