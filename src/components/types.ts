import type { CrsState, ModuleId, Role, SessionInfo } from "@/lib/crs";

export type ActionPayload = {
  url: string;
  method?: "POST" | "PATCH";
  body: Record<string, unknown>;
  success?: string;
  openReceipt?: boolean;
  quiet?: boolean;
};

export type ActionResult = {
  ok: true;
  message: string;
  receiptId?: number | null;
  receiptNo?: string | null;
  bookingId?: number;
  [key: string]: unknown;
};

export type RunAction = (payload: ActionPayload) => Promise<ActionResult | null>;

export type CommandIntent =
  | { kind: "book" | "folio" | "room"; roomNumber: number; nonce: number }
  | null;

export type ReportRequest = {
  period: string;
  section: string;
  department: string;
  category: string;
  from: string;
  to: string;
  nonce: number;
};

export type ModuleProps = {
  state: CrsState;
  session: SessionInfo;
  role: Role;
  staffId: string;
  busy: boolean;
  run: RunAction;
  openReceipt: (id: number) => void;
  openReports: (section: string, period?: string) => void;
  goTo: (module: ModuleId) => void;
  intent: CommandIntent;
};
