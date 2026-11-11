import { apiFailure, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("Not authenticated.", 401);
    return Response.json({ ok: true, session });
  } catch (error) {
    return apiFailure(error);
  }
}
