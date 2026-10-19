import type { DaybookEntryView, Totals } from "./types";
import { formatDayLabel } from "./istDate";

export async function exportEntriesWorkbook(opts: {
  entries: DaybookEntryView[];
  totals: Totals;
  from: string;
  to: string;
  balance: { opening: number; closing: number } | null;
  filtered: boolean;
}) {
  const { entries, totals, from, to, balance, filtered } = opts;
  const XLSX = await import("xlsx");
  const period = from === to ? formatDayLabel(from) : `${formatDayLabel(from)} to ${formatDayLabel(to)}`;

  const rows: (string | number)[][] = [
    ["Gajanand Finance - Day Book"],
    [`Period: ${period}`],
    filtered ? ["Filtered list"] : [],
    [],
    ["Sr", "Date", "Description", "Category", "Type", "Income", "Expense", "Added by"],
  ];
  entries.forEach((e, i) =>
    rows.push([
      i + 1,
      formatDayLabel(e.date),
      e.description,
      e.category,
      e.type === "income" ? "Income" : "Expense",
      e.type === "income" ? e.amount : "",
      e.type === "expense" ? e.amount : "",
      e.createdBy,
    ])
  );
  rows.push([], ["", "", "", "", "Total", totals.income, totals.expense], ["", "", "", "", "Net (Income - Expense)", totals.net]);
  if (balance && !filtered) {
    rows.push(["", "", "", "", "Opening balance", balance.opening], ["", "", "", "", "Closing balance", balance.closing]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Day Book");
  XLSX.writeFile(wb, `daybook-${from === to ? from : `${from}-to-${to}`}${filtered ? "-filtered" : ""}.xlsx`);
}
