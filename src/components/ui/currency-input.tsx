"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { parseToKobo } from "@/lib/money";

export interface CurrencyInputProps {
  /** Value in kobo (integer). */
  valueKobo?: number;
  /** Called with the new kobo integer, or null when the input is empty/invalid. */
  onValueChange?: (kobo: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Currency input — user types Naira (with commas allowed), state is kept in kobo (integer).
 * See CLAUDE.md §2.2 and §9.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ valueKobo, onValueChange, placeholder = "0", invalid, disabled, className, id, name }, ref) => {
    const [text, setText] = React.useState(() =>
      valueKobo != null ? (valueKobo / 100).toLocaleString("en-NG") : "",
    );
    const [focused, setFocused] = React.useState(false);

    // Sync the displayed text from valueKobo — but NOT while the user is typing
    // (typing round-trips through the parent, and re-formatting mid-keystroke
    // clobbers the input and jumps the cursor). On blur we re-format.
    React.useEffect(() => {
      if (focused) return;
      if (valueKobo == null) {
        setText("");
      } else {
        setText((valueKobo / 100).toLocaleString("en-NG"));
      }
    }, [valueKobo, focused]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      setText(raw);
      if (!raw.trim()) {
        onValueChange?.(null);
        return;
      }
      try {
        onValueChange?.(parseToKobo(raw));
      } catch {
        onValueChange?.(null);
      }
    }

    function handleBlur() {
      setFocused(false);
      if (valueKobo != null) {
        setText((valueKobo / 100).toLocaleString("en-NG"));
      }
    }

    return (
      <div
        className={cn(
          "flex h-10 w-full rounded-md border bg-surface overflow-hidden",
          "focus-within:shadow-focus focus-within:border-brand-primary",
          disabled && "opacity-50 cursor-not-allowed",
          invalid ? "border-danger" : "border-border-strong",
          className,
        )}
      >
        <span className="inline-flex items-center px-3 bg-surface-2 text-sm font-semibold text-fg-muted border-r border-border-strong">
          ₦
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          inputMode="decimal"
          type="text"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none tabular text-right"
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
