import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import ReceiptActions from "@/components/ReceiptActions";
import { ensureSeeded } from "@/db/seed";
import { requirePageSession } from "@/lib/auth";
import { getReceiptDetail } from "@/lib/receipts-server";
import { HOTEL, dateTimeKampala, ugx } from "@/lib/crs";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReceiptPrintPage({ params }: Props) {
  const { id } = await params;
  const receiptId = Number(id);
  if (!Number.isInteger(receiptId) || receiptId < 1) notFound();
  await requirePageSession();
  await ensureSeeded();
  let receipt;
  try {
    receipt = await getReceiptDetail(receiptId);
  } catch {
    notFound();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#eef2f1", padding: "28px 16px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div className="crs-inline no-print" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <Link className="crs-btn ghost" href="/"><ArrowLeft size={14} /> Back to CRS</Link>
          <span className="crs-chip chip-clean"><ShieldCheck size={12} /> Official receipt</span>
        </div>
        <div className="print-target thermal-sheet" style={{ borderRadius: 14, boxShadow: "0 18px 50px rgba(9,26,39,.15)" }}>
          <div className="crs-card-body">
            <div className="crs-inline" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="crs-eyebrow">{HOTEL.name}</div>
                <h1 style={{ fontSize: 20, margin: "4px 0", letterSpacing: "-.03em" }}>Official Payment Receipt</h1>
                <p className="crs-subtle">{receipt.receiptNo} · {dateTimeKampala(receipt.issuedAt)} EAT</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="crs-label">Amount paid</div>
                <strong style={{ fontSize: 20 }}>{ugx(receipt.totalAmount)}</strong>
              </div>
            </div>
            <pre id="receipt-thermal-text" className="thermal">{receipt.text}</pre>
            <div style={{ marginTop: 18 }}>
              <ReceiptActions text={receipt.text} filename={`${receipt.receiptNo}.txt`} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
