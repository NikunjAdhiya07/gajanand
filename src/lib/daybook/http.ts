import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getDaybookUser } from './auth';
import { DaybookError } from './errors';
import type { UserRef } from './types';

type Handler<P> = (req: NextRequest, user: UserRef, params: P) => Promise<unknown>;

function respond(body: unknown, status: number) {
  const res = NextResponse.json(body, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** Wraps every Daybook route: DB connection, login check, JSON body check and uniform errors. */
export function daybookRoute<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      await dbConnect();
      const user = await getDaybookUser();
      if (!user) return respond({ message: 'Your session has expired. Please log in again.', code: 'UNAUTHENTICATED' }, 401);

      if ((req.method === 'POST' || req.method === 'PUT') && !req.headers.get('content-type')?.includes('application/json')) {
        return respond({ message: 'Content-Type must be application/json' }, 415);
      }

      const params = context?.params ? await context.params : ({} as P);
      const body = await handler(req, user, params);
      return respond(body, req.method === 'POST' ? 201 : 200);
    } catch (error) {
      if (error instanceof DaybookError) {
        return respond({ message: error.message, code: error.code, field: error.field, ...error.extra }, error.status);
      }
      const name = (error as Error)?.name ?? '';
      if (name === 'ValidationError' || name === 'CastError') {
        return respond({ message: (error as Error).message, code: 'VALIDATION' }, 400);
      }
      console.error('[daybook]', error);
      if (/^Mongo(oseServerSelection|ServerSelection|Network)Error$/.test(name)) {
        return respond({ message: 'Could not reach the database. Please try again.', code: 'DB_UNAVAILABLE' }, 503);
      }
      return respond({ message: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' }, 500);
    }
  };
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body as Record<string, unknown>;
  } catch {
    throw new DaybookError(400, 'Request body must be a JSON object', { code: 'VALIDATION' });
  }
}
