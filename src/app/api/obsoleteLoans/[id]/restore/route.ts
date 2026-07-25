import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import LoanSchema from '@/models/LoanSchema';
import ObsoleteLoan, { ObsoleteLoanData } from '@/models/ObsoleteLoan';
import { getNextAccountNo } from '@/lib/nextAccountNo';

// Bring an obsoleted holder back as a live loan. Since the original account
// number was never kept, a fresh one is assigned from the free pool.
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await context.params;

    const obsoleteLoan = await ObsoleteLoan
      .findById(id)
      .lean<ObsoleteLoanData | null>();
    if (!obsoleteLoan) {
      return NextResponse.json(
        { message: 'Obsolete account not found' },
        { status: 404 }
      );
    }

    const accountNo = await getNextAccountNo();

    const loan = await LoanSchema.create({
      accountNo,
      loanNo: accountNo,
      date: obsoleteLoan.date,
      mDate: obsoleteLoan.mDate,
      amount: obsoleteLoan.amount,
      period: obsoleteLoan.period,
      isDaily: obsoleteLoan.isDaily,
      instAmount: obsoleteLoan.instAmount,
      mAmount: obsoleteLoan.mAmount,
      holderName: obsoleteLoan.holderName,
      holderAddress: obsoleteLoan.holderAddress,
      telephone1: obsoleteLoan.telephone1,
      telephone2: obsoleteLoan.telephone2,
      name: obsoleteLoan.name,
      hasGuarantor: obsoleteLoan.hasGuarantor,
      guarantors: (obsoleteLoan.guarantors || []).map((g) => ({
        holderName: g.holderName,
        address: g.address,
        telephone: g.telephone,
        city: g.city,
      })),
    });

    // Only drop the obsolete copy once the live loan exists.
    await ObsoleteLoan.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Account restored successfully', accountNo, loan });
  } catch (error) {
    console.error('Error restoring obsolete loan:', error);
    return NextResponse.json(
      {
        message: 'Error restoring obsolete loan',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
