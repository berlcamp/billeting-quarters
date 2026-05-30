import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventAttendanceLogWithPerson } from "@/lib/actions/event-attendance";
import { formatManila } from "@/lib/timezone";

interface Props {
  logs: EventAttendanceLogWithPerson[];
}

// Resolve the display fields from either the joined personnel record (QR scan)
// or the free-text guest columns (manual entry).
function resolve(log: EventAttendanceLogWithPerson) {
  if (log.personnel) {
    return {
      name: log.personnel.full_name,
      committee: log.personnel.committee,
      designation: log.personnel.designation,
      isGuest: false,
    };
  }
  return {
    name: log.guest_name ?? "—",
    committee: log.guest_committee,
    designation: log.guest_designation,
    isGuest: true,
  };
}

export function EventAttendanceTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <h3 className="font-semibold">No time-ins yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan a personnel QR code or use manual entry to record the first
          time-in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {logs.length} time-in{logs.length === 1 ? "" : "s"}
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Committee / Agency</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead className="text-right">Time-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const r = resolve(log);
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{r.name}</span>
                      {r.isGuest ? (
                        <Badge variant="outline" className="text-xs">
                          Guest
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.committee ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.designation ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatManila(log.time_in)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
