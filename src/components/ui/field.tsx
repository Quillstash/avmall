"use client";

import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FieldProps {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  /** Mark the field as required — shows a red asterisk with a tooltip. */
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label !== undefined && (
        <Label htmlFor={id} className="inline-flex items-center gap-1">
          <span>{label}</span>
          {required && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-danger leading-none cursor-help"
                  aria-label="Required field"
                >
                  *
                </span>
              </TooltipTrigger>
              <TooltipContent>Required</TooltipContent>
            </Tooltip>
          )}
          {optional && !required && (
            <span className="ml-0.5 font-medium normal-case text-fg-subtle">· optional</span>
          )}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
