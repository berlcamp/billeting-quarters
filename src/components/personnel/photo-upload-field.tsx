"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPersonnelPhotoUrl,
  uploadPersonnelPhoto,
} from "@/lib/actions/personnel";
import { cn } from "@/lib/utils";

interface Props {
  /** Storage path persisted in personnel.photo_url. */
  value: string | undefined | null;
  onChange: (path: string | undefined) => void;
  disabled?: boolean;
}

// Single-photo avatar uploader for the personnel dialog. The form stores a
// storage path; we resolve a signed URL for preview when editing an existing
// record, and use an object URL while a freshly-picked file is in flight.
export function PhotoUploadField({ value, onChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Resolve a signed URL when `value` is a stored path with no local preview.
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    if (objectUrlRef.current) {
      // We just uploaded — keep showing the local object URL until value changes.
      return;
    }
    setPreviewUrl(null);
    void getPersonnelPhotoUrl(value).then((res) => {
      if (cancelled) return;
      if (res.data) setPreviewUrl(res.data.url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // Revoke object URL on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const fd = new FormData();
      fd.append("file", compressed, compressed.name || file.name || "photo.jpg");
      const result = await uploadPersonnelPhoto(fd);
      if (result.error) {
        toast.error("Photo upload failed", { description: result.error });
        return;
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const localUrl = URL.createObjectURL(compressed);
      objectUrlRef.current = localUrl;
      setPreviewUrl(localUrl);
      onChange(result.data!.path);
    } catch (err) {
      toast.error("Photo processing failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  }

  function handleRemove() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    onChange(undefined);
  }

  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "relative size-24 shrink-0 overflow-hidden rounded-md border bg-muted/30",
          disabled && "opacity-50",
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Personnel photo preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <User className="size-10" />
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleInputChange}
          disabled={disabled || busy}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            <Camera className="size-4" />
            {previewUrl ? "Replace photo" : "Upload photo"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || busy}
            >
              <X className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Square or portrait works best. Auto-compressed to ~0.5MB.
        </p>
      </div>
    </div>
  );
}
