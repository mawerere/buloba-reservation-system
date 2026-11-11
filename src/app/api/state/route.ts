import { ensureSeeded } from "@/db/seed";
import { apiFailure } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { getState } from "@/lib/crs-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    await requireApiSession();
    return Response.json({ ok: true, state: await getState() });
  } catch (error) {
    return apiFailure(error);
  }
}
