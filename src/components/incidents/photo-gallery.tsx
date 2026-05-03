"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getIncidentPhotoUrl } from "@/lib/actions/incidents";

interface PhotoGalleryProps {
  paths: string[];
}

export function PhotoGallery({ paths }: PhotoGalleryProps) {
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    paths.map(() => null),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all(
      paths.map(async (p) => {
        const result = await getIncidentPhotoUrl(p);
        if (result.error) {
          toast.error("Failed to load photo", { description: result.error });
          return null;
        }
        return result.data!.url;
      }),
    ).then((next) => {
      if (mounted) {
        setUrls(next);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [paths]);

  if (paths.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No photos attached.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, idx) => (
        <a
          key={paths[idx]}
          href={url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-square overflow-hidden rounded-md border bg-muted"
          aria-label={`Open photo ${idx + 1}`}
        >
          {loading || !url ? (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`Incident photo ${idx + 1}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </a>
      ))}
    </div>
  );
}
