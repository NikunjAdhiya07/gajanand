import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import LoanSchema from '@/models/LoanSchema';
import ObsoleteLoan, { ObsoleteLoanData } from '@/models/ObsoleteLoan';

// List every obsoleted account holder, most recently obsoleted first.
export async function GET() {
  try {
    await dbConnect();

    const obsoleteLoans = await ObsoleteLoan.find().sort({ obsoletedAt: -1 }).lean();
    return NextResponse.json(obsoleteLoans);
  } catch (error) {
    console.error('Error fetching obsolete loans:', error);
    return NextResponse.json(
      {
        message: 'Error fetching obsolete loans',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Move a live loan into the obsolete list. The account number is NOT carried
// over - it is released so it can be handed out to a new account.
export async function POST(req: Request) {
  try {
    await dbConnect();
    const { accountNo } = await req.json();

    if (!accountNo) {
      return NextResponse.json(
        { message: 'Account number is required' },
        { status: 400 }
      );
    }

    const loan = await LoanSchema
      .findOne({ accountNo })
      .lean<ObsoleteLoanData | null>();
    if (!loan) {
      return NextResponse.json(
        { message: 'Loan not found' },
        { status: 404 }
      );
    }

    const obsoleteLoan = await ObsoleteLoan.create({
      date: loan.date,
      mDate: loan.mDate,
      amount: loan.amount,
      period: loan.period,
      isDaily: loan.isDaily,
      instAmount: loan.instAmount,
      mAmount: loan.mAmount,
      holderName: loan.holderName,
      holderAddress: loan.holderAddress,
      telephone1: loan.telephone1,
      telephone2: loan.telephone2,
      name: loan.name,
      hasGuarantor: loan.hasGuarantor,
      guarantors: (loan.guarantors || []).map((g) => ({
        holderName: g.holderName,
        address: g.address,
        telephone: g.telephone,
        city: g.city,
      })),
      obsoletedAt: new Date(),
    });

    // Only remove the live loan once the obsolete copy is safely stored.
    await LoanSchema.deleteOne({ accountNo });

    return NextResponse.json(obsoleteLoan, { status: 201 });
  } catch (error) {
    console.error('Error obsoleting loan:', error);
    return NextResponse.json(
      {
        message: 'Error obsoleting loan',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
