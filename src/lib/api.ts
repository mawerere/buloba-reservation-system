import {
  isPaymentComponent,
  isRole,
  type PaymentAllocation,
  type Role,
} from "@/lib/crs";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiFailure(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ ok: false, error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  // PostgreSQL unique/constraint violations are returned as clean operator messages.
  const friendly = message.includes("duplicate key")
    ? "This record already exists. Please refresh and try again."
    : message;
  console.error("[CRS API]", error);
  return Response.json({ ok: false, error: friendly }, { status: 400 });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("A JSON request body is required.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid JSON request body.");
  }
}

export function assertRole(value: unknown, allowed: readonly Role[]): Role {
  if (!isRole(value)) throw new ApiError("Select a valid staff role before continuing.", 403);
  if (!allowed.includes(value)) {
    throw new ApiError(
      `Access denied: ${value} is not authorized for this module.`,
      403,
    );
  }
  return value;
}

export function requireText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`${label} is required.`);
  }
  const result = value.trim();
  if (result.length > max) throw new ApiError(`${label} cannot exceed ${max} characters.`);
  return result;
}

export function optionalText(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const result = value.trim();
  return result.length > max ? result.slice(0, max) : result;
}

export function requireInteger(
  value: unknown,
  label: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
}

export function isRoleSafe(value: unknown): value is Role {
  return isRole(value);
}

export function parsePaymentAllocations(
  body: Record<string, unknown>,
  total: number,
): PaymentAllocation[] {
  if (Array.isArray(body.payments) && body.payments.length > 0) {
    const allocations = body.payments.map((entry) => {
      const item = entry as Record<string, unknown>;
      if (!item || !isPaymentComponent(item.method)) {
        throw new ApiError("Each split payment must use Cash, MTN Mobile Money, Airtel Money, Visa or Mastercard.");
      }
      const amount = Number(item.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ApiError("Each split payment amount must be a positive whole UGX value.");
      }
      return { method: item.method, amount } as PaymentAllocation;
    });
    const sum = allocations.reduce((totalAmount, allocation) => totalAmount + allocation.amount, 0);
    if (sum !== total) {
      throw new ApiError(`Split payment allocations total UGX ${sum.toLocaleString("en-UG")} but the folio total is UGX ${total.toLocaleString("en-UG")}.`);
    }
    return allocations;
  }
  if (!isPaymentComponent(body.paymentMethod)) {
    throw new ApiError("Select a valid payment method.");
  }
  return [{ method: body.paymentMethod, amount: total }];
}
