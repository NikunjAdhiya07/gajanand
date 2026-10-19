"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Ubuntu } from "next/font/google";
import toast, { Toaster } from "react-hot-toast";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import TimeDisplay from "@/ui/TimeDisplay";
import { useNavigationStore } from "@/store/NavigationStore";
import { addDays, formatDayLabel, istToday, startOfMonth, weekdayOf } from "@/lib/daybook/istDate";
import { formatINR } from "@/lib/daybook/money";
import { exportEntriesWorkbook } from "@/lib/daybook/export";
import type { DaybookEntryView, DaybookListResponse, EntryType } from "@/lib/daybook/types";
import { api, ApiError } from "@/components/daybook/api";
import EntriesTable, { totalsOf } from "@/components/daybook/EntriesTable";
import EntryModal, { EntryDraft, draftFromEntry, emptyDraft } from "@/components/daybook/EntryModal";
import ConfirmDeleteDialog from "@/components/daybook/ConfirmDeleteDialog";
import OpeningBalanceModal from "@/components/daybook/OpeningBalanceModal";
import { compactInputClass, inputClass, primaryBtn, secondaryBtn } from "@/components/daybook/Modal";

const ubuntu = Ubuntu({ weight: "400", subsets: ["latin"] });

type Mode = "day" | "range";
type EntryModalState = { entryId?: string; draft: EntryDraft } | null;

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

const countLabel = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;

