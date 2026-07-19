"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, Camera, X, GripVertical, Star, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedImage {
  id: string;
  /** Public R2 URL — what we render with next/image. */
  url: string;
  /**
   * R2 object key for images that have finished uploading. Local-only entries
   * (mock products imported from the legacy CloudFront catalogue) leave this
   * blank — the parent passes `url` straight through to persistence in that
   * case.
   */
  key?: string;
  alt?: string;
  /** True when this is the primary product image. */
  primary?: boolean;
  /** Upload progress 0–100 (omit when settled). */
  progress?: number;
  /** Set when the upload failed; clears on retry. */
  error?: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Used by the upload route to scope the R2 key. Pass the slug for products. */
  scopeId?: string;
  scope?: "product" | "return" | "content";
  max?: number;
  className?: string;
}

/**
 * Shrink + re-encode a photo in the browser BEFORE upload. Vercel caps
 * serverless request bodies at ~4.5 MB, so a raw phone photo (often 4–12 MB) is
 * rejected with 413 FUNCTION_PAYLOAD_TOO_LARGE before our route ever runs.
 * Re-drawing to ≤2000px WebP keeps every upload well under the limit — and the
 * server still re-encodes + strips EXIF as a second pass. Falls back to the
 * original file whenever the browser can't decode/encode it (old browser, HEIC,
 * …) so we never block an upload that might otherwise have worked.
 */
async function downscaleImage(
  file: File,
  maxEdge = 2000,
  quality = 0.82,
): Promise<File> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined" ||
    !/^image\/(jpe?g|png|webp)$/i.test(file.type)
  ) {
    return file;
  }
  // Already small — not worth re-encoding.
  if (file.size < 1_500_000) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^/.]+$/, "") || "photo";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

/** Multi-image uploader. Streams each file through /api/v1/admin/upload, which
 *  EXIF-strips + re-encodes to WebP and stores it on R2. The component owns
 *  the optimistic UI; the URL it shows after success is the real R2 URL. */
