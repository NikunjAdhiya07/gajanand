import LoanSchema from '@/models/LoanSchema';

/**
 * Returns the lowest unused account number as a string.
 * Numbers freed up by deleting or obsoleting an account are reused.
 */
export async function getNextAccountNo(): Promise<string> {
  const loans = await LoanSchema
    .find({}, { accountNo: 1, _id: 0 })
    .lean<{ accountNo: string }[]>();

  if (!loans.length) {
    return '1';
  }

  // Convert to integers, sort numerically, and scan for first gap: O(n log n) time, O(n) memory.
  const accountNumbers = loans
    .map((loan) => Number.parseInt(String(loan.accountNo), 10))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((a: number, b: number) => a - b);

  let nextNumber = 1;
  for (const n of accountNumbers) {
    if (n === nextNumber) {
      nextNumber++;
      continue;
    }
    if (n > nextNumber) break;
    // If n < nextNumber, keep scanning (duplicates or malformed data)
  }

  return nextNumber.toString();
}