function Card({ label, value, tone, hint }: { label: string; value: number; tone: "green" | "red" | "gray" | "orange"; hint?: string }) {
  const color = {
    green: "text-green-700 dark:text-green-400",
    red: "text-red-700 dark:text-red-400",
    gray: "text-gray-800 dark:text-gray-100",
    orange: "text-orange-600 dark:text-orange-400",
  }[tone];
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>{formatINR(value)}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function DayBookPage() {
  const router = useRouter();
  const setSelectedNavItem = useNavigationStore((s) => s.setSelectedNavItem);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [today, setToday] = useState("");
  const [mode, setMode] = useState<Mode>("day");
  const [day, setDay] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });

  const [data, setData] = useState<DaybookListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const requestSeq = useRef(0);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [deleting, setDeleting] = useState<DaybookEntryView | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  const anyModalOpen = !!(entryModal || deleting || openingOpen);
  const searchRef = useRef<HTMLInputElement>(null);

  // ---- Theme (same convention as the other screens) ----
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const dark = saved === "dark";
    if (!saved) localStorage.setItem("theme", "light");
    setIsDarkMode(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsDarkMode((prev) => {
          const next = !prev;
          localStorage.setItem("theme", next ? "dark" : "light");
          document.documentElement.classList.toggle("dark", next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  // ---- Data loading ----
  useEffect(() => {
    const t = istToday();
    setToday(t);
    setDay(t);
    setRange({ from: startOfMonth(t), to: t });
  }, []);

  const from = mode === "day" ? day : range.from;
  const to = mode === "day" ? day : range.to;

  const load = useCallback(async (f: string, t: string) => {
    if (!f || !t) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await api<DaybookListResponse>(`/api/daybook?from=${f}&to=${t}`);
      if (seq !== requestSeq.current) return;
      setData(res);
      setToday(res.today);
      setError(null);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e as ApiError);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => load(from, to), [load, from, to]);

  useEffect(() => {
    if (from && to && from <= to) load(from, to);
  }, [from, to, load]);

  // Pick up entries added from another tab or computer.
  useEffect(() => {
    const onFocus = () => {
      if (!anyModalOpen) reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [anyModalOpen, reload]);

  // ---- Derived values ----
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const categories = useMemo(() => [...new Set(entries.map((e) => e.category))].sort(), [entries]);
  const isFiltered = !!search.trim() || typeFilter !== "all" || categoryFilter !== "all";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (typeFilter === "all" || e.type === typeFilter) &&
        (categoryFilter === "all" || e.category === categoryFilter) &&
        (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || String(e.amount).includes(q))
    );
  }, [entries, search, typeFilter, categoryFilter]);

  const filteredTotals = useMemo(() => totalsOf(visible), [visible]);

  // ---- Actions ----
  const goToDay = useCallback(
    (d: string) => {
      if (!d || (today && d > today)) return;
      setMode("day");
      setDay(d);
    },
    [today]
  );

  const shiftDay = useCallback((n: number) => goToDay(addDays(day, n)), [day, goToDay]);

  const setPreset = (preset: "week" | "month" | "lastMonth" | "last30") => {
    const t = today || istToday();
    if (preset === "week") {
      const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
      setRange({ from: addDays(t, -dow), to: t });
    } else if (preset === "month") {
      setRange({ from: startOfMonth(t), to: t });
    } else if (preset === "lastMonth") {
      const end = addDays(startOfMonth(t), -1);
      setRange({ from: startOfMonth(end), to: end });
    } else {
      setRange({ from: addDays(t, -29), to: t });
    }
    setMode("range");
  };

  const defaultEntryDate = mode === "day" ? day : today >= range.from && today <= range.to ? today : range.to;

  const openNew = useCallback(
    (type: EntryType) => {
      if (!defaultEntryDate) return;
      setEntryModal({ draft: emptyDraft(defaultEntryDate, type) });
    },
    [defaultEntryDate]
  );

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
  };

  const handleSaved = (savedDate: string, keepOpen: boolean) => {
    if (!keepOpen) setEntryModal(null);
    if (mode === "day" && savedDate !== day) {
      setDay(savedDate);
      toast(`Showing ${formatDayLabel(savedDate)}, the date of the entry`, { icon: "📅" });
    } else {
      if (mode === "range" && (savedDate < range.from || savedDate > range.to)) {
        toast(`Saved on ${formatDayLabel(savedDate)}, outside the selected range`, { icon: "ℹ️" });
      }
      reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api(`/api/daybook/entries/${deleting._id}`, { method: "DELETE" });
      toast.success("Entry deleted");
    } catch (e) {
      const err = e as ApiError;
      // Already gone (deleted elsewhere): the refresh below shows the current list.
      if (err.status !== 404) {
        toast.error(err.message);
        return;
      }
      toast(err.message, { icon: "ℹ️" });
    }
    setDeleting(null);
    reload();
  };

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if (e.key === "Escape") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setSelectedNavItem("Transaction", 1);
        router.push("/");
        return;
      }
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft" && mode === "day") {
        e.preventDefault();
        shiftDay(-1);
      } else if (e.key === "ArrowRight" && mode === "day") {
        e.preventDefault();
        shiftDay(1);
      } else if (k === "t") {
        goToDay(today);
      } else if (k === "i") {
        e.preventDefault();
        openNew("income");
      } else if (k === "e") {
        e.preventDefault();
        openNew("expense");
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModalOpen, mode, shiftDay, goToDay, today, openNew, router, setSelectedNavItem]);

  // ---- Render ----
  const periodLabel = from && to ? (from === to ? formatDayLabel(from) : `${formatDayLabel(from)} to ${formatDayLabel(to)}`) : "";
  const rangeInvalid = mode === "range" && !!range.from && !!range.to && range.from > range.to;

  const renderBody = () => {
    if (rangeInvalid) {
      return <p className="text-center py-10 text-red-600">The &quot;From&quot; date must be on or before the &quot;To&quot; date.</p>;
    }
    if (loading && !data) {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      );
    }
    if (error && !data) {
      return (
        <div className="max-w-xl mx-auto text-center p-8 space-y-4">
          <p className="text-gray-700 dark:text-gray-200 font-semibold">{error.message}</p>
          {error.status === 401 ? (
            <button className={primaryBtn} onClick={() => router.push("/login")}>Log in</button>
          ) : (
            <button className={primaryBtn} onClick={reload}>Retry</button>
          )}
        </div>
      );
    }
    if (!data) return null;

    const totals = data.totals;
    return (
      <div className={`space-y-4 ${loading ? "opacity-60 transition-opacity" : ""}`}>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm flex items-center justify-between gap-2">
            <span>Could not refresh: {error.message} The figures below may be out of date.</span>
            <button className="font-semibold underline" onClick={reload}>Retry</button>
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-3 ${data.balance ? "xl:grid-cols-5" : ""} gap-3`}>
          {data.balance && <Card label="Opening balance" value={data.balance.opening} tone="gray" />}
          <Card label="Income" value={totals.income} tone="green" hint={countLabel(data.entries.filter((e) => e.type === "income").length)} />
          <Card label="Expense" value={totals.expense} tone="red" hint={countLabel(data.entries.filter((e) => e.type === "expense").length)} />
          <Card label="Net (Income − Expense)" value={totals.net} tone={totals.net < 0 ? "red" : "orange"} />
          {data.balance && <Card label="Closing balance" value={data.balance.closing} tone="gray" />}
        </div>
        {!data.balance && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.setting && from < data.setting.asOfDate
              ? `Balances start from ${formatDayLabel(data.setting.asOfDate)}, so they are not shown for this period. `
              : "Opening and closing balances are optional. "}
            <button className="text-orange-600 font-semibold" onClick={() => setOpeningOpen(true)}>
              {data.setting ? "Change opening balance" : "Set opening balance"}
            </button>
          </p>
        )}

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              className={`${inputClass} pl-9`}
              placeholder="Search description, category or amount  ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {(["all", "income", "expense"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                  typeFilter === t ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm" : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>
          <select
            className={`${inputClass} lg:w-48`}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {isFiltered && (
            <button className="text-sm text-orange-600 font-semibold whitespace-nowrap px-2" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {isFiltered && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredTotals.count} of {totals.count} entries. The cards above show the full {mode === "day" ? "day" : "period"}; the
            table total shows the filtered entries.
          </p>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 space-y-3">
            <p className="font-semibold">No entries for {periodLabel}.</p>
            <div className="flex justify-center gap-2">
              <button className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => openNew("income")}>
                Add income
              </button>
              <button className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold" onClick={() => openNew("expense")}>
                Add expense
              </button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No entries match the filters.{" "}
            <button className="text-orange-600 font-semibold" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <EntriesTable
            entries={visible}
            groupByDate={mode === "range"}
            onEdit={(e) => setEntryModal({ entryId: e._id, draft: draftFromEntry(e) })}
            onDelete={setDeleting}
          />
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${ubuntu.className}`}>
      <Toaster position="top-right" />
      <div className="max-w-[1400px] mx-auto px-2 sm:px-4 py-3 sm:py-5 space-y-4">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Image
                src={isDarkMode ? "/GFLogo.png" : "/lightlogo.png"}
                alt="logo"
                height={50}
                width={50}
                className="w-12 lg:w-14 cursor-pointer"
                onClick={() => router.push("/")}
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-orange-500">Day Book</h1>
            </div>
            <TimeDisplay />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {(["day", "range"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                      mode === m ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm" : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {m === "day" ? "Day" : "Date range"}
                  </button>
                ))}
              </div>

              {mode === "day" ? (
                <>
                  <button className={`${secondaryBtn} px-2.5`} onClick={() => shiftDay(-1)} disabled={!day} aria-label="Previous day" title="Previous day (Left arrow)">
                    <ChevronLeft size={18} />
                  </button>
                  <input
                    type="date"
                    className={`${compactInputClass} font-semibold`}
                    value={day}
                    max={today || undefined}
                    onChange={(e) => e.target.value && goToDay(e.target.value)}
                    aria-label="Date"
                  />
                  <button
                    className={`${secondaryBtn} px-2.5`}
                    onClick={() => shiftDay(1)}
                    disabled={!day || day >= today}
                    aria-label="Next day"
                    title="Next day (Right arrow)"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button className={`${secondaryBtn} inline-flex items-center gap-1`} onClick={() => goToDay(today)} disabled={day === today} title="Today (T)">
                    <CalendarDays size={16} /> Today
                  </button>
                  {day && <span className="text-sm text-gray-500 dark:text-gray-400">{weekdayOf(day)}</span>}
                </>
              ) : (
                <>
                  <input
                    type="date"
                    className={`${compactInputClass}`}
                    value={range.from}
                    max={range.to || today || undefined}
                    onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
                    aria-label="From date"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    className={`${compactInputClass}`}
                    value={range.to}
                    min={range.from || undefined}
                    max={today || undefined}
                    onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
                    aria-label="To date"
                  />
                  <div className="flex flex-wrap gap-1">
                    {([
                      ["week", "This week"],
                      ["month", "This month"],
                      ["lastMonth", "Last month"],
                      ["last30", "Last 30 days"],
                    ] as const).map(([p, label]) => (
                      <button key={p} className="px-2.5 py-1 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-orange-400" onClick={() => setPreset(p)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold inline-flex items-center gap-1 disabled:bg-gray-400"
                onClick={() => openNew("income")}
                disabled={!defaultEntryDate}
                title="Add income (I)"
              >
                <Plus size={16} /> Income
              </button>
              <button
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-1 disabled:bg-gray-400"
                onClick={() => openNew("expense")}
                disabled={!defaultEntryDate}
                title="Add expense (E)"
              >
                <Minus size={16} /> Expense
              </button>
              <button
                className={`${secondaryBtn} inline-flex items-center gap-1`}
                disabled={!data || entries.length === 0}
                onClick={() =>
                  data &&
                  exportEntriesWorkbook({
                    entries: visible,
                    totals: isFiltered ? filteredTotals : data.totals,
                    from: data.from,
                    to: data.to,
                    balance: data.balance,
                    filtered: isFiltered,
                  })
                }
                title={isFiltered ? "Export the filtered entries" : "Export to Excel"}
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button className={`${secondaryBtn} px-2.5`} onClick={() => setOpeningOpen(true)} title="Opening balance (optional)" aria-label="Opening balance">
                <Wallet size={16} />
              </button>
              <button className={`${secondaryBtn} px-2.5`} onClick={reload} title="Refresh" aria-label="Refresh">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          {renderBody()}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Shortcuts: I add income · E add expense · Left / Right change day · T today · / search · Alt+D dark mode · Esc home
        </p>
      </div>

      {entryModal && (
        <EntryModal
          entryId={entryModal.entryId}
          initial={entryModal.draft}
          maxDay={today}
          knownCategories={data?.categories ?? []}
          onClose={() => setEntryModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && <ConfirmDeleteDialog entry={deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} />}

      {openingOpen && (
        <OpeningBalanceModal
          setting={data?.setting ?? null}
          defaultDate={from || today}
          onClose={() => setOpeningOpen(false)}
          onSaved={() => {
            setOpeningOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
