"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  side?: boolean;
}

export default function Modal({ title, onClose, children, footer, size = "md", side = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    // Capture phase so the page-level Esc (go home) never fires while a modal is open.
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
    first?.focus();
  }, []);

  const width = size === "lg" ? "max-w-3xl" : "max-w-lg";

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${side ? "justify-end" : "items-center justify-center p-3"}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={`bg-white dark:bg-gray-800 shadow-xl flex flex-col w-full ${width} ${
          side ? "h-full" : "max-h-[92vh] rounded-xl"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-orange-600 dark:text-orange-400">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 text-gray-800 dark:text-gray-200">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldClass =
  "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white";

export const inputClass = `w-full ${fieldClass}`;

/** Fixed-width field for toolbars, where a full-width input would stretch the row. */
export const compactInputClass = `w-auto ${fieldClass}`;

export const labelClass = "block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1";

export const primaryBtn =
  "px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors";

export const secondaryBtn =
  "px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";

export const dangerBtn =
  "px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md disabled:bg-gray-400 transition-colors";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400 mt-1">{message}</p>;
}
