import { ensureSeeded } from "@/db/seed";
import { apiFailure } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { assertReportAccess, getReport } from "@/lib/crs-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const session = await requireApiSession();
    const params = new URL(request.url).searchParams;
    const section = params.get("section") ?? "all";
    assertReportAccess(session.role, section);
    const report = await getReport({
      period: params.get("period") ?? "daily",
      from: params.get("from"),
      to: params.get("to"),
      section,
      department: params.get("department"),
      category: params.get("category"),
    });
    return Response.json({ ok: true, report });
  } catch (error) {
    return apiFailure(error);
  }
}
