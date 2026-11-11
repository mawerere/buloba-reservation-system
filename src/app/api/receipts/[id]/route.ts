import { ensureSeeded } from "@/db/seed";
import { apiFailure, requireInteger } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { getReceiptDetail } from "@/lib/receipts-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await ensureSeeded();
    await requireApiSession();
    const { id } = await context.params;
    const receipt = await getReceiptDetail(requireInteger(id, "Receipt ID"));
    return Response.json({ ok: true, receipt });
  } catch (error) {
    return apiFailure(error);
  }
}
