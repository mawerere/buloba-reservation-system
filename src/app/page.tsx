import CrsConsole from "@/components/CrsConsole";
import { requirePageSession } from "@/lib/auth";
import { getState } from "@/lib/crs-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requirePageSession();
  const state = await getState();
  return <CrsConsole initialState={state} session={session} />;
}
