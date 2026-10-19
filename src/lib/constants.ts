export const LOAN_TYPES = [
  { id: 'daily', name: 'Daily Loans' },
  { id: 'monthly', name: 'Monthly Loans' },
  { id: 'pending', name: 'Pending Loans' },
];

export const FILE_CATEGORIES = {
  daily: ['Gajanand 1', 'Gajanand 2', 'Gajanand 3', 'Gajanand 4', 'Gajanand 5', 'Gajanand 6', 'Gajanand 7', 'Gajanand 8', 'Gajanand 9', 'Gajanand 10'],
  monthly: ['Monthly File 1', 'Monthly File 2', 'Monthly File 3', 'Monthly File 4',],
  pending: ['Pending File 1', 'Pending File 2', 'Pending File 3', 'Pending File 4', 'Pending File 5', 'Pending File 6']
};

// Suggested Day Book categories; any other category can be typed in.
export const DAYBOOK_CATEGORIES = {
  income: ['Collection', 'Interest', 'Commission', 'Capital', 'Other Income'],
  expense: [
    'Tea & Snacks',
    'Stationery',
    'Office Supplies',
    'Travel',
    'Fuel',
    'Salary',
    'Rent',
    'Electricity',
    'Phone & Internet',
    'Repairs',
    'Cleaning',
    'Other Expense',
  ],
} as const;
