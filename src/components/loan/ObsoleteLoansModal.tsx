"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Loader2, RotateCcw, X } from "lucide-react";

export interface ObsoleteLoan {
  _id: string;
  date?: string;
  mDate?: string;
  amount?: number;
  period?: number;
  isDaily?: boolean;
  instAmount?: number;
  mAmount?: number;
  holderName: string;
  holderAddress?: string;
  telephone1?: string;
  telephone2?: string;
  name?: string;
  hasGuarantor?: boolean;
  guarantors?: {
    holderName: string;
    address: string;
    telephone: string;
    city: string;
  }[];
  obsoletedAt?: string;
}

interface ObsoleteLoansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: (accountNo: string) => void;
  onError: (message: string) => void;
}

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN");
};

const ObsoleteLoansModal = ({
  isOpen,
  onClose,
  onRestored,
  onError,
}: ObsoleteLoansModalProps) => {
  const [obsoleteLoans, setObsoleteLoans] = useState<ObsoleteLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Kept in a ref so the callers can pass inline handlers without retriggering
  // the fetch effect on every render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const fetchObsoleteLoans = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/obsoleteLoans");
      setObsoleteLoans(response.data);
    } catch (error) {
      console.error("Error fetching obsolete accounts:", error);
      setObsoleteLoans([]);
      onErrorRef.current("Failed to load obsolete accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      fetchObsoleteLoans();
    }
  }, [isOpen]);

  // Escape closes this modal without bubbling up to the page level listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleRestore = async (obsoleteLoan: ObsoleteLoan) => {
    const confirmed = window.confirm(
      `Restore ${obsoleteLoan.holderName}? A new account number will be assigned.`
    );
    if (!confirmed) return;

    setRestoringId(obsoleteLoan._id);
    try {
      const response = await axios.post(
        `/api/obsoleteLoans/${obsoleteLoan._id}/restore`
      );
      setObsoleteLoans((prev) =>
        prev.filter((item) => item._id !== obsoleteLoan._id)
      );
      onRestored(response.data.accountNo);
    } catch (error) {
      console.error("Error restoring obsolete account:", error);
      onErrorRef.current("Failed to restore the account");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  const term = searchTerm.trim().toLowerCase();
  const filteredLoans = term
    ? obsoleteLoans.filter(
        (loan) =>
          loan.holderName?.toLowerCase().includes(term) ||
          loan.name?.toLowerCase().includes(term) ||
          loan.telephone1?.toLowerCase().includes(term)
      )
    : obsoleteLoans;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obsolete-modal-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b dark:border-gray-700">
          <h2
            id="obsolete-modal-title"
            className="text-2xl font-bold text-orange-600"
          >
            Obsolete Accounts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            placeholder="Search by holder name, name or telephone"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-gray-600 dark:text-gray-300">
                Loading obsolete accounts...
              </p>
            </div>
          ) : filteredLoans.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              No obsolete accounts found.
            </p>
          ) : (
            <ul className="space-y-4">
              {filteredLoans.map((loan) => (
                <li
                  key={loan._id}
                  className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold uppercase text-gray-900 dark:text-white">
                        {loan.holderName}
                      </h3>
                      {loan.name && (
                        <p className="text-base uppercase text-gray-600 dark:text-gray-300">
                          {loan.name}
                        </p>
                      )}
                      {loan.holderAddress && (
                        <p className="text-sm uppercase text-gray-500 dark:text-gray-400 mt-1">
                          {loan.holderAddress}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-3 text-sm text-gray-700 dark:text-gray-300">
                        <div>
                          <span className="font-semibold">Amount: </span>
                          {loan.amount ?? "-"}
                        </div>
                        <div>
                          <span className="font-semibold">Installment: </span>
                          {loan.instAmount ?? "-"}
                        </div>
                        <div>
                          <span className="font-semibold">M. Amount: </span>
                          {loan.mAmount ?? "-"}
                        </div>
                        <div>
                          <span className="font-semibold">Type: </span>
                          {loan.isDaily ? "Daily" : "Monthly"}
                        </div>
                        <div>
                          <span className="font-semibold">Period: </span>
                          {loan.period ?? "-"}
                        </div>
                        <div>
                          <span className="font-semibold">Date: </span>
                          {formatDate(loan.date)}
                        </div>
                        <div>
                          <span className="font-semibold">M. Date: </span>
                          {formatDate(loan.mDate)}
                        </div>
                        <div>
                          <span className="font-semibold">Phone: </span>
                          {loan.telephone1 || "-"}
                          {loan.telephone2 ? `, ${loan.telephone2}` : ""}
                        </div>
                      </div>

                      {loan.guarantors && loan.guarantors.length > 0 && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-semibold">Guarantors: </span>
                          {loan.guarantors
                            .map((g) => g.holderName)
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}

                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Obsoleted on {formatDate(loan.obsoletedAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(loan)}
                      disabled={restoringId === loan._id}
                      className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-md font-semibold transition-colors shrink-0"
                    >
                      {restoringId === loan._id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <RotateCcw size={18} />
                      )}
                      {restoringId === loan._id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2.5 px-4 rounded-md font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObsoleteLoansModal;
