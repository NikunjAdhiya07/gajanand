"use client";
import { Fragment } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatDayLabel, weekdayOf } from "@/lib/daybook/istDate";
import { formatINR, fromPaise, toPaise } from "@/lib/daybook/money";
import type { DaybookEntryView, Totals } from "@/lib/daybook/types";

export function totalsOf(entries: DaybookEntryView[]): Totals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === "income") income += toPaise(e.amount);
    else expense += toPaise(e.amount);
  }
  return { income: fromPaise(income), expense: fromPaise(expense), net: fromPaise(income - expense), count: entries.length };
}

function TypeBadge({ type }: { type: DaybookEntryView["type"] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        type === "income"
          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      }`}
    >
      {type === "income" ? "Income" : "Expense"}
    </span>
  );
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

interface Props {
  entries: DaybookEntryView[];
  groupByDate: boolean;
  onEdit: (e: DaybookEntryView) => void;
  onDelete: (e: DaybookEntryView) => void;
}

export default function EntriesTable({ entries, groupByDate, onEdit, onDelete }: Props) {
  const groups: [string, DaybookEntryView[]][] = [];
  if (groupByDate) {
    for (const e of entries) {
      const last = groups[groups.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else groups.push([e.date, [e]]);
    }
  } else {
    groups.push(["", entries]);
  }
  const total = totalsOf(entries);

  const row = (e: DaybookEntryView, i: number) => (
    <tr key={e._id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50/40 dark:hover:bg-gray-700/40">
      <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-800 dark:text-gray-100 break-words">{e.description}</div>
        <div className="text-xs text-gray-400" title={e.updatedAt !== e.createdAt ? `Last edited by ${e.updatedBy}` : undefined}>
          {time(e.createdAt)}
          {e.createdBy ? ` · ${e.createdBy}` : ""}
          {e.updatedAt !== e.createdAt ? " · edited" : ""}
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.category}</td>
      <td className="px-3 py-2"><TypeBadge type={e.type} /></td>
      <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400 font-semibold">
        {e.type === "income" ? formatINR(e.amount) : ""}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-red-700 dark:text-red-400 font-semibold">
        {e.type === "expense" ? formatINR(e.amount) : ""}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <button
            className="p-1.5 rounded-md text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700"
            onClick={() => onEdit(e)}
            aria-label={`Edit ${e.description}`}
            title="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
            onClick={() => onDelete(e)}
            aria-label={`Delete ${e.description}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300">
          <tr className="text-left">
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 w-40">Category</th>
            <th className="px-3 py-2 w-24">Type</th>
            <th className="px-3 py-2 w-36 text-right">Income</th>
            <th className="px-3 py-2 w-36 text-right">Expense</th>
            <th className="px-3 py-2 w-24 text-right"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([date, list]) => {
            const t = groupByDate ? totalsOf(list) : null;
            return (
              <Fragment key={date || "all"}>
                {groupByDate && (
                  <tr className="bg-orange-50/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                    <td colSpan={4} className="px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-200">
                      {formatDayLabel(date)} <span className="font-normal text-gray-500">{weekdayOf(date)}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-green-700 dark:text-green-400">{t && t.income ? formatINR(t.income) : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-700 dark:text-red-400">{t && t.expense ? formatINR(t.expense) : ""}</td>
                    <td className={`px-3 py-1.5 text-right text-xs tabular-nums ${t && t.net < 0 ? "text-red-600" : "text-gray-500"}`}>
                      {t ? `Net ${formatINR(t.net)}` : ""}
                    </td>
                  </tr>
                )}
                {list.map(row)}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-700/60 font-semibold">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-gray-700 dark:text-gray-200">
              Total ({total.count} {total.count === 1 ? "entry" : "entries"})
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">{formatINR(total.income)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-red-700 dark:text-red-400">{formatINR(total.expense)}</td>
            <td className={`px-3 py-2 text-right text-xs tabular-nums ${total.net < 0 ? "text-red-600" : "text-gray-600 dark:text-gray-300"}`}>
              Net {formatINR(total.net)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
