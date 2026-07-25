import * as XLSX from "xlsx";
import { computePaymentStatus } from "@/lib/paymentStatus";

interface Payment {
  _id?: string;
  date: string;
  amount: number;
}

interface Loan {
  _id: string;
  accountNo: string;
  nameEnglish: string;
  nameGujarati: string;
  installmentAmount: number;
  lateAmount: number;
  receivedDate: string;
  paymentReceivedToday: number;
  receivedAmount: number;
  fileCategory: string;
  paymentHistory?: Payment[];
  index?: number;
  loanType?: "daily" | "monthly" | "pending";
  totalToBePaid?: number;
}

interface BuildOptions {
  loans: Loan[];
  loanType: "daily" | "monthly" | "pending";
  selectedDate: string;
  currentCategory?: string;
}

// The printable sheet is a fixed 45-row grid split into two side-by-side halves.
const ROWS_PER_SIDE = 45;

/**
 * Reproduces the exact text PrintablePaymentTable puts in the "ચડેલ" column.
 *
 * computePaymentStatus already prefixes amounts with ₹ and leaves dates bare,
 * which matches the print component. The one difference is the monthly late-fee
 * case: the printout appends "(L:<fee>)" inline where the interactive table
 * shows it as a separate subline.
 */
function getPrintedStatus(
  loan: Loan,
  selectedDate: string,
  loanType: "daily" | "monthly" | "pending"
) {
  const { status, calculationDetails } = computePaymentStatus(
    loan,
    selectedDate,
    loanType
  );

  if (loanType === "monthly") {
    const { remainingAfterToday, calendarLateFee } = calculationDetails;
    if (remainingAfterToday > 0 && (calendarLateFee ?? 0) > 0) {
      return `${status} (L:${calendarLateFee!.toFixed(0)})`;
    }
  }

  return status;
}

/**
 * Lays the loans into the same 90-slot grid the printable table uses: slots are
 * addressed by loan.index, gaps stay empty, first 45 on the left half.
 */
function getTableData(loans: Loan[]) {
  const tableData: (Loan | null)[] = new Array(ROWS_PER_SIDE * 2).fill(null);

  loans.forEach((loan) => {
    if (loan.index && loan.index >= 1 && loan.index <= ROWS_PER_SIDE * 2) {
      tableData[loan.index - 1] = loan;
    }
  });

  return {
    leftSide: tableData.slice(0, ROWS_PER_SIDE),
    rightSide: tableData.slice(ROWS_PER_SIDE),
  };
}

/**
 * Builds the Excel version of the print preview: same header band, same
 * हપ્તો/નામ/ચડેલ/આવેલ columns twice across, same 45 rows including blanks, and
 * the same "આવેલ" column left empty for filling in by hand.
 */
export function buildPaymentTableWorkbook({
  loans,
  loanType,
  selectedDate,
  currentCategory,
}: BuildOptions) {
  const { leftSide, rightSide } = getTableData(loans);

  const formattedDate = new Date(selectedDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dayName = new Date(selectedDate)
    .toLocaleDateString("en-US", { weekday: "long" })
    .toUpperCase();

  const cellsFor = (loan: Loan | null) => {
    if (!loan) return ["", "", "", ""];

    const installment =
      loan.installmentAmount && loanType !== "pending"
        ? loan.installmentAmount
        : "";
    const name =
      loan.index && loanType !== "pending"
        ? `${loan.nameGujarati || ""} ${loan.accountNo}`.trim()
        : loan.nameGujarati || "";

    // Fourth column ("આવેલ") is intentionally blank - it is filled in on paper.
    return [installment, name, getPrintedStatus(loan, selectedDate, loanType), ""];
  };

  const rows: (string | number)[][] = [
    [
      `DATE: ${formattedDate}`,
      "",
      `શ્રી ગણેશાયનમઃ    ${currentCategory ?? ""}`.trim(),
      "",
      "",
      "",
      `DAY: ${dayName}`,
      "",
    ],
    ["હપ્તો", "નામ", "ચડેલ", "આવેલ", "હપ્તો", "નામ", "ચડેલ", "આવેલ"],
  ];

  for (let rowIndex = 0; rowIndex < ROWS_PER_SIDE; rowIndex++) {
    rows.push([
      ...cellsFor(leftSide[rowIndex]),
      ...cellsFor(rightSide[rowIndex]),
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Header band: date on the left, title + category across the middle, day right.
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } },
  ];

  // Roughly the column proportions of the printed A4 sheet.
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 13 },
    { wch: 9 },
    { wch: 8 },
    { wch: 24 },
    { wch: 13 },
    { wch: 9 },
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName =
    `${loanType} ${currentCategory ?? ""}`.trim().slice(0, 31) || "Loans";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const categoryPart = currentCategory
    ? `${currentCategory.replace(/\s+/g, "_")}-`
    : "";

  return {
    buffer: XLSX.write(workbook, { bookType: "xlsx", type: "array" }),
    fileName: `${loanType}-loans-${categoryPart}${selectedDate}.xlsx`,
  };
}
