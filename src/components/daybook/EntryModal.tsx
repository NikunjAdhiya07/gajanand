"use client";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { DAYBOOK_CATEGORIES } from "@/lib/constants";
import { hasAtMostTwoDecimals } from "@/lib/daybook/money";
import type { DaybookEntryView, EntryInput, EntryType } from "@/lib/daybook/types";
import Modal, { FieldError, inputClass, labelClass, primaryBtn, secondaryBtn } from "./Modal";
import { api, ApiError } from "./api";

export interface EntryDraft {
  date: string;
  type: EntryType;
  category: string;
  description: string;
  amount: string;
}

export const emptyDraft = (date: string, type: EntryType): EntryDraft => ({
  date,
  type,
  category: "",
  description: "",
  amount: "",
});

export const draftFromEntry = (e: DaybookEntryView): EntryDraft => ({
  date: e.date,
  type: e.type,
  category: e.category,
  description: e.description,
  amount: String(e.amount),
});

type Errors = Partial<Record<keyof EntryDraft, string>>;

function validate(d: EntryDraft, maxDay: string): Errors {
  const errors: Errors = {};
  if (!d.date) errors.date = "Enter a date";
  else if (d.date > maxDay) errors.date = "Date cannot be in the future";
  const amount = Number(d.amount);
  if (!d.amount.trim() || !Number.isFinite(amount)) errors.amount = "Enter an amount";
  else if (amount <= 0) errors.amount = "Amount must be greater than zero";
  else if (!hasAtMostTwoDecimals(amount)) errors.amount = "At most 2 decimal places";
  if (!d.description.trim()) errors.description = "Description is required";
  if (!d.category.trim()) errors.category = "Choose or type a category";
  return errors;
}

interface Props {
  entryId?: string;
  initial: EntryDraft;
  maxDay: string;
  knownCategories: string[];
  onClose: () => void;
  /** `keepOpen` is true after "Save & add another". */
  onSaved: (date: string, keepOpen: boolean) => void;
}

export default function EntryModal({ entryId, initial, maxDay, knownCategories, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<EntryDraft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const isEdit = !!entryId;

  const suggestions = useMemo(() => {
    const preset: readonly string[] = DAYBOOK_CATEGORIES[draft.type];
    return [...new Set([...preset, ...knownCategories])];
  }, [draft.type, knownCategories]);

  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async (addAnother: boolean) => {
    if (saving) return;
    const found = validate(draft, maxDay);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body: EntryInput = {
      date: draft.date,
      type: draft.type,
      category: draft.category.trim(),
      description: draft.description.trim(),
      amount: Number(draft.amount),
    };
    setSaving(true);
    try {
      await api(isEdit ? `/api/daybook/entries/${entryId}` : "/api/daybook/entries", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      toast.success(isEdit ? "Entry updated" : `${draft.type === "income" ? "Income" : "Expense"} saved`);
      if (addAnother) {
        setDraft((d) => ({ ...emptyDraft(d.date, d.type), category: d.category }));
        setErrors({});
        amountRef.current?.focus();
      }
      onSaved(draft.date, addAnother);
    } catch (e) {
      const err = e as ApiError;
      if (err.field && err.field in draft) setErrors({ [err.field]: err.message });
      else toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save(false);
    }
  };

  const isIncome = draft.type === "income";

  return (
    <Modal
      title={isEdit ? "Edit entry" : isIncome ? "Add income" : "Add expense"}
      onClose={onClose}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
          {!isEdit && (
            <button className={secondaryBtn} onClick={() => save(true)} disabled={saving}>
              Save &amp; add another
            </button>
          )}
          <button className={primaryBtn} onClick={() => save(false)} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onKeyDown={onKeyDown}
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg" role="radiogroup" aria-label="Type">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={draft.type === t}
              onClick={() => set("type", t)}
              className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                draft.type === t
                  ? t === "income"
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-red-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {t === "income" ? "Income (money in)" : "Expense (money out)"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="db-date">Date</label>
            <input
              id="db-date"
              type="date"
              className={inputClass}
              value={draft.date}
              max={maxDay}
              onChange={(e) => set("date", e.target.value)}
            />
            <FieldError message={errors.date} />
          </div>
          <div>
            <label className={labelClass} htmlFor="db-amount">Amount (₹)</label>
            <input
              id="db-amount"
              ref={amountRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={`${inputClass} text-right`}
              value={draft.amount}
              onChange={(e) => set("amount", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              data-autofocus
            />
            <FieldError message={errors.amount} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="db-description">Description</label>
          <input
            id="db-description"
            className={inputClass}
            value={draft.description}
            maxLength={200}
            onChange={(e) => set("description", e.target.value)}
            placeholder={isIncome ? "Enter details of the amount received" : "Enter details of the expense"}
          />
          <FieldError message={errors.description} />
        </div>

        <div>
          <label className={labelClass} htmlFor="db-category">Category</label>
          <input
            id="db-category"
            className={inputClass}
            value={draft.category}
            maxLength={50}
            list="db-category-list"
            onChange={(e) => set("category", e.target.value)}
            placeholder="Pick below or type your own"
          />
          <datalist id="db-category-list">
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {DAYBOOK_CATEGORIES[draft.type].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("category", c)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  draft.category === c
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-orange-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <FieldError message={errors.category} />
        </div>
        <p className="text-xs text-gray-400">Ctrl + Enter to save</p>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
