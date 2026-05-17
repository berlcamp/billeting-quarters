"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, ListPlus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addEntriesBulk } from "@/lib/actions/raffle";

interface Props {
  departmentId: string;
  departmentName: string;
  trigger: ReactNode;
}

function parseNamesText(text: string): {
  names: string[];
  empties: number;
  duplicates: number;
  headerSkipped: boolean;
} {
  const lines = text.split(/\r?\n/);
  // For CSV: take the first comma-separated column. For plain paste: the whole line.
  const cells = lines.map((line) => (line.split(",")[0] ?? "").trim());
  let headerSkipped = false;
  if (cells[0]?.toLowerCase() === "name") {
    cells.shift();
    headerSkipped = true;
  }
  const seen = new Set<string>();
  const names: string[] = [];
  let empties = 0;
  let duplicates = 0;
  for (const c of cells) {
    if (!c) {
      empties += 1;
      continue;
    }
    const key = c.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    names.push(c);
  }
  return { names, empties, duplicates, headerSkipped };
}

export function AddEntriesDialog({
  departmentId,
  departmentName,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const parsed = useMemo(() => parseNamesText(text), [text]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.text();
    setText(buf);
  }

  async function onSubmit() {
    if (parsed.names.length === 0) {
      toast.error("Nothing to add", {
        description: "Paste names (one per line) or upload a CSV.",
      });
      return;
    }
    setSubmitting(true);
    const result = await addEntriesBulk({
      department_id: departmentId,
      names: parsed.names,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error("Insert failed", { description: result.error });
      return;
    }
    toast.success(`Added ${result.data?.inserted ?? 0} entries`);
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(false);
    router.refresh();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="size-4" />
            Add entries to {departmentName}
          </DialogTitle>
          <DialogDescription>
            One name per line. CSV files only use the first column. A header row
            named &quot;name&quot; is skipped automatically. Duplicates within
            the batch are removed.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste">Paste names</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2">
            <Label htmlFor="paste-input">Names</Label>
            <Textarea
              id="paste-input"
              rows={10}
              placeholder={"Juan dela Cruz\nMaria Santos\nPedro Reyes\n…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </TabsContent>

          <TabsContent value="csv" className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Choose CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={onFileChange}
                className="hidden"
              />
              {text ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileSpreadsheet className="size-3.5" />
                  File loaded
                </span>
              ) : null}
            </div>
            <Label className="text-xs text-muted-foreground" htmlFor="csv-preview">
              Preview
            </Label>
            <Textarea
              id="csv-preview"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Loaded CSV content appears here. You can also paste it directly."
            />
          </TabsContent>
        </Tabs>

        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Ready to add:{" "}
              <span className="font-semibold text-foreground">
                {parsed.names.length}
              </span>
            </span>
            <span>
              Duplicates skipped:{" "}
              <span className="font-medium">{parsed.duplicates}</span>
            </span>
            <span>
              Empty lines: <span className="font-medium">{parsed.empties}</span>
            </span>
            {parsed.headerSkipped ? (
              <span className="text-muted-foreground">Header row removed</span>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || parsed.names.length === 0}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Add {parsed.names.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
