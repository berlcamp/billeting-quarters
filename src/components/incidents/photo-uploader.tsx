"use client";

import { useRef, useState, type ChangeEvent } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadIncidentPhoto } from "@/lib/actions/incidents";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 5;

export type UploadedPhoto = {
  path: string;
  previewUrl: string;
};

interface PhotoUploaderProps {
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  disabled?: boolean;
}

export function PhotoUploader({ value, onChange, disabled }: PhotoUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const filesArr = Array.from(files);
    if (filesArr.length === 0) return;

    const remaining = MAX_PHOTOS - value.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    const toUpload = filesArr.slice(0, remaining);
    if (filesArr.length > remaining) {
      toast.warning(`Only the first ${remaining} photo(s) will be uploaded.`);
    }

    setBusy(true);
    const newPhotos: UploadedPhoto[] = [];

    for (const file of toUpload) {
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 2000,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        const fd = new FormData();
        fd.append("file", compressed, compressed.name || file.name || "photo.jpg");
        const result = await uploadIncidentPhoto(fd);

        if (result.error) {
          toast.error("Photo upload failed", { description: result.error });
          continue;
        }

        newPhotos.push({
          path: result.data!.path,
          previewUrl: URL.createObjectURL(compressed),
        });
      } catch (err) {
        toast.error("Photo processing failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    setBusy(false);
    if (newPhotos.length > 0) {
      onChange([...value, ...newPhotos]);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void handleFiles(e.target.files);
      e.target.value = ""; // allow re-picking the same file
    }
  }

  function handleRemove(idx: number) {
    const next = value.slice();
    const [removed] = next.splice(idx, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  const atMax = value.length >= MAX_PHOTOS;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (disabled || atMax) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || atMax) return;
          if (e.dataTransfer.files.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-md border-2 border-dashed p-6 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-input bg-muted/20",
          (disabled || atMax) && "opacity-50 pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={handleInputChange}
          disabled={disabled || busy || atMax}
        />
        <div className="flex flex-col items-center gap-3">
          {busy ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="size-8 text-muted-foreground" />
          )}
          <div className="text-sm text-muted-foreground">
            {atMax ? (
              <>Maximum {MAX_PHOTOS} photos reached.</>
            ) : busy ? (
              <>Uploading…</>
            ) : (
              <>
                Drag photos here, or
                <Button
                  type="button"
                  variant="link"
                  className="px-1 h-auto py-0"
                  onClick={() => inputRef.current?.click()}
                >
                  pick from device
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_PHOTOS}. Auto-compressed to ~1MB.
          </p>
        </div>
      </div>

      {value.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((photo, idx) => (
            <div
              key={photo.path}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
