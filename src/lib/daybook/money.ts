// All Daybook arithmetic runs in integer paise so repeated additions of
// rupee amounts cannot drift. Convert back only at the API/UI boundary.

export const toPaise = (rupees: number | null | undefined): number =>
  Math.round((Number(rupees) || 0) * 100);

export const fromPaise = (paise: number): number => paise / 100;

export const formatINR = (rupees: number): string =>
  `${rupees < 0 ? '-' : ''}₹${Math.abs(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
