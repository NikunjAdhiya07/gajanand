"use client";
import { Ubuntu } from "next/font/google";
import React, { useState, useRef, KeyboardEvent, useEffect } from "react";
import { GuarantorData } from "@/types/types";
import { LoanFormData } from "@/types/types";
import FormInput, {
  FormNavigationProvider,
} from "@/components/FormInput/FormInput";
import axios from "axios";
import { useRouter } from "next/navigation";
import TimeDisplay from "@/ui/TimeDisplay";
import AccountFinder from "../accountFinder/AccountFinder";
import Image from "next/image";
import { Archive, Loader2, Search } from "lucide-react";
import CustomAlertDialog from "@/components/customAlertDialog/CustomAlertDialog";
import ObsoleteLoansModal from "@/components/loan/ObsoleteLoansModal";

const ubuntu = Ubuntu({
  weight: "400",
  subsets: ["latin"],
});

export default function LoanForm() {
  const fetchNextAccountNo = async (force = false) => {

    if (!force && nextAccountNo) return;
    try {
      const response = await axios({
        method: "get",
        url: "/api/loans/next-account",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      const next = response.data.nextAccountNo;
      setNextAccountNo(next);
      setFormData((prev) => ({
        ...prev,
        accountNo: next,
      }));
    } catch (error) {
      console.error("Error fetching next account number:", error);
      if (axios.isAxiosError(error)) {
        console.log("Status:", error.response?.status);
        console.log("Response:", error.response?.data);
      }
      setAlertMessage(
        "Failed to fetch next account number"
      );
      setAlertOpen(true);
    }
  };

  const formatDate = (
    date: Date,
    format: "display" | "input" = "display"
  ): string => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
    const year = date.getFullYear();

    if (format === "input") {
      return `${year}-${month}-${day}`; // YYYY-MM-DD for input type="date"
    }
    return `${day}/${month}/${year}`; // DD/MM/YYYY for display
  };

  const [isExisting, setIsExisting] = useState(false);
  const [nextAccountNo, setNextAccountNo] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressEnterCount, setAddressEnterCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isObsoleteModalOpen, setIsObsoleteModalOpen] = useState(false);
  const [isObsoleting, setIsObsoleting] = useState(false);
  const [selectedAccountNo, setSelectedAccountNo] = useState("");
  const addGuarantorButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [formData, setFormData] = useState<LoanFormData>({
    accountNo: "",
    loanNo: "",
    date: formatDate(new Date()),
    mDate: formatDate(new Date()),
    amount: "",
    period: "",
    isDaily: true,
    instAmount: "",
    mAmount: "",
    holderName: "",
    holderAddress: "",
    telephone1: "",
    telephone2: "",
    name: "",
    hasGuarantor: false,
    guarantors: [],
  });

  const initialFormState: LoanFormData = {
    accountNo: "",
    loanNo: "",
    date: formatDate(new Date()),
    mDate: formatDate(new Date()),
    amount: "",
    period: "",
    isDaily: true,
    instAmount: "",
    mAmount: "",
    holderName: "",
    holderAddress: "",
    telephone1: "",
    telephone2: "",
    name: "",
    hasGuarantor: false,
    guarantors: [],
  };

  const [errors, setErrors] = useState<
    Partial<Record<keyof LoanFormData, string>>
  >({});

  const inputRefs = useRef<
    Record<string, HTMLInputElement | HTMLTextAreaElement | null>
  >({});

  const [isLoading, setIsLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Get today's date and day
  const today = new Date();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const formattedDate = `${days[today.getDay()]}, ${today.toLocaleDateString(
    "en-IN"
  )}`;
  const guarantorSectionRef = useRef<HTMLDivElement>(null);

  // Theme management effect - similar to your root layout
  useEffect(() => {
    // Check saved theme on mount
    const savedTheme = localStorage.getItem("theme");
    if (!savedTheme) {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      setIsDarkMode(savedTheme === "dark");
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  // Theme toggle handler
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      if (newMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return newMode;
    });
  };

  // Keyboard shortcut for theme toggle
  useEffect(() => {
    const handleThemeToggle = (e: WindowEventMap["keydown"]) => {
      if (e.key.toLowerCase() === "d" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", handleThemeToggle);
    return () => window.removeEventListener("keydown", handleThemeToggle);
  }, []);

  // Parse DD/MM/YYYY back to a Date object
  const parseDate = (dateStr: string): Date => {
    if (dateStr.includes("-")) {
      // Handle YYYY-MM-DD format
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    } else {
      // Handle DD/MM/YYYY format
      const [day, month, year] = dateStr.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
  };

  // Calculate maturity date when period changes
  const calculateMaturityDate = (
    baseDate: string,
    daysToAdd: string
  ): string => {
    if (!daysToAdd || isNaN(Number(daysToAdd))) return baseDate;

    const base = parseDate(baseDate); // Parse YYYY-MM-DD or DD/MM/YYYY
    base.setDate(base.getDate() + parseInt(daysToAdd, 10));
    return formatDate(base, "display"); // Return in DD/MM/YYYY format
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      inputRefs.current["holderAddress"]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      inputRefs.current["holderAddress"]?.focus();
    }
  };

  // Modify the telephone1 field to handle up arrow
  const handleTelephone1KeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      inputRefs.current["holderAddress"]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      inputRefs.current["telephone2"]?.focus();
    }
  };

  const focusNextField = (currentField: string) => {
    // Define the exact order you want, including address, payment type, and telephone2
    const fieldOrder = [
      "accountNo",
      "loanNo",
      "date",
      "amount",
      "period",
      "isDaily",
      "instAmount",
      "mAmount",
      "mDate",
      "holderName",
      "name",
      "holderAddress",
      "telephone1",
      "telephone2",
    ];
    const currentIndex = fieldOrder.indexOf(currentField);
    if (currentIndex > -1 && currentIndex < fieldOrder.length - 1) {
      const nextField = fieldOrder[currentIndex + 1];
      const nextElement = inputRefs.current[nextField];
      if (nextElement) {
        nextElement.focus();
        scrollToField(nextElement);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, field: string) => {
    if (e.altKey && e.key === "s") {
      console.log("Alt + S detected"); // Debugging
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent); // Trigger form submission
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "accountNo") {
        // Trigger the handleAccountNoChange function when Enter is pressed
        const syntheticEvent = {
          target: { value: formData.accountNo },
        } as React.ChangeEvent<HTMLInputElement>;
        handleAccountNoChange(syntheticEvent);
      }
      if (field === "telephone2") {
        // Focus the Add Guarantor button using ref
        addGuarantorButtonRef.current?.focus();


      } else {
        focusNextField(field);
      }
    } else if (e.altKey && e.key === "g") {
      e.preventDefault();
      addGuarantor();
    }

  };

  const initializeApp = async () => {
    setIsLoading(true);
    try {
      const response = await axios({
        method: "get",
        url: "/api/loans/next-account",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const next = response.data.nextAccountNo;
      setNextAccountNo(next);
      setFormData((prev) => ({
        ...prev,
        accountNo: next,
        loanNo: next,
      }));
    } catch (error) {
      console.error("Error initializing app:", error);
      if (axios.isAxiosError(error)) {
        console.log("Status:", error.response?.status);
        console.log("Response:", error.response?.data);
      }
      setAlertMessage(
        "Failed to initialize application"
      );
      setAlertOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Call initialization on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const handleGuarantorKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
    field: string,
    currentIndex: number
  ) => {
    const guarantorFields = ["holderName", "address", "telephone", "city"];
    const currentFieldIndex = guarantorFields.indexOf(field);

    switch (e.key) {
      case "Enter":
      case "ArrowDown":
        e.preventDefault();
        if (currentFieldIndex < guarantorFields.length - 1) {
          // Move to next field in same guarantor
          const nextField = `guarantor-${index}-${guarantorFields[currentFieldIndex + 1]
            }`;
          const nextElement = inputRefs.current[nextField];
          if (nextElement) {
            nextElement.focus();
            scrollToField(nextElement);
          }
        } else if (currentIndex < formData.guarantors.length - 1) {
          // Move to first field of next guarantor
          const nextIndex = currentIndex + 1;
          const nextField = `guarantor-${nextIndex}-holderName`;
          const nextElement = inputRefs.current[nextField];
          if (nextElement) {
            nextElement.focus();
            scrollToField(nextElement);
          }
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (currentFieldIndex > 0) {
          // Move to previous field in same guarantor
          const prevField = `guarantor-${index}-${guarantorFields[currentFieldIndex - 1]
            }`;
          const prevElement = inputRefs.current[prevField];
          if (prevElement) {
            prevElement.focus();
            scrollToField(prevElement);
          }
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (index > 0) {
          // Move to same field in previous guarantor
          const prevGuarantorField = `guarantor-${index - 1}-${field}`;
          const prevElement = inputRefs.current[prevGuarantorField];
          if (prevElement) {
            prevElement.focus();
            scrollToField(prevElement);
          }
        } else if (field === "holderName") {
          // If at first guarantor's name field, move to telephone2
          const telephone2Element = inputRefs.current["telephone2"];
          if (telephone2Element) {
            telephone2Element.focus();
            scrollToField(telephone2Element);
          }
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (index < formData.guarantors.length - 1) {
          // Move to same field in next guarantor
          const nextGuarantorField = `guarantor-${index + 1}-${field}`;
          const nextElement = inputRefs.current[nextGuarantorField];
          if (nextElement) {
            nextElement.focus();
            scrollToField(nextElement);
          }
        }
        break;
    }
  };

  const addGuarantor = () => {
    if (!formData.hasGuarantor) {
      setFormData({ ...formData, hasGuarantor: true });
    }

    const newGuarantor: GuarantorData = {
      holderName: "",
      address: "",
      telephone: "",
      city: "",
    };

    setFormData((prevData) => {
      const updatedData = {
        ...prevData,
        guarantors: [...prevData.guarantors, newGuarantor],
      };

      // Use setTimeout to ensure the DOM is updated before focusing
      setTimeout(() => {
        const newGuarantorIndex = updatedData.guarantors.length - 1;
        const firstField = `guarantor-${newGuarantorIndex}-holderName`;
        const element = inputRefs.current[firstField];
        if (element) {
          element.focus();
          scrollToField(element);
        }
      }, 0);

      return updatedData;
    });

    // Add smooth scrolling after state update
    setTimeout(() => {
      guarantorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const removeGuarantor = (index: number) => {
    setFormData({
      ...formData,
      guarantors: formData.guarantors.filter((_, i) => i !== index),
    });
    if (formData.guarantors.length === 1) {
      setFormData((prev) => ({ ...prev, hasGuarantor: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Convert date strings from DD/MM/YYYY to JavaScript Date objects
      const convertDateString = (dateStr: string): Date => {
        if (dateStr.includes("-")) {
          const [year, month, day] = dateStr.split("-").map(Number);
          return new Date(year, month - 1, day);
        } else {
          const [day, month, year] = dateStr.split("/").map(Number);
          return new Date(year, month - 1, day);
        }
      };

      // Format the data exactly as it's working in Postman
      const submitData = {
        accountNo: formData.accountNo,
        loanNo: formData.loanNo,
        date: convertDateString(formData.date),
        mDate: convertDateString(formData.mDate),
        amount: Number(formData.amount),
        period: Number(formData.period),
        isDaily: formData.isDaily,
        instAmount: Number(formData.instAmount),
        mAmount: Number(formData.mAmount),
        holderName: formData.holderName,
        holderAddress: formData.holderAddress,
        telephone1: formData.telephone1,
        telephone2: formData.telephone2,
        name: formData.name,
        hasGuarantor: formData.hasGuarantor,
        guarantors: formData.guarantors.map((g) => ({
          holderName: g.holderName,
          address: g.address,
          telephone: g.telephone,
          city: g.city,
        })),
      };

      // Make the request with explicit configuration
      const response = await axios({
        method: isExisting ? "put" : "post",
        // Fix the syntax error in the URL construction
        url: isExisting ? "/api/loans" : `/api/loans`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: submitData,
      });

      if (response.status === 200 || response.status === 201) {
        setAlertMessage(
          isExisting
            ? "Loan updated successfully!"
            : "Loan created successfully!"
        );
        setAlertOpen(true);

        // Reset form and fetch next account number if it's a new loan
        if (!isExisting) {
          setFormData(initialFormState);
          fetchNextAccountNo();
        }
      }
    } catch {
      setAlertMessage("Error submitting data");
      setAlertOpen(true)
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move the loaded account to the obsolete list. Everything about the holder
  // is kept except the account number, which is freed up for reuse.
  const handleObsolete = async () => {
    if (
      !window.confirm(
        `Move ${formData.holderName || "this account"} to obsolete? The account number ${formData.accountNo
        } will be released and can be given to a new account.`
      )
    )
      return;

    setIsObsoleting(true);
    try {
      await axios({
        method: "post",
        url: "/api/obsoleteLoans",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        data: { accountNo: formData.accountNo },
      });

      setFormData(initialFormState);
      setIsExisting(false);
      await fetchNextAccountNo(true);
      setAlertMessage("Account moved to obsolete successfully!");
      setAlertOpen(true);
    } catch (error) {
      console.error("Error obsoleting loan:", error);
      setAlertMessage(
        (axios.isAxiosError(error) && error.response?.data?.message) ||
        "Error moving account to obsolete"
      );
      setAlertOpen(true);
    } finally {
      setIsObsoleting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this loan?")) return;

    try {
      // First, delete the loan
      await axios({
        method: "delete",
        url: `/api/loans/${formData.accountNo}`,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      // Ask the user if they want to delete the payment history as well
      const shouldDeletePaymentHistory = window.confirm(
        "Do you also want to delete the payment history for this loan?"
      );

      if (shouldDeletePaymentHistory) {
        try {
          // Attempt to delete payment history for the same accountNo
          await axios({
            method: "delete",
            url: `/api/payment-history/${formData.accountNo}`,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            setAlertMessage(
              "No payment history found for this loan."
            );
            setAlertOpen(true);
          } else {
            console.error("Error deleting payment history:", error);
            setAlertMessage(
              "Failed to delete the payment history"
            );
            setAlertOpen(true);
          }
        }
      }

      setFormData(initialFormState);
      fetchNextAccountNo();
      setIsExisting(false);
      setAlertMessage(
        "Loan deleted successfully!"
      );
      setAlertOpen(true);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error Status:", error.response?.status);
        console.error("Error Data:", error.response?.data);
        setAlertMessage(
          error.response?.data?.message || "Error deleting loan"
        );
        setAlertOpen(true);
      }
    }
  };

  const scrollToField = (element: HTMLElement | null) => {
    if (element) {
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      const middle =
        absoluteElementTop - window.innerHeight / 2 + elementRect.height / 2;

      window.scrollTo({
        top: middle,
        behavior: "smooth",
      });
    }
  };

  const handlePaymentTypeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      inputRefs.current["period"]?.focus();
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      inputRefs.current["instAmount"]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFormData((prev) => ({ ...prev, isDaily: true }));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setFormData((prev) => ({ ...prev, isDaily: false }));
    }
  };

  useEffect(() => {
    fetchNextAccountNo();
  }, []);

  useEffect(() => {
    const handleThemeToggle = (e: WindowEventMap["keydown"]) => {
      if (e.key.toLowerCase() === "d" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setIsDarkMode((prev) => !prev);
        // Toggle dark class on document
        if (document.documentElement.classList.contains("dark")) {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
        }
      }
    };

    window.addEventListener("keydown", handleThemeToggle);
    return () => window.removeEventListener("keydown", handleThemeToggle);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: WindowEventMap["keydown"]) => {
      if (e.key === "Escape") {
        if (!isModalOpen && !isObsoleteModalOpen) {
          // Only navigate back if no modal is open
          router.push("/");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isObsoleteModalOpen]);

  const handlePeriodKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      inputRefs.current["isDaily"]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      inputRefs.current["isDaily"]?.focus();
    }
  };

  // Handle Installment Amount keyboard navigation
  const handleInstAmountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      inputRefs.current["isDaily"]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      inputRefs.current["mAmount"]?.focus();
    }
  };

  const handleAccountNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, accountNo: value, loanNo: value }));
  };

  // const handleAccountNoKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
  //   if (e.key === 'Enter') {
  //     e.preventDefault();
  //     const accountNo = formData.accountNo.trim();

  //     if (accountNo) {
  //       try {
  //         const response = await axios.get(`/api/loans/${accountNo}`);
  //         if (response.data) {
  //           setFormData({
  //             ...response.data,
  //             date: formatDate(new Date(response.data.date), "input"), // Convert to YYYY-MM-DD
  //             mDate: formatDate(new Date(response.data.mDate), "display"), // Keep as DD/MM/YYYY
  //           });
  //           setIsExisting(true);
  //         }
  //       } catch (error) {
  //         if (axios.isAxiosError(error) && error.response?.status === 404) {
  //           setIsExisting(false);
  //           setFormData({
  //             ...initialFormState,
  //             accountNo: accountNo,
  //             loanNo: accountNo,
  //             date: formatDate(new Date(), "input"), // Set today's date in YYYY-MM-DD
  //           });
  //         }
  //       }
  //     }
  //   }
  // };

  // Add initial focus effect
  const handleAccountNoBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const accountNo = e.target.value.trim();

    if (accountNo) {
      try {
        const response = await axios.get(`/api/loans/${accountNo}`);
        if (response.data) {
          setFormData({
            ...response.data,
            date: formatDate(new Date(response.data.date), "input"), // Convert to YYYY-MM-DD
            mDate: formatDate(new Date(response.data.mDate), "display"), // Keep as DD/MM/YYYY
          });
          setIsExisting(true);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setIsExisting(false);
          setFormData({
            ...initialFormState,
            accountNo: accountNo,
            loanNo: accountNo,
            date: formatDate(new Date()), // Set today's date in YYYY-MM-DD
          });
        }
      }
    }
  };

  useEffect(() => {
    if (nextAccountNo) {
      setTimeout(() => {
        inputRefs.current["accountNo"]?.select();
      }, 0);
    }
  }, [nextAccountNo]);

  // Add this useEffect to select the account number on initial load
  useEffect(() => {
    if (nextAccountNo) {
      // Small delay to ensure the input is mounted
      setTimeout(() => {
        inputRefs.current["accountNo"]?.select();
      }, 0);
    }
  }, [nextAccountNo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-xl text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${ubuntu.className}`}>
      <div className="  md:mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mx-4 md:mx-10 mb-6">
          <div className="flex justify-between w-full items-center gap-4">
            <h1 className="text-2xl flex items-center gap-2 md:text-4xl font-bold text-orange-600 transition-all whitespace-nowrap">
              {isDarkMode ? (
                <Image
                  src="/GFLogo.png"
                  alt="logo"
                  height={50}
                  width={50}
                  className="w-12 lg:w-14 drop-shadow-[0_0_0_0.5] transition-opacity cursor-pointer"
                  onClick={() => router.push('/')}
                ></Image>
              ) : (
                <Image
                  src="/lightlogo.png"
                  alt="logo"
                  height={50}
                  width={50}
                  className="w-12 lg:w-14 drop-shadow-[0_0_0_0.5] transition-opacity cursor-pointer"
                  onClick={() => router.push('/')}
                ></Image>
              )}
              Loan Master
            </h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 p-2.5 bg-orange-500 hover:bg-orange-600 lg:hidden text-white rounded-full transition-colors"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIsObsoleteModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-base md:text-lg font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Archive size={20} />
              <span className="hidden sm:inline">Obsolete Accounts</span>
            </button>
            <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
              <span className="flex-shrink-0">
                <TimeDisplay />
              </span>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 font-semibold">
                {formattedDate}
              </p>
            </div>
          </div>
        </div>
        <FormNavigationProvider>
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.altKey && e.key === "s") {
                console.log("Alt + S detected at form level"); // Debugging
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }

              if (e.ctrlKey && e.key.toLowerCase() === "r") {
                e.preventDefault();
                setFormData(initialFormState);
                fetchNextAccountNo();
                setIsExisting(false);
              }

              // Ctrl+Delete for Delete
              if (e.ctrlKey && e.key === "d" && isExisting) {
                e.preventDefault();
                handleDelete();
              }
            }}
            className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <FormInput
                  label="Account No."
                  name="accountNo"
                  type="number"
                  value={formData.accountNo}
                  onChange={handleAccountNoChange}
                  onBlur={handleAccountNoBlur}
                  autoSelect={true}
                  onKeyDown={(e) => {
                    handleKeyDown(e, "accountNo");

                  }}
                  error={errors.accountNo}
                  inputRef={(el) => {
                    inputRefs.current["accountNo"] = el;
                  }}
                  required
                />

                <FormInput
                  label="Loan No."
                  name="loanNo"
                  value={formData.loanNo}
                  type="text"
                  onChange={(e) =>
                    setFormData({ ...formData, loanNo: e.target.value })
                  }
                  onKeyDown={(e) => handleKeyDown(e, "loanNo")}
                  error={errors.loanNo}
                  inputRef={(el) => {
                    inputRefs.current["loanNo"] = el;
                  }}
                  required
                />

                {/* Today's Date */}
                <div className="space-y-6">
                  <FormInput
                    label="Date"
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, "date")}
                    error={errors.date}
                    inputRef={(el) => {
                      inputRefs.current["date"] = el;
                    }}
                    required
                  />
                </div>
                <div>
                  <FormInput
                    label="Amount"
                    name="amount"
                    value={formData.amount}
                    type="text"
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, "amount")}
                    error={errors.amount}
                    inputRef={(el) => {
                      inputRefs.current["amount"] = el;
                    }}
                    required
                  />
                </div>
              </div>

              <span className="hidden">
                {isDarkMode}
                {selectedAccountNo}
              </span>
              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <FormInput
                    label="Period (Days)"
                    name="period"
                    type="number"
                    value={formData.period}
                    onChange={(e) => {
                      const newPeriod = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        period: newPeriod,
                        mDate: calculateMaturityDate(prev.date, newPeriod),
                      }));
                    }}
                    onKeyDown={handlePeriodKeyDown}
                    inputRef={(el) => {
                      inputRefs.current["period"] = el;
                    }}
                    required
                  />
                </div>

                <div className="p-3">
                  <label className="block text-xl font-bold  text-gray-700 dark:text-gray-300">
                    Payment Type
                  </label>
                  <div className="flex space-x-6 mt-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.isDaily}
                        ref={(el) => {
                          inputRefs.current["isDaily"] = el;
                        }}
                        onKeyDown={handlePaymentTypeKeyDown}
                        onChange={() =>
                          setFormData({ ...formData, isDaily: true })
                        }
                        className="w-5 h-5 mr-2"
                      />
                      <span className="text-xl dark:text-gray-200 text-black">
                        Daily
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!formData.isDaily}
                        onChange={() =>
                          setFormData({ ...formData, isDaily: false })
                        }
                        ref={(el) => {
                          inputRefs.current["isMonthly"] = el;
                        }}
                        onKeyDown={handlePaymentTypeKeyDown}
                        className="w-5 h-5 mr-2"
                      />
                      <span className="text-xl dark:text-gray-200 text-black">
                        Monthly
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <FormInput
                    label="Installment Amount"
                    name="instAmount"
                    value={formData.instAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, instAmount: e.target.value })
                    }
                    type="text"
                    onKeyDown={handleInstAmountKeyDown}
                    error={errors.instAmount}
                    inputRef={(el) => {
                      inputRefs.current["instAmount"] = el;
                    }}
                    required
                  />
                </div>

                <div>
                  <FormInput
                    label="Maturity Amount"
                    name="mAmount"
                    value={formData.mAmount}
                    type="text"
                    onChange={(e) =>
                      setFormData({ ...formData, mAmount: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, "mAmount")}
                    error={errors.mAmount}
                    inputRef={(el) => {
                      inputRefs.current["mAmount"] = el;
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Maturity Date Section */}
            <div className="mt-6 flex justify-start w-full max-w-md">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center w-full">
                <label className="text-xl font-bold text-gray-700 dark:text-gray-200 shrink-0">
                  M. Date:
                </label>
                <input
                  readOnly
                  ref={(el) => {
                    inputRefs.current["mDate"] = el;
                  }}
                  value={formData.mDate}
                  type="text"
                  onChange={(e) =>
                    setFormData({ ...formData, mDate: e.target.value })
                  }
                  onKeyDown={(e) => handleKeyDown(e, "mDate")}
                  className="mt-1 font-bold text-xl block w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Holder Information */}
            <div className="mt-8">
              <h2 className="text-3xl font-bold mb-6 text-orange-500">
                Holder Information
              </h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-2 md:col-span-1">
                  <FormInput
                    label="Holder Name"
                    name="holderName"
                    value={formData.holderName}
                    type="text"
                    onChange={(e) =>
                      setFormData({ ...formData, holderName: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, "holderName")}
                    error={errors.holderName}
                    inputRef={(el) => {
                      inputRefs.current["holderName"] = el;
                    }}
                    required
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <FormInput
                    label="Name"
                    name="name"
                    value={formData.name}
                    type="text"
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    onKeyDown={handleNameKeyDown}
                    error={errors.name}
                    inputRef={(el) => {
                      inputRefs.current["name"] = el;
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <div>
                    <label className="block text-xl font-bold  text-gray-700 dark:text-gray-200">
                      Address
                    </label>
                    <textarea
                      name="holderAddress"
                      id="holderAddress"
                      rows={3}
                      ref={(el) => {
                        inputRefs.current["holderAddress"] = el;
                      }}
                      value={formData.holderAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          holderAddress: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          inputRefs.current["name"]?.focus(); // Move focus to the "Name" field
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          inputRefs.current["telephone1"]?.focus(); // Move focus to the "Telephone 1" field
                        } else if (e.key === "Enter") {
                          setAddressEnterCount((prev) => prev + 1);
                          if (addressEnterCount >= 2) {
                            e.preventDefault();
                            setAddressEnterCount(0);
                            inputRefs.current["telephone1"]?.focus();
                          }
                        }
                      }}
                      className="mt-2 font-bold block w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 text-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none uppercase"
                    />
                  </div>
                </div>

                <div className="col-span-2 grid md:grid-cols-2 gap-6">
                  <div>
                    <FormInput
                      label="Telephone 1"
                      name="telephone1"
                      value={formData.telephone1}
                      type="text"
                      onChange={(e) =>
                        setFormData({ ...formData, telephone1: e.target.value })
                      }
                      onKeyDown={handleTelephone1KeyDown}
                      error={errors.telephone1}
                      inputRef={(el) => {
                        inputRefs.current["telephone1"] = el;
                      }}
                    />
                  </div>

                  <div>
                    <FormInput
                      label="Telephone 2"
                      name="telephone2"
                      value={formData.telephone2}
                      type="text"
                      onChange={(e) =>
                        setFormData({ ...formData, telephone2: e.target.value })
                      }
                      onKeyDown={(e) => handleKeyDown(e, "telephone2")}
                      inputRef={(el) => {
                        inputRefs.current["telephone2"] = el;
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Guarantor Section */}
            <div className="mt-8" ref={guarantorSectionRef}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-3xl  font-bold text-gray-800 dark:text-white">
                  Guarantor Information
                </h2>
                <button
                  ref={addGuarantorButtonRef}
                  type="button"
                  onClick={addGuarantor}
                  className="add-guarantor-button bg-blue-500 dark:bg-blue-600 text-white px-1 py-1 md:px-6 md:py-3 rounded-md text-base md:text-xl font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Add Guarantor (ALT+G)
                </button>
              </div>

              {formData.guarantors.map((guarantor, index) => (
                <div
                  ref={guarantorSectionRef}
                  key={`guarantor-${index}`}
                  className="mt-6 p-6 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg md:text-2xl font-semibold text-gray-800 dark:text-white">
                      Guarantor #{index + 1}
                    </h3>
                    <button
                      type="button"
                      key={`remove-${index}`}
                      onClick={() => removeGuarantor(index)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-lg"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name Input */}
                    <div key={`name-field-${index}`}>
                      <label className="block text-xl font-bold  text-gray-700 dark:text-gray-200">
                        Name
                      </label>
                      <input
                        type="text"
                        ref={(el) => {
                          inputRefs.current[`guarantor-${index}-holderName`] =
                            el;
                        }}
                        value={guarantor.holderName}
                        onChange={(e) => {
                          const updatedGuarantors = [...formData.guarantors];
                          updatedGuarantors[index] = {
                            ...updatedGuarantors[index],
                            holderName: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            guarantors: updatedGuarantors,
                          });
                        }}
                        onKeyDown={(e) =>
                          handleGuarantorKeyDown(e, index, "holderName", index)
                        }
                        className="mt-2 block font-bold w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 text-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                        required
                      />
                    </div>

                    {/* Address Input */}
                    <div key={`address-field-${index}`}>
                      <label className="block text-xl font-bold  text-gray-700 dark:text-gray-200">
                        Address
                      </label>
                      <input
                        type="text"
                        ref={(el) => {
                          inputRefs.current[`guarantor-${index}-address`] = el;
                        }}
                        value={guarantor.address}
                        onChange={(e) => {
                          const updatedGuarantors = [...formData.guarantors];
                          updatedGuarantors[index] = {
                            ...updatedGuarantors[index],
                            address: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            guarantors: updatedGuarantors,
                          });
                        }}
                        onKeyDown={(e) =>
                          handleGuarantorKeyDown(e, index, "address", index)
                        }
                        className="mt-2 block font-bold w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 text-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                      />
                    </div>

                    {/* Telephone Input */}
                    <div key={`telephone-field-${index}`}>
                      <label className="block text-xl font-bold  text-gray-700 dark:text-gray-200">
                        Telephone
                      </label>
                      <input
                        type="tel"
                        ref={(el) => {
                          inputRefs.current[`guarantor-${index}-telephone`] =
                            el;
                        }}
                        value={guarantor.telephone}
                        onChange={(e) => {
                          const updatedGuarantors = [...formData.guarantors];
                          updatedGuarantors[index] = {
                            ...updatedGuarantors[index],
                            telephone: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            guarantors: updatedGuarantors,
                          });
                        }}
                        onKeyDown={(e) =>
                          handleGuarantorKeyDown(e, index, "telephone", index)
                        }
                        className="mt-2 block font-bold w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 text-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                      />
                    </div>

                    {/* City Input */}
                    <div key={`city-field-${index}`}>
                      <label className="block  text-xl font-bold  text-gray-700 dark:text-gray-200">
                        City
                      </label>
                      <input
                        type="text"
                        ref={(el) => {
                          inputRefs.current[`guarantor-${index}-city`] = el;
                        }}
                        value={guarantor.city}
                        onChange={(e) => {
                          const updatedGuarantors = [...formData.guarantors];
                          updatedGuarantors[index] = {
                            ...updatedGuarantors[index],
                            city: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            guarantors: updatedGuarantors,
                          });
                        }}
                        onKeyDown={(e) =>
                          handleGuarantorKeyDown(e, index, "city", index)
                        }
                        className="mt-2 block font-bold w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 text-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form Buttons */}
            <div className="mt-8 flex gap-4 md:flex-row flex-col">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 ${isExisting
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-green-500 hover:bg-green-600"
                  } text-white px-6 py-3 rounded-md text-xl font-semibold transition-colors`}
              >
                {isSubmitting
                  ? "Processing..."
                  : isExisting
                    ? "Update Loan (ALT+S)"
                    : "Submit Loan Application (ALT+S)"}
              </button>
              {isExisting && (
                <button
                  type="button"
                  onClick={handleObsolete}
                  disabled={isObsoleting}
                  className="bg-amber-600 text-white px-6 py-3 rounded-md text-xl font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
                >
                  {isObsoleting ? "Obsoleting..." : "Obsolete"}
                </button>
              )}
              {isExisting && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-500 text-white px-6 py-3 rounded-md text-xl font-semibold hover:bg-red-600 transition-colors"
                >
                  Delete Loan
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormData(initialFormState);
                  fetchNextAccountNo();
                  setIsExisting(false);
                }}
                className="bg-gray-500 text-white px-6 py-3 rounded-md text-xl font-semibold hover:bg-gray-600 transition-colors"
              >
                Reset Form
              </button>
            </div>
          </form>
        </FormNavigationProvider>
      </div>
      <AccountFinder
        onAccountSelect={(accountNo) => {
          setSelectedAccountNo(accountNo);
          // Create a synthetic event object
          const syntheticEvent = {
            target: { value: accountNo },
          } as React.ChangeEvent<HTMLInputElement>;
          handleAccountNoChange(syntheticEvent); // Pass the synthetic event

          setTimeout(() => {
            inputRefs.current[`accountNo`]?.focus();
          }, 0);
        }}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      />

      <ObsoleteLoansModal
        isOpen={isObsoleteModalOpen}
        onClose={() => setIsObsoleteModalOpen(false)}
        onRestored={async (accountNo) => {
          setIsObsoleteModalOpen(false);
          await fetchNextAccountNo(true);
          // Load the restored account into the form under its new number
          const syntheticEvent = {
            target: { value: accountNo },
          } as React.FocusEvent<HTMLInputElement>;
          setFormData((prev) => ({ ...prev, accountNo, loanNo: accountNo }));
          await handleAccountNoBlur(syntheticEvent);
          setAlertMessage(
            `Account restored successfully with account no. ${accountNo}`
          );
          setAlertOpen(true);
        }}
        onError={(message) => {
          setAlertMessage(message);
          setAlertOpen(true);
        }}
      />

      <CustomAlertDialog
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Alert"
        description={alertMessage}
      />
    </div>
  );
}
