import { useState, useEffect } from "react";
import { Input } from "./input";

interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  id?: string;
}

/**
 * Input component for decimal numbers that properly handles comma/dot separators.
 * Maintains a local string state while typing to allow intermediate values like "14,"
 * before the user completes typing "14,2".
 */
export function DecimalInput({
  value,
  onChange,
  min = 0,
  max = 54,
  placeholder = "0,0",
  className = "",
  id,
}: DecimalInputProps) {
  const [localValue, setLocalValue] = useState(value === 0 ? "" : String(value).replace(".", ","));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value when external value changes (but not while focused)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === 0 ? "" : String(value).replace(".", ","));
    }
  }, [value, isFocused]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      value={localValue}
      onChange={(e) => {
        const rawValue = e.target.value;
        // Allow empty, digits, and one decimal separator
        if (rawValue === "" || /^[0-9]*[.,]?[0-9]*$/.test(rawValue)) {
          setLocalValue(rawValue);
          // Only update parent if we have a valid complete number
          const normalized = rawValue.replace(",", ".");
          if (normalized !== "" && normalized !== "." && !normalized.endsWith(".")) {
            const num = parseFloat(normalized);
            if (!isNaN(num) && num >= min && num <= max) {
              onChange(num);
            }
          }
        }
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        setIsFocused(false);
        const rawValue = e.target.value.replace(",", ".");
        if (rawValue === "" || rawValue === ".") {
          onChange(0);
          setLocalValue("");
        } else {
          const num = parseFloat(rawValue);
          if (!isNaN(num) && num >= min && num <= max) {
            onChange(num);
            setLocalValue(String(num).replace(".", ","));
          } else {
            // Reset to current value if invalid
            setLocalValue(value === 0 ? "" : String(value).replace(".", ","));
          }
        }
      }}
      placeholder={placeholder}
    />
  );
}
