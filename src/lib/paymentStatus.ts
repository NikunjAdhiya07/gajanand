import {
  addMonthsKeepingDay,
  calculateMonthsSinceStart,
  getMonthlyCalendarLateFee,
  getMonthlyNextDueAndCovered,
} from "@/lib/utils";

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

export interface CalculationDetails {
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
  calendarLateFee?: number;
  daysLateCalendar?: number;
}

export interface PaymentStatusResult {
  status: string;
  statusColor: string;
  nextDueDate: string;
  calculationDetails: CalculationDetails;
  showLateAmount: boolean;
  statusSubline?: string;
  statusSublineColor?: string;
  prevDayStatus: string;
  prevDayStatusColor: string;
}

/**
 * Pure payment-status calculation shared between the interactive table
 * (PaymentStatusDisplay) and non-interactive exports (e.g. Excel/WhatsApp
 * share) so both stay in sync with a single source of truth.
 */
export function computePaymentStatus(
  loan: Loan,
  selectedDate: string,
  loanType: "daily" | "monthly" | "pending"
): PaymentStatusResult {
  const installment = loan.installmentAmount;
  const paymentHistory = loan.paymentHistory || [];
  const receivedDate = new Date(loan.receivedDate);
  const currentDate = new Date(selectedDate.split("T")[0]);
  let lateAmount = loan.lateAmount;

  receivedDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  if (receivedDate > currentDate) {
    const totalPaidBeforeToday = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) <= currentDate)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const todayPayment = loan.paymentReceivedToday || 0;
    const totalPaid = totalPaidBeforeToday + todayPayment;

    const coveredUntilDate = new Date(receivedDate);
    let statusDate = new Date(receivedDate);

    if (totalPaid > 0 && loanType === "daily") {
      const extraDaysCovered = Math.floor(totalPaid / installment);
      coveredUntilDate.setDate(coveredUntilDate.getDate() + extraDaysCovered);
      if (extraDaysCovered > 0) {
        statusDate = coveredUntilDate;
      }
    } else if (totalPaid > 0 && loanType === "monthly") {
      const extraMonthsCovered = Math.floor(totalPaid / installment);
      const advancedCover = addMonthsKeepingDay(
        coveredUntilDate,
        extraMonthsCovered
      );
      coveredUntilDate.setTime(advancedCover.getTime());
      if (extraMonthsCovered > 0) {
        statusDate = coveredUntilDate;
      }
    }

    const formattedStatusDate = statusDate.toLocaleDateString("en-GB");
    const formattedCoveredDate = coveredUntilDate.toLocaleDateString("en-GB");

    return {
      status: formattedStatusDate,
      statusColor: totalPaid > 0 ? "text-green-600" : "text-gray-600",
      nextDueDate: formattedCoveredDate,
      calculationDetails: {
        totalDue: 0,
        totalPaidBeforeToday,
        todayPayment,
        totalPaid,
        remainingAfterToday: -totalPaid,
        coveredUntilDate: formattedCoveredDate,
        lateAmount: 0,
        extraDaysCovered:
          loanType === "daily" ? Math.floor(totalPaid / installment) : undefined,
        extraMonthsCovered:
          loanType === "monthly" ? Math.floor(totalPaid / installment) : undefined,
      },
      showLateAmount: false,
      prevDayStatus: "",
      prevDayStatusColor: "",
    };
  }

  if (loanType === "pending") {
    const initialTotal = loan.totalToBePaid || 0;
    const totalPaidBeforeToday = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) < currentDate)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const todayPayment = loan.paymentReceivedToday || 0;
    const totalPaid = totalPaidBeforeToday + todayPayment;
    const remainingAmount = Math.max(initialTotal - totalPaid, 0);

    const details: CalculationDetails = {
      totalDue: initialTotal,
      totalPaidBeforeToday,
      todayPayment,
      totalPaid,
      remainingAfterToday: remainingAmount,
      lateAmount: lateAmount,
      coveredUntilDate: currentDate.toLocaleDateString("en-GB"),
    };

    return {
      status: `₹${remainingAmount.toFixed(0)}`,
      statusColor:
        remainingAmount > 0 ? "text-red-600 font-semibold" : "text-green-600",
      nextDueDate: currentDate.toLocaleDateString("en-GB"),
      calculationDetails: details,
      showLateAmount: remainingAmount > 0,
      prevDayStatus: "",
      prevDayStatusColor: "",
    };
  }

  if (loanType === "monthly") {
    const lateFeePerDay = loan.lateAmount;
    const monthsSinceStart = calculateMonthsSinceStart(receivedDate, currentDate);
    const totalDue = installment * monthsSinceStart;

    const totalPaidBeforeToday = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) < currentDate)
      .reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
    const todayPayment = loan.paymentReceivedToday || 0;
    const totalPaid = totalPaidBeforeToday + todayPayment;
    const remainingAfterToday = totalDue - totalPaid;

    const { nextDueDate, coveredUntilDate } = getMonthlyNextDueAndCovered(
      receivedDate,
      monthsSinceStart,
      totalPaid,
      installment
    );
    const formattedNextDueDate = nextDueDate.toLocaleDateString("en-GB");

    const { daysLate: daysLateCalendar, calendarLateFee } =
      getMonthlyCalendarLateFee(currentDate, nextDueDate, lateFeePerDay);

    const prevMonthDate = new Date(currentDate);
    prevMonthDate.setDate(prevMonthDate.getDate() - 1);
    const prevMonthsSinceStart = Math.max(
      calculateMonthsSinceStart(receivedDate, prevMonthDate),
      0
    );
    const totalDuePrevMonth = installment * prevMonthsSinceStart;
    const totalPaidPrevMonth = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) <= prevMonthDate)
      .reduce((sum: number, payment: Payment) => sum + payment.amount, 0);

    lateAmount = Math.max(totalDue - totalPaid, 0);

    const extraMonthsCovered = Math.floor(
      Math.abs(remainingAfterToday < 0 ? remainingAfterToday : 0) / installment
    );

    const formattedCoveredDate = coveredUntilDate.toLocaleDateString("en-GB");

    const details: CalculationDetails = {
      monthsSinceStart,
      totalDue,
      totalPaidBeforeToday,
      todayPayment,
      totalPaid,
      remainingAfterToday,
      extraMonthsCovered,
      coveredUntilDate: formattedCoveredDate,
      nextMonthInstallment: installment,
      lateAmount,
      calendarLateFee,
      daysLateCalendar,
    };

    const isPastInstallmentDue = daysLateCalendar > 0;
    const lateFeeSubline =
      calendarLateFee > 0 ? `Late Fee: ₹${calendarLateFee.toFixed(0)}` : undefined;

    const prevDayStatus =
      totalDuePrevMonth > totalPaidPrevMonth
        ? `₹${(totalDuePrevMonth - totalPaidPrevMonth).toFixed(0)}`
        : prevMonthDate.toLocaleDateString("en-GB");
    const prevDayStatusColor =
      totalDuePrevMonth > totalPaidPrevMonth ? "text-red-600" : "text-yellow-600";

    if (remainingAfterToday > 0) {
      return {
        status: `₹${remainingAfterToday.toFixed(0)}`,
        statusColor: "text-red-600 font-semibold",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: true,
        statusSubline: lateFeeSubline,
        statusSublineColor: isPastInstallmentDue
          ? "text-red-600 font-semibold"
          : undefined,
        prevDayStatus,
        prevDayStatusColor,
      };
    } else if (remainingAfterToday === 0) {
      if (isPastInstallmentDue) {
        const overdueAmount = installment + calendarLateFee;
        return {
          status: `₹${overdueAmount.toFixed(0)}`,
          statusColor: "text-red-600 font-semibold",
          nextDueDate: formattedNextDueDate,
          calculationDetails: details,
          showLateAmount: true,
          statusSubline: lateFeeSubline,
          statusSublineColor: "text-red-600 font-semibold",
          prevDayStatus,
          prevDayStatusColor,
        };
      }
      return {
        status: formattedNextDueDate,
        statusColor: "text-yellow-600",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: false,
        prevDayStatus,
        prevDayStatusColor,
      };
    } else {
      const overpayment = Math.abs(remainingAfterToday);
      const fullMonthsCovered = Math.floor(overpayment / installment);
      const partialNextMonthAmount = overpayment % installment;
      details.overpayment = overpayment;
      details.partialNextMonthAmount = partialNextMonthAmount;
      details.remainingForLastMonth = installment - partialNextMonthAmount;

      if (isPastInstallmentDue) {
        const overdueAmount = installment + calendarLateFee;
        return {
          status: `₹${overdueAmount.toFixed(0)}`,
          statusColor: "text-red-600 font-semibold",
          nextDueDate: formattedNextDueDate,
          calculationDetails: details,
          showLateAmount: true,
          statusSubline: lateFeeSubline,
          statusSublineColor: "text-red-600 font-semibold",
          prevDayStatus,
          prevDayStatusColor,
        };
      }

      return {
        status: fullMonthsCovered > 0 ? formattedCoveredDate : formattedNextDueDate,
        statusColor: fullMonthsCovered > 0 ? "text-green-600" : "text-yellow-600",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: false,
        prevDayStatus,
        prevDayStatusColor,
      };
    }
  } else {
    const daysSinceStart = Math.max(
      Math.floor(
        (currentDate.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1,
      1
    );
    const totalDue = installment * daysSinceStart;

    const totalPaidBeforeToday = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) < currentDate)
      .reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
    const todayPayment = loan.paymentReceivedToday || 0;
    const totalPaid = totalPaidBeforeToday + todayPayment;
    const remainingAfterToday = totalDue - totalPaid;

    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const totalDuePrevDay = installment * (daysSinceStart - 1);
    const totalPaidPrevDay = paymentHistory
      .filter((payment) => new Date(payment.date.split("T")[0]) <= prevDate)
      .reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
    const remainingPrevDay = totalDuePrevDay - totalPaidPrevDay;

    const extraDaysCovered = Math.floor(
      Math.abs(remainingAfterToday < 0 ? remainingAfterToday : 0) / installment
    );

    const nextDueDate = new Date(currentDate);
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const formattedNextDueDate = nextDueDate.toLocaleDateString("en-GB");

    const coveredUntilDate = new Date(currentDate);
    coveredUntilDate.setDate(coveredUntilDate.getDate() + extraDaysCovered);
    const formattedCoveredDate = coveredUntilDate.toLocaleDateString("en-GB");

    const details: CalculationDetails = {
      daysSinceStart,
      totalDue,
      totalPaidBeforeToday,
      todayPayment,
      totalPaid,
      remainingAfterToday,
      extraDaysCovered,
      coveredUntilDate: formattedCoveredDate,
      nextDayInstallment: installment,
      lateAmount: remainingAfterToday > 0 ? remainingAfterToday : lateAmount,
    };

    const prevDayStatus =
      remainingPrevDay > 0
        ? `₹${remainingPrevDay.toFixed(0)}`
        : prevDate.toLocaleDateString("en-GB");
    const prevDayStatusColor =
      remainingPrevDay > 0 ? "text-red-600" : "text-yellow-600";

    if (remainingAfterToday > 0) {
      return {
        status: `₹${remainingAfterToday.toFixed(0)}`,
        statusColor: "text-red-600 font-semibold",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: true,
        prevDayStatus,
        prevDayStatusColor,
      };
    } else if (remainingAfterToday === 0) {
      return {
        status: formattedNextDueDate,
        statusColor: "text-yellow-600",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: false,
        prevDayStatus,
        prevDayStatusColor,
      };
    } else {
      const overpayment = Math.abs(remainingAfterToday);
      const fullDaysCovered = Math.floor(overpayment / installment);
      const partialNextDayAmount = overpayment % installment;
      details.overpayment = overpayment;
      details.partialNextDayAmount = partialNextDayAmount;
      details.remainingForLastDay = installment - partialNextDayAmount + installment;

      return {
        status: fullDaysCovered > 0 ? formattedCoveredDate : formattedNextDueDate,
        statusColor: fullDaysCovered > 0 ? "text-green-600" : "text-yellow-600",
        nextDueDate: formattedNextDueDate,
        calculationDetails: details,
        showLateAmount: false,
        prevDayStatus,
        prevDayStatusColor,
      };
    }
  }
}
