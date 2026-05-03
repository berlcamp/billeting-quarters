import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperState = "pending" | "current" | "complete";

export interface ApprovalStep {
  id: string;
  label: string;
  state: StepperState;
  description?: string;
}

interface ApprovalStepperProps {
  steps: ApprovalStep[];
}

export function ApprovalStepper({ steps }: ApprovalStepperProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-3 top-7 h-[calc(100%-12px)] w-px",
                  step.state === "complete" ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ring-2",
                step.state === "complete" &&
                  "bg-primary text-primary-foreground ring-primary",
                step.state === "current" &&
                  "bg-background text-primary ring-primary",
                step.state === "pending" &&
                  "bg-background text-muted-foreground ring-border",
              )}
            >
              {step.state === "complete" ? (
                <Check className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="flex-1 pb-2 -mt-0.5">
              <div
                className={cn(
                  "text-sm",
                  step.state === "pending"
                    ? "text-muted-foreground"
                    : "font-medium",
                )}
              >
                {step.label}
              </div>
              {step.description ? (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
