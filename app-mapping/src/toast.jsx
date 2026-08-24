import {toast} from "@heroui/react";

/** Copy to clipboard and confirm — a silent clipboard write reads as broken. */
export function copyWithToast(value, label = "Copied") {
  navigator.clipboard?.writeText(value);
  toast.success(label, {
    description: value.length > 34 ? `${value.slice(0, 32)}…` : value,
  });
}
