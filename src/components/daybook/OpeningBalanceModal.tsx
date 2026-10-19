"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { formatDayLabel } from "@/lib/daybook/istDate";
import { formatINR, hasAtMostTwoDecimals } from "@/lib/daybook/money";
import type { DaybookSettingView } from "@/lib/daybook/types";
import Modal, { FieldError, inputClass, labelClass, primaryBtn, secondaryBtn } from "./Modal";
import { api, ApiError } from "./api";

interface Props {
  setting: DaybookSettingView | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function OpeningBalanceModal({ setting, defaultDate, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(setting ? String(setting.openingBalance) : "");
  const [asOfDate, setAsOfDate] = useState(setting?.asOfDate ?? defaultDate);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n)) return setError({ field: "openingBalance", message: "Enter the cash in hand" });
    if (!hasAtMostTwoDecimals(n)) return setError({ field: "openingBalance", message: "At most 2 decimal places" });
    if (!asOfDate) return setError({ field: "asOfDate", message: "Enter a date" });
    setBusy(true);
    try {
      await api("/api/daybook/settings", { method: "PUT", body: { openingBalance: n, asOfDate } });
      toast.success("Opening balance saved");
      onSaved();
    } catch (e) {
      const err = e as ApiError;
      setError({ field: err.field, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api("/api/daybook/settings", { method: "DELETE" });
      toast.success("Opening balance removed");
      onSaved();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Opening balance (optional)"
      onClose={onClose}
      footer={
        <>
          {setting && (
            <button className="mr-auto text-sm text-red-600 font-semibold disabled:opacity-50" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Not required to record entries. Set it if you want the Day Book to show the cash in hand at the start and end of
          each day. Entries dated before this date are not included in the balance.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="ob-date">Balance as of (start of day)</label>
            <input id="ob-date" type="date" className={inputClass} value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            <FieldError message={error?.field === "asOfDate" ? error.message : undefined} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-amount">Cash in hand (₹)</label>
            <input
              id="ob-amount"
              type="number"
              step="0.01"
              className={`${inputClass} text-right`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              data-autofocus
            />
            <FieldError message={error?.field === "openingBalance" ? error.message : undefined} />
          </div>
        </div>
        {error && error.field !== "asOfDate" && error.field !== "openingBalance" && <FieldError message={error.message} />}
        {setting && (
          <p className="text-xs text-gray-400">
            Currently {formatINR(setting.openingBalance)} as of {formatDayLabel(setting.asOfDate)}
            {setting.updatedBy ? `, set by ${setting.updatedBy}` : ""}.
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
