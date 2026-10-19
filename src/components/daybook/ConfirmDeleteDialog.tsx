"use client";
import { useState } from "react";
import { formatDayLabel } from "@/lib/daybook/istDate";
import { formatINR } from "@/lib/daybook/money";
import type { DaybookEntryView } from "@/lib/daybook/types";
import Modal, { dangerBtn, secondaryBtn } from "./Modal";

interface Props {
  entry: DaybookEntryView;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ConfirmDeleteDialog({ entry, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Delete entry"
      onClose={onClose}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={dangerBtn}
            data-autofocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </>
      }
    >
      <p>Delete this {entry.type} entry? This cannot be undone.</p>
      <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm space-y-1">
        <div className="font-semibold">{entry.description}</div>
        <div className="text-gray-500 dark:text-gray-400">
          {formatDayLabel(entry.date)} · {entry.category} ·{" "}
          <span className={entry.type === "income" ? "text-green-600" : "text-red-600"}>{formatINR(entry.amount)}</span>
        </div>
      </div>
    </Modal>
  );
}
