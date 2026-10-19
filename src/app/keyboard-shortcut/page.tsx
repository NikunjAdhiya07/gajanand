"use client";
import { Ubuntu } from "next/font/google";
import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNavigationStore } from "@/store/NavigationStore";
const ubuntu = Ubuntu({
  weight: "400",
  subsets: ["latin"],
});

interface Shortcut {
  key: string;
  action: string;
}

interface SectionProps {
  title: string;
  shortcuts: Shortcut[];
}

const ShortcutKeys = () => {
  const router = useRouter();
  const setSelectedNavItem = useNavigationStore(
    (state) => state.setSelectedNavItem
  );

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, altKey } = event;

    const shortcuts: Record<string, () => void> = {
      "ctrl+d": () => alert("Selecting Date for Collection Book"),
      "f1": () => alert("Account Finder"),
      "alt+d": () => document.documentElement.classList.toggle("dark"),
      "ctrl+l": () => alert("Navigating to Loan"),
      "alt+s": () => alert("Saving Payments"),
      "arrowup": () => alert("Moving through indexes"),
      "arrowdown": () => alert("Moving through indexes"),
      "enter": () => alert("Moving to next field / Fetching data"),
      "escape": () => {
        router.push("/");
        
      },
      "alt+g": () => alert("Adding Guarantor"),
    };

    const keyCombo = `${ctrlKey ? "ctrl+" : ""}${altKey ? "alt+" : ""}${key.toLowerCase()}`;
    if (shortcuts[keyCombo]) {
      event.preventDefault();
      shortcuts[keyCombo]();
    }
  }, [router, setSelectedNavItem]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const Section = ({ title, shortcuts }: SectionProps) => (
    <section 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 dark:bg-gray-800"
      aria-label={`${title} shortcuts`}
    >
      <div className="bg-orange-100 p-4 rounded-t-lg dark:bg-gray-700">
        <h2 className="text-xl md:text-2xl font-bold text-orange-700 dark:text-orange-300">
          {title}
        </h2>
      </div>
      <div className="p-4 space-y-3">
        {shortcuts.map(({ key, action }) => (
          <div
            key={key}
            className="flex justify-between items-center p-2 hover:bg-orange-50 rounded transition-colors duration-150 dark:hover:bg-gray-600"
          >
            <kbd className="font-semibold bg-orange-100 px-2.5 py-1.5 rounded text-orange-700 dark:bg-gray-600 dark:text-orange-300">
              {key}
            </kbd>
            <span className="text-gray-700 dark:text-gray-200 text-sm md:text-base">
              → {action}
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div
      className={`min-h-screen p-6 mx-auto  space-y-8 bg-gray-50 dark:bg-gray-900 ${ubuntu.className} antialiased`}
    >
      <h1 className="text-3xl md:text-4xl font-bold text-center text-orange-600 dark:text-orange-300 mb-8">
        Shortcut Keys Guide
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Section
          title="Collection Book"
          shortcuts={[
            { key: "Ctrl + D", action: "Select Date" },
            { key: "F1", action: "Account Finder" },
            { key: "Alt + D", action: "Toggle Dark Mode" },
            { key: "Ctrl + L", action: "Navigate to Loan" },
            { key: "Alt + S", action: "Save Payments" },
            { key: "Arrow Keys", action: "Move Between Indexes" },
            { key: "Enter", action: "Move to Next Field" },
            { key: "Escape", action: "Move to Home" },
          ]}
        />
        <Section
          title="Day Book"
          shortcuts={[
            { key: "I", action: "Add Income" },
            { key: "E", action: "Add Expense" },
            { key: "Left / Right", action: "Previous / Next Day" },
            { key: "T", action: "Go to Today" },
            { key: "/", action: "Search Entries" },
            { key: "Ctrl + Enter", action: "Save Entry" },
            { key: "Escape", action: "Close Dialog / Move to Home" },
          ]}
        />
        <Section
          title="Loan Ledger"
          shortcuts={[
            { key: "F1", action: "Account Finder" },
            { key: "Escape", action: "Move to Home" },
          ]}
        />
        <Section
          title="Monthly Yearly Collection"
          shortcuts={[
            { key: "Enter", action: "Fetch Collections" },
            { key: "Escape", action: "Move to Home" },
            { key: "F1", action: "Account Finder" },
          ]}
        />
        <Section
          title="B-6"
          shortcuts={[
            { key: "Enter", action: "Fetch Payment Details" },
            { key: "Escape", action: "Move to Home" },
          ]}
        />
        <Section
          title="Deposit Ledger"
          shortcuts={[
            { key: "Enter", action: "Fetch Deposits" },
            { key: "Escape", action: "Move to Home" },
            { key: "F1", action: "Account Finder" },
          ]}
        />
        <Section
          title="Loan"
          shortcuts={[
            { key: "Enter", action: "Move to Next Field" },
            { key: "Arrow Keys", action: "Navigate Fields" },
            { key: "Escape", action: "Move to Home" },
            { key: "F1", action: "Account Finder" },
            { key: "Alt + S", action: "Save / Update Loan" },
            { key: "Alt + D", action: "Toggle Dark Mode" },
            { key: "Alt + G", action: "Add Guarantor" },
          ]}
        />
        <Section
          title="Financial Statement"
          shortcuts={[{ key: "Escape", action: "Move to Home" }]}
        />
        <Section
          title="Creditor/Debtor"
          shortcuts={[
            { key: "Escape", action: "Move to Home" },
            { key: "F1", action: "Account Finder" },
            { key: "Enter", action: "Fetch Loan Details" },
          ]}
        />
      </div>
    </div>
  );
};

export default ShortcutKeys;