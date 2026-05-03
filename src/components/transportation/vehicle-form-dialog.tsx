"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";
import {
  createVehicleSchema,
  type CreateVehicleInput,
} from "@/lib/schemas/vehicles";
import {
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type VehicleType,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];

interface Props {
  trigger: ReactNode;
  vehicle?: Vehicle;
}

export function VehicleFormDialog({ trigger, vehicle }: Props) {
  const isEdit = !!vehicle;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: {
      vehicle_code: vehicle?.vehicle_code ?? "",
      plate_number: vehicle?.plate_number ?? undefined,
      vehicle_type: vehicle?.vehicle_type ?? "van",
      make_model: vehicle?.make_model ?? undefined,
      capacity: vehicle?.capacity ?? undefined,
      driver_name: vehicle?.driver_name ?? undefined,
      driver_contact: vehicle?.driver_contact ?? undefined,
      current_assignment: vehicle?.current_assignment ?? undefined,
      notes: vehicle?.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        vehicle_code: vehicle?.vehicle_code ?? "",
        plate_number: vehicle?.plate_number ?? undefined,
        vehicle_type: vehicle?.vehicle_type ?? "van",
        make_model: vehicle?.make_model ?? undefined,
        capacity: vehicle?.capacity ?? undefined,
        driver_name: vehicle?.driver_name ?? undefined,
        driver_contact: vehicle?.driver_contact ?? undefined,
        current_assignment: vehicle?.current_assignment ?? undefined,
        notes: vehicle?.notes ?? undefined,
      });
    }
  }, [open, vehicle, form]);

  async function onSubmit(values: CreateVehicleInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateVehicle({ ...values, id: vehicle!.id })
      : await createVehicle(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Vehicle updated" : "Vehicle added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          <DialogDescription>
            The vehicle code is encoded in the QR. Keep it short and unique.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vehicle_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="BUS-01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plate_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plate</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ABC-1234"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vehicle_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as VehicleType)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v
                                ? VEHICLE_TYPE_LABELS[v as VehicleType]
                                : "Pick a type"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VEHICLE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {VEHICLE_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="make_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make / model</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Toyota Coaster"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="driver_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driver_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver contact</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="current_assignment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current assignment</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="NCR delegation shuttle"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isEdit ? "Save" : "Add vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
