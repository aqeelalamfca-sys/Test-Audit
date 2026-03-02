import { Request, Response, NextFunction } from "express";

export interface StandardError {
  code: string;
  message: string;
  field?: string;
  rowNo?: number;
  hint?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly field?: string;
  public readonly rowNo?: number;
  public readonly hint?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    options?: {
      field?: string;
      rowNo?: number;
      hint?: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.field = options?.field;
    this.rowNo = options?.rowNo;
    this.hint = options?.hint;
    this.details = options?.details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): StandardError {
    return {
      code: this.code,
      message: this.message,
      field: this.field,
      rowNo: this.rowNo,
      hint: this.hint,
      details: this.details,
    };
  }
}

export function formatValidationErrors(
  errors: Array<{ field: string; message: string; rowNo?: number }>
): StandardError[] {
  return errors.map((err) => ({
    code: "VALIDATION_ERROR",
    message: err.message,
    field: err.field,
    rowNo: err.rowNo,
    hint: `Check the value for ${err.field}`,
  }));
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[${new Date().toISOString()}] Error:`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.toJSON(),
    });
  }

  if (err.name === "ZodError") {
    const zodErr = err as any;
    const errors = zodErr.errors?.map((e: any) => ({
      code: "VALIDATION_ERROR",
      message: e.message,
      field: e.path?.join("."),
      hint: `Expected ${e.expected}, received ${e.received}`,
    }));

    return res.status(400).json({
      success: false,
      errors,
    });
  }

  if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as any;
    let standardError: StandardError;

    switch (prismaErr.code) {
      case "P2002":
        standardError = {
          code: "DUPLICATE_ENTRY",
          message: "A record with this value already exists",
          field: prismaErr.meta?.target?.[0],
          hint: "Use a unique value or update the existing record",
        };
        break;
      case "P2025":
        standardError = {
          code: "NOT_FOUND",
          message: "The requested record was not found",
          hint: "Verify the ID and try again",
        };
        break;
      case "P2003":
        standardError = {
          code: "FOREIGN_KEY_VIOLATION",
          message: "Referenced record does not exist",
          field: prismaErr.meta?.field_name,
          hint: "Ensure the referenced record exists before creating this one",
        };
        break;
      default:
        standardError = {
          code: `DB_ERROR_${prismaErr.code}`,
          message: "A database error occurred",
          hint: "Please try again or contact support",
        };
    }

    return res.status(400).json({
      success: false,
      error: standardError,
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      hint: "Please try again. If the problem persists, contact support.",
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
      hint: "Check the API documentation for available endpoints",
    },
  });
}

export function createError(
  code: string,
  message: string,
  statusCode: number = 400,
  options?: {
    field?: string;
    rowNo?: number;
    hint?: string;
    details?: Record<string, unknown>;
  }
): AppError {
  return new AppError(code, message, statusCode, options);
}

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  PREREQUISITE_FAILED: "PREREQUISITE_FAILED",
  WORKFLOW_BLOCKED: "WORKFLOW_BLOCKED",
  PUSH_FAILED: "PUSH_FAILED",
  MAPPING_INCOMPLETE: "MAPPING_INCOMPLETE",
  TB_NOT_FOUND: "TB_NOT_FOUND",
  GL_NOT_FOUND: "GL_NOT_FOUND",
  SIGN_OFF_REQUIRED: "SIGN_OFF_REQUIRED",
  FIELD_LOCKED: "FIELD_LOCKED",
  ROLE_INSUFFICIENT: "ROLE_INSUFFICIENT",
} as const;