export function ImageUploader({
  images,
  onChange,
  scopeId,
  scope = "product",
  max = 8,
  className,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  // Keep latest `images` reachable inside async upload callbacks so we don't
  // overwrite each other when multiple uploads finish near-simultaneously.
  const imagesRef = React.useRef(images);
  React.useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  function pick() {
    inputRef.current?.click();
  }

  function takePhoto() {
    cameraRef.current?.click();
  }

  function patch(id: string, p: Partial<UploadedImage>) {
    const next = imagesRef.current.map((i) => (i.id === id ? { ...i, ...p } : i));
    imagesRef.current = next;
    onChange(next);
  }

  /** Strip the `progress` field entirely (exactOptionalPropertyTypes won't
   *  let us set it to undefined). Optionally apply additional patch fields. */
  function finishUpload(id: string, p: Partial<UploadedImage> = {}) {
    const next = imagesRef.current.map((i) => {
      if (i.id !== id) return i;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { progress, error, ...rest } = i;
      return { ...rest, ...p };
    });
    imagesRef.current = next;
    onChange(next);
  }

  function removeById(id: string) {
    const next = imagesRef.current.filter((i) => i.id !== id);
    imagesRef.current = next;
    onChange(next);
  }

  async function uploadOne(file: File) {
    const tempId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const pending: UploadedImage = {
      id: tempId,
      url: previewUrl,
      alt: file.name.replace(/\.[^/.]+$/, ""),
      progress: 5,
    };
    const next = [...imagesRef.current, pending].slice(0, max);
    imagesRef.current = next;
    onChange(next);

    try {
      // Shrink big photos in the browser first so the payload clears Vercel's
      // ~4.5 MB serverless body limit (else the platform 413s before our route
      // runs). The server re-encodes + strips EXIF as a second pass regardless.
      const prepared = await downscaleImage(file);

      const form = new FormData();
      form.append("file", prepared);
      form.append("scope", scope);
      if (scopeId) form.append("scopeId", scopeId);

      const res = await fetch("/api/v1/admin/upload", {
        method: "POST",
        body: form,
      });

      // Our route replies JSON, but a platform-level rejection (e.g. 413
      // FUNCTION_PAYLOAD_TOO_LARGE) is plain text — parse defensively so a
      // failed upload surfaces a clear message instead of throwing.
      const raw = await res.text();
      let json:
        | { data?: { publicUrl: string; key: string }; error?: { message?: string } }
        | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }

      URL.revokeObjectURL(previewUrl);

      if (!res.ok || !json?.data) {
        finishUpload(tempId, {
          error:
            json?.error?.message ??
            (res.status === 413
              ? "Image is too large — please use a smaller photo"
              : `Upload failed (${res.status})`),
        });
        return;
      }

      finishUpload(tempId, {
        url: json.data.publicUrl,
        key: json.data.key,
      });
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      finishUpload(tempId, {
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    // Respect the cap — refuse extras silently rather than partially attempt.
    const slots = Math.max(0, max - imagesRef.current.length);
    const toUpload = files.slice(0, slots);

    // Parallel — typical product photo lands under 1MB after re-encode.
    await Promise.all(toUpload.map((f) => uploadOne(f)));
  }

  function setPrimary(id: string) {
    onChange(images.map((i) => ({ ...i, primary: i.id === id })));
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
        {images.map((img) => {
          const pending = img.progress != null;
          return (
            <div
              key={img.id}
              className={cn(
                "relative aspect-square rounded-md overflow-hidden border-2 group",
                img.primary
                  ? "border-brand-primary"
                  : img.error
                    ? "border-danger"
                    : "border-border",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? ""}
                fill
                sizes="200px"
                className="object-cover"
                unoptimized={img.url.startsWith("blob:")}
              />
              {pending && (
                <div className="absolute inset-0 bg-fg/50 flex items-center justify-center text-white text-xs font-bold">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 bg-danger/80 flex flex-col items-center justify-center text-white text-[10px] font-bold px-1.5 text-center gap-1">
                  <AlertCircle className="size-4" />
                  <span>{img.error}</span>
                </div>
              )}
              {!pending && (
                <div className="absolute inset-0 bg-fg/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-between p-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPrimary(img.id)}
                      aria-label={img.primary ? "Primary image" : "Set as primary"}
                      className="size-7 rounded-md bg-white/95 text-fg flex items-center justify-center hover:bg-white"
                    >
                      <Star
                        className={cn("size-3.5", img.primary && "fill-warning text-warning")}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeById(img.id)}
                      aria-label="Remove"
                      className="size-7 rounded-md bg-white/95 text-danger flex items-center justify-center hover:bg-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-white text-[10px] font-semibold inline-flex items-center gap-1">
                    <GripVertical className="size-3" /> drag to reorder
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {images.length < max && (
          <button
            type="button"
            onClick={pick}
            className="aspect-square rounded-md border-2 border-dashed border-border-strong text-fg-muted hover:border-brand-primary hover:text-brand-primary hover:bg-info-bg flex flex-col items-center justify-center gap-1.5"
          >
            <Upload className="size-5" />
            <span className="text-[11px] font-semibold">Upload</span>
            <span className="text-[10px] text-fg-subtle">
              {images.length}/{max}
            </span>
          </button>
        )}

        {images.length < max && (
          <button
            type="button"
            onClick={takePhoto}
            className="aspect-square rounded-md border-2 border-dashed border-border-strong text-fg-muted hover:border-brand-primary hover:text-brand-primary hover:bg-info-bg flex flex-col items-center justify-center gap-1.5"
          >
            <Camera className="size-5" />
            <span className="text-[11px] font-semibold">Take photo</span>
            <span className="text-[10px] text-fg-subtle">camera</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      {/* Opens the rear camera directly on mobile; a normal file dialog on
          desktop. Photos flow through the same upload pipeline. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFiles}
      />
      <p className="text-[11px] text-fg-subtle mt-2">
        JPEG, PNG, WebP · up to 8 MB each · auto-converted to WebP · first image is the primary by default
      </p>
    </div>
  );
}
