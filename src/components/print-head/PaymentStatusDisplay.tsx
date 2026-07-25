import React, { useState } from "react";
import { FILE_CATEGORIES } from "@/lib/constants";
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
  loanType?: "daily" | "monthly" | "pending";
  totalToBePaid?: number;
  index?: number;
}

interface PaymentStatusProps {
  loan: Loan;
  selectedDate: string;
  onPaymentDeleted?: () => void;
  onLoanUpdated?: () => void;
  loanType: "daily" | "monthly" | "pending";
}

interface CalculationDetails {
  monthsSinceStart?: number;
  daysSinceStart?: number;
  totalDue: number;
  totalPaidBeforeToday: number;
  todayPayment: number;
  totalPaid: number;
  remainingAfterToday: number;
  extraDaysCovered?: number;
  extraMonthsCovered?: number;
  coveredUntilDate: string;
  nextDayInstallment?: number;
  nextMonthInstallment?: number;
  lateAmount: number;
  overpayment?: number;
  partialNextDayAmount?: number;
  partialNextMonthAmount?: number;
  remainingForLastDay?: number;
  remainingForLastMonth?: number;
  /** Per-day late fee from selected date vs installment due (monthly only). */
  calendarLateFee?: number;
  daysLateCalendar?: number;
}

const PaymentStatusDisplay: React.FC<PaymentStatusProps> = ({
  loan,
  selectedDate,
  onPaymentDeleted,
  onLoanUpdated,
  loanType,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLoan, setEditedLoan] = useState({
    accountNo: loan.accountNo,
    nameGujarati: loan.nameGujarati,
    nameEnglish: loan.nameEnglish,
    installmentAmount: loan.installmentAmount,
    lateAmount: loanType === "pending" ? 0 : loan.lateAmount, // Set lateAmount to 0 for pending loans
    totalToBePaid: loanType === "pending" ? loan.totalToBePaid || 0 : undefined, // Add totalToBePaid for pending loans
    fileCategory: loan.fileCategory,
    receivedDate: new Date(loan.receivedDate).toISOString().split("T")[0],
  });

  // Move functionality state
  const [isMoving, setIsMoving] = useState(false);
  const [targetFileCategory, setTargetFileCategory] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<number[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSavingMove, setIsSavingMove] = useState(false);


  // State to track the target loan type when moving
  const [targetLoanType, setTargetLoanType] = useState<'daily' | 'monthly' | 'pending'>(loanType);

  // Fetch available slots when target file category changes
  const fetchAvailableSlots = async (fileCategory: string, targetType: 'daily' | 'monthly' | 'pending') => {
    if (!fileCategory) {
      setAvailableSlots([]);
      return;
    }

    setIsLoadingSlots(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/loansDoc/available-slots?loanType=${targetType}&fileCategory=${encodeURIComponent(fileCategory)}`
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data.availableSlots);
        setSelectedSlot(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch available slots");
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error("Error fetching available slots:", error);
      setError("Failed to fetch available slots due to network error");
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Handle target file category change
  const handleTargetFileCategoryChange = (value: string) => {
    // Value format is "type:category" (e.g., "daily:Gajanand 2")
    const [type, category] = value.split(':') as ['daily' | 'monthly' | 'pending', string];
    setTargetLoanType(type);
    setTargetFileCategory(category);
    fetchAvailableSlots(category, type);
  };

  // Handle move loan to new file
  const handleMoveLoan = async () => {
    if (!targetFileCategory || selectedSlot === null) {
      setError("Please select a target file and an available slot");
      return;
    }

    setIsSavingMove(true);
    setError(null);

    try {
      const response = await fetch("/api/loansDoc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: loan._id,
          fileCategory: targetFileCategory,
          index: selectedSlot,
          loanType: targetLoanType, // Include loan type for cross-type moves
        }),
      });

      if (response.ok) {
        setIsMoving(false);
        setShowDetails(false);
        setTargetFileCategory("");
        setSelectedSlot(null);
        setAvailableSlots([]);
        setTargetLoanType(loanType); // Reset target loan type
        if (onLoanUpdated) onLoanUpdated();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to move loan");
      }
    } catch (error) {
      console.error("Error moving loan:", error);
      setError("Failed to move loan due to network error");
    } finally {
      setIsSavingMove(false);
    }
  };

  // Cancel move operation
  const handleCancelMove = () => {
    setIsMoving(false);
    setTargetFileCategory("");
    setSelectedSlot(null);
    setAvailableSlots([]);
    setTargetLoanType(loanType); // Reset target loan type
    setError(null);
  };

  const calculatePaymentStatus = () => computePaymentStatus(loan, selectedDate, loanType);

  // Add this new function near handleDeletePayment
  const handleDeleteAllPayments = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL payment histories for this loan?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/loanPayments/deleteAll", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan._id,
        }),
      });

      if (response.ok) {
        if (onPaymentDeleted) onPaymentDeleted();
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete all payments");
      }
    } catch (error) {
      console.error("Error deleting all payments:", error);
      setError("Failed to delete all payments due to network error");
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (
      !confirm(
        `Are you sure you want to delete the payment of ₹${payment.amount
        } on ${new Date(payment.date).toLocaleDateString("en-GB")}?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/loanPayments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan._id,
          date: payment.date,
        }),
      });

      if (response.ok) {
        if (onPaymentDeleted) onPaymentDeleted();
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete payment");
      }
    } catch (error) {
      console.error("Error deleting payment:", error);
      setError("Failed to delete payment due to network error");
    }
  };

  const handleEditLoanChange = (
    field: keyof typeof editedLoan,
    value: string | number
  ) => {
    setEditedLoan((prev) => ({
      ...prev,
      [field]:
        field === "installmentAmount" ||
          field === "lateAmount" ||
          field === "totalToBePaid"
          ? parseFloat(value as string) || 0
          : value,
    }));
  };

  const handleSaveLoan = async () => {
    try {
      const response = await fetch("/api/loansDoc", {
        method: "PUT",
        body: JSON.stringify({
          id: loan._id,
          ...editedLoan,
          ...(loanType === "pending"
            ? { totalToBePaid: editedLoan.totalToBePaid, lateAmount: 0 } // For pending loans, send totalToBePaid and set lateAmount to 0
            : { lateAmount: editedLoan.lateAmount }), // For daily/monthly loans, send lateAmount
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        if (onLoanUpdated) onLoanUpdated();
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update loan");
      }
    } catch (error) {
      console.error("Error updating loan:", error);
      setError("Failed to update loan due to network error");
    }
  };

  const {
    status,
    statusColor,
    nextDueDate,
    calculationDetails,
    statusSubline,
    statusSublineColor,
  } = calculatePaymentStatus();

  const totalDueUpToYesterday =
    loanType === "monthly"
      ? loan.installmentAmount *
      ((calculationDetails.monthsSinceStart || 1) - 1)
      : loanType === "daily"
        ? loan.installmentAmount * ((calculationDetails.daysSinceStart || 1) - 1)
        : 0;
  const remainingUpToYesterday =
    totalDueUpToYesterday - calculationDetails.totalPaidBeforeToday;

  // Updated display logic for previous status
  const displayPrevStatus =
    loanType !== "pending"
      ? `ચડેલ હતા: ₹${remainingUpToYesterday > 0 ? remainingUpToYesterday.toFixed(0) : "0"
      }`
      : "";
  const displayPrevColor =
    remainingUpToYesterday > 0 ? "text-red-600" : "text-yellow-600";

  const isLoanStartDate =
    new Date(loan.receivedDate.split("T")[0]).toISOString().split("T")[0] ===
    new Date(selectedDate.split("T")[0]).toISOString().split("T")[0];

  return (
    <div className="p-4 flex flex-col justify-center items-center rounded-md shadow-sm relative ">
      {/* Removed the redundant late amount display */}
      <div className="flex flex-col">
        <div className={`${statusColor} text-center`}>{status}</div>
        {!isLoanStartDate && loanType !== "pending" && (
          <>
            <div className={`${displayPrevColor} text-sm mt-1 text-center`}>
              {displayPrevStatus}
            </div>
            {loanType === "monthly" && statusSubline && (
              <div
                className={`${statusSublineColor ?? "text-red-600"} text-sm mt-1 text-center`}
              >
                {statusSubline}
              </div>
            )}
          </>
        )}
      </div>
      <button
        onClick={() => setShowDetails(true)}
        className="mt-2 text-blue-500 underline text-sm focus:outline-none"
      >
        Show Detailed Info
      </button>

      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-orange-600 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>

            <div className="space-y-2 mb-4">
              {isEditing ? (
                <>
                  <div>
                    <strong>Account No:</strong>
                    <input
                      type="text"
                      value={editedLoan.accountNo}
                      onChange={(e) =>
                        handleEditLoanChange("accountNo", e.target.value)
                      }
                      className="w-full px-2 py-1 border text-black rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <strong>Name (Gujarati):</strong>
                    <input
                      type="text"
                      value={editedLoan.nameGujarati}
                      onChange={(e) =>
                        handleEditLoanChange("nameGujarati", e.target.value)
                      }
                      className="w-full px-2 py-1 border text-black rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <strong>Name (English):</strong>
                    <input
                      type="text"
                      value={editedLoan.nameEnglish}
                      onChange={(e) =>
                        handleEditLoanChange("nameEnglish", e.target.value)
                      }
                      className="w-full px-2 py-1 border text-black rounded-md mt-1"
                    />
                  </div>
                  {loanType === "pending" ? (
                    <div>
                      <strong>Total to be Paid:</strong>
                      <input
                        type="number"
                        value={editedLoan.totalToBePaid}
                        onChange={(e) =>
                          handleEditLoanChange("totalToBePaid", e.target.value)
                        }
                        className="w-full px-2 py-1 border text-black rounded-md mt-1"
                        min="0"
                      />
                    </div>
                  ) : (
                    <div>
                      <strong>Installment Amount:</strong>
                      <input
                        type="number"
                        value={editedLoan.installmentAmount}
                        onChange={(e) =>
                          handleEditLoanChange(
                            "installmentAmount",
                            e.target.value
                          )
                        }
                        className="w-full px-2 py-1 border text-black rounded-md mt-1"
                        min="0"
                      />
                    </div>
                  )}
                  <div>
                    <strong>File Category:</strong>
                    <input
                      type="text"
                      value={editedLoan.fileCategory}
                      onChange={(e) =>
                        handleEditLoanChange("fileCategory", e.target.value)
                      }
                      className="w-full px-2 py-1 border text-black rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <strong>Received Date:</strong>
                    <input
                      type="date"
                      value={editedLoan.receivedDate}
                      onChange={(e) =>
                        handleEditLoanChange("receivedDate", e.target.value)
                      }
                      className="w-full px-2 py-1 border text-black rounded-md mt-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p>
                    <strong>Account No:</strong> {loan.accountNo}
                  </p>
                  <p>
                    <strong>Name (Gujarati):</strong> {loan.nameGujarati}
                  </p>
                  <p>
                    <strong>Name (English):</strong> {loan.nameEnglish}
                  </p>
                  <p>
                    <strong>
                      {loanType === "pending"
                        ? "Total To Be Paid"
                        : "Installment Amount"}
                      :
                    </strong>
                    ₹
                    {loanType === "pending"
                      ? loan.totalToBePaid
                      : loan.installmentAmount}
                  </p>
                  <p>
                    <strong>File Category:</strong> {loan.fileCategory}
                  </p>
                  <p>
                    <strong>Next Due Date:</strong> {nextDueDate}
                  </p>
                  <p>
                    <strong>Received Date:</strong>{" "}
                    {new Date(loan.receivedDate).toLocaleDateString("en-GB")}
                  </p>
                </>
              )}
            </div>

            <div className="bg-gray-700 p-4 rounded-md mb-4">
              <h3 className="font-semibold mb-2">Calculation Breakdown</h3>
              <div className="space-y-1 text-sm">
                {loanType === "pending" ? (
                  <>
                    <p>Total To Be Paid: ₹{loan.totalToBePaid || 50000}</p>
                    <p>
                      Paid Before Today: ₹
                      {calculationDetails.totalPaidBeforeToday}
                    </p>
                    <p>
                      Today&apos;s Payment: ₹{calculationDetails.todayPayment}
                    </p>
                    <p className="font-semibold">
                      Total Paid: ₹{calculationDetails.totalPaid}
                    </p>
                    {calculationDetails.remainingAfterToday > 0 ? (
                      <p className="text-red-600 font-semibold">
                        Remaining Amount: ₹
                        {calculationDetails.remainingAfterToday}
                      </p>
                    ) : (
                      <p className="text-green-600 font-semibold">
                        Fully Paid{" "}
                        {calculationDetails.remainingAfterToday < 0
                          ? `(Overpaid by ₹${Math.abs(
                            calculationDetails.remainingAfterToday
                          )})`
                          : ""}
                      </p>
                    )}
                  </>
                ) : loanType === "monthly" ? (
                  <>
                    <p>
                      Months since start: {calculationDetails.monthsSinceStart}
                    </p>
                    <p>
                      Total Due (₹{loan.installmentAmount} ×{" "}
                      {calculationDetails.monthsSinceStart}): ₹
                      {calculationDetails.totalDue}
                    </p>
                    <p>
                      Paid Before Today: ₹
                      {calculationDetails.totalPaidBeforeToday}
                    </p>
                    <p>
                      Today&apos;s Payment: ₹{calculationDetails.todayPayment}
                    </p>
                    <p className="font-semibold">
                      Total Paid: ₹{calculationDetails.totalPaid}
                    </p>
                    {calculationDetails.remainingAfterToday > 0 ? (
                      <p className="text-red-600 font-semibold bg-white p-2">
                        Remaining for today: ₹
                        {calculationDetails.remainingAfterToday}
                      </p>
                    ) : calculationDetails.remainingAfterToday === 0 ? (
                      <p className="text-yellow-400 font-semibold">
                        Exactly paid for today. Next payment (₹
                        {loan.installmentAmount}) due tomorrow.
                      </p>
                    ) : (
                      <>
                        <p className="text-green-600 font-semibold">
                          Overpaid by: ₹
                          {Math.abs(calculationDetails.remainingAfterToday)}
                        </p>
                        {calculationDetails.extraMonthsCovered &&
                          calculationDetails.extraMonthsCovered > 0 && (
                            <p className="text-green-600">
                              Payment covers{" "}
                              {calculationDetails.extraMonthsCovered} additional{" "}
                              {calculationDetails.extraMonthsCovered === 1
                                ? "month"
                                : "months"}
                            </p>
                          )}
                        {calculationDetails.partialNextMonthAmount &&
                          calculationDetails.partialNextMonthAmount > 0 &&
                          calculationDetails.remainingForLastMonth && (
                            <p className="text-blue-600">
                              ₹{calculationDetails.partialNextMonthAmount}{" "}
                              applied towards next month (₹
                              {calculationDetails.remainingForLastMonth} still
                              needed)
                            </p>
                          )}
                        <p className="font-semibold">
                          Paid until: {calculationDetails.coveredUntilDate}
                        </p>
                      </>
                    )}
                    <p className="mt-2 font-semibold">
                      Next due: {nextDueDate} (₹
                      {calculationDetails.nextMonthInstallment ||
                        loan.installmentAmount}
                      )
                    </p>
                    {(calculationDetails.calendarLateFee ?? 0) > 0 && (
                      <p className="text-red-400 font-semibold mt-2">
                        Calendar late fee ({calculationDetails.daysLateCalendar}{" "}
                        {calculationDetails.daysLateCalendar === 1
                          ? "day"
                          : "days"}{" "}
                        after due × ₹{loan.lateAmount}/day): ₹
                        {calculationDetails.calendarLateFee?.toFixed(0)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>Days since start: {calculationDetails.daysSinceStart}</p>
                    <p>
                      Total Due (₹{loan.installmentAmount} ×{" "}
                      {calculationDetails.daysSinceStart}): ₹
                      {calculationDetails.totalDue}
                    </p>
                    <p>
                      Paid Before Today: ₹
                      {calculationDetails.totalPaidBeforeToday}
                    </p>
                    <p>
                      Today&apos;s Payment: ₹{calculationDetails.todayPayment}
                    </p>
                    <p className="font-semibold">
                      Total Paid: ₹{calculationDetails.totalPaid}
                    </p>
                    {calculationDetails.remainingAfterToday > 0 ? (
                      <p className="text-red-600 font-semibold bg-white p-2">
                        Remaining for today: ₹
                        {calculationDetails.remainingAfterToday}
                      </p>
                    ) : calculationDetails.remainingAfterToday === 0 ? (
                      <p className="text-yellow-400 font-semibold">
                        Exactly paid for today. Next payment (₹
                        {loan.installmentAmount}) due tomorrow.
                      </p>
                    ) : (
                      <>
                        <p className="text-green-600 font-semibold">
                          Overpaid by: ₹
                          {Math.abs(calculationDetails.remainingAfterToday)}
                        </p>
                        {calculationDetails.extraDaysCovered &&
                          calculationDetails.extraDaysCovered > 0 && (
                            <p className="text-green-600">
                              Payment covers{" "}
                              {calculationDetails.extraDaysCovered} additional{" "}
                              {calculationDetails.extraDaysCovered === 1
                                ? "day"
                                : "days"}
                            </p>
                          )}
                        {calculationDetails.partialNextDayAmount &&
                          calculationDetails.partialNextDayAmount > 0 &&
                          calculationDetails.remainingForLastDay && (
                            <p className="text-blue-600">
                              ₹{calculationDetails.partialNextDayAmount} applied
                              towards tomorrow (₹
                              {calculationDetails.remainingForLastDay} still
                              needed)
                            </p>
                          )}
                        <p className="font-semibold">
                          Paid until: {calculationDetails.coveredUntilDate}
                        </p>
                      </>
                    )}
                    <p className="mt-2 font-semibold">
                      Next due: {nextDueDate} (₹
                      {calculationDetails.nextDayInstallment ||
                        loan.installmentAmount}
                      )
                    </p>
                  </>
                )}
              </div>
            </div>

            {loan.paymentHistory && loan.paymentHistory.length > 0 ? (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold mb-2">Payment History</h3>
                  <button
                    onClick={handleDeleteAllPayments}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete All Payments
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {loan.paymentHistory.map((payment, index) => (
                    <div
                      key={index}
                      className="text-sm flex justify-between items-center mb-1"
                    >
                      <span>
                        {new Date(payment.date).toLocaleDateString("en-GB")}: ₹
                        {payment.amount}
                      </span>
                      <button
                        onClick={() => handleDeletePayment(payment)}
                        className="text-red-600 hover:text-red-700 bg-white p-2 rounded-xl  text-xs underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-white mb-4">
                No payment history available.
              </p>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-600 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}

            <div className="flex space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveLoan}
                    className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600 transition-colors"
                  >
                    Edit Loan
                  </button>
                  <button
                    onClick={() => setIsMoving(true)}
                    className="flex-1 bg-purple-500 text-white py-2 rounded-md hover:bg-purple-600 transition-colors"
                  >
                    Move
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowDetails(false);
                  setIsMoving(false);
                  setIsEditing(false);
                }}
                className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move User Popup Modal */}
      {isMoving && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-purple-600 text-white px-6 py-4">
              <h2 className="text-xl font-bold">Move User to Another File</h2>
              <p className="text-purple-200 text-sm mt-1">
                Moving: {loan.nameGujarati || loan.nameEnglish}
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Current Location Info */}
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <p className="text-gray-600 text-sm">Current Location</p>
                <p className="text-gray-900 font-semibold">
                  {loan.fileCategory} → Slot {loan.index || 'N/A'}
                </p>
              </div>

              {/* Target File Selection */}
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                  Select Target File:
                </label>
                <select
                  value={targetFileCategory ? `${targetLoanType}:${targetFileCategory}` : ""}
                  onChange={(e) => handleTargetFileCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 focus:border-purple-500 focus:outline-none text-lg"
                >
                  <option value="">-- Choose a File --</option>
                  <optgroup label="📅 Daily Loans">
                    {FILE_CATEGORIES.daily
                      .filter(cat => !(cat === loan.fileCategory && loanType === 'daily'))
                      .map(cat => (
                        <option key={`daily:${cat}`} value={`daily:${cat}`}>
                          {cat}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="📆 Monthly Loans">
                    {FILE_CATEGORIES.monthly
                      .filter(cat => !(cat === loan.fileCategory && loanType === 'monthly'))
                      .map(cat => (
                        <option key={`monthly:${cat}`} value={`monthly:${cat}`}>
                          {cat}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="⏳ Pending Loans">
                    {FILE_CATEGORIES.pending
                      .filter(cat => !(cat === loan.fileCategory && loanType === 'pending'))
                      .map(cat => (
                        <option key={`pending:${cat}`} value={`pending:${cat}`}>
                          {cat}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Loading State */}
              {isLoadingSlots && (
                <div className="text-center py-6">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                  <p className="text-gray-600 mt-2">Loading available slots...</p>
                </div>
              )}

              {/* Available Slots Grid */}
              {!isLoadingSlots && targetFileCategory && availableSlots.length > 0 && (
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">
                    Select Slot ({availableSlots.length} available):
                  </label>
                  <div className="border-2 border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-9 gap-2">
                      {Array.from({ length: 90 }, (_, i) => i + 1).map((slot) => {
                        const isAvailable = availableSlots.includes(slot);
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            onClick={() => isAvailable && setSelectedSlot(slot)}
                            disabled={!isAvailable}
                            className={`w-8 h-8 text-sm font-medium rounded-md transition-all ${isSelected
                              ? "bg-purple-600 text-white ring-2 ring-purple-300"
                              : isAvailable
                                ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              }`}
                            title={isAvailable ? `Select slot ${slot}` : `Slot ${slot} is occupied`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedSlot && (
                    <div className="mt-3 bg-purple-100 text-purple-800 px-4 py-2 rounded-lg flex items-center">
                      <span className="font-medium">Selected Slot: {selectedSlot}</span>
                    </div>
                  )}
                </div>
              )}

              {/* No Slots Available Message */}
              {!isLoadingSlots && targetFileCategory && availableSlots.length === 0 && (
                <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg">
                  No available slots in {targetFileCategory}. All 90 slots are occupied.
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mt-4">
                  {error}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-gray-50 px-6 py-4 flex space-x-3">
              <button
                onClick={handleMoveLoan}
                disabled={!targetFileCategory || selectedSlot === null || isSavingMove}
                className={`flex-1 py-3 rounded-lg font-semibold text-white transition-all ${!targetFileCategory || selectedSlot === null || isSavingMove
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
                  }`}
              >
                {isSavingMove ? (
                  <span className="flex items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent mr-2"></span>
                    Moving...
                  </span>
                ) : (
                  "Confirm Move"
                )}
              </button>
              <button
                onClick={handleCancelMove}
                className="flex-1 py-3 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentStatusDisplay;
