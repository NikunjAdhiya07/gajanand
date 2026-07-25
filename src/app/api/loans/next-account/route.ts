import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getNextAccountNo } from '@/lib/nextAccountNo';

export async function GET() {
  try {
    await dbConnect();

    const nextAccountNo = await getNextAccountNo();

    return NextResponse.json({ nextAccountNo });
  } catch (error) {
    console.error('Error getting next account number:', error);
    return NextResponse.json(
      { message: 'Error getting next account number', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
