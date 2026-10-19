export class DaybookError extends Error {
  status: number;
  code?: string;
  field?: string;
  extra?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    opts: { code?: string; field?: string; extra?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.status = status;
    this.code = opts.code;
    this.field = opts.field;
    this.extra = opts.extra;
  }
}

export const badRequest = (message: string, field?: string) =>
  new DaybookError(400, message, { code: 'VALIDATION', field });

export const notFound = (message: string) => new DaybookError(404, message, { code: 'NOT_FOUND' });
