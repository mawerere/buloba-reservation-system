"use client";

import { Download, FileDown, Printer } from "lucide-react";

export default function ReceiptActions({ text, filename }: { text: string; filename: string }) {
  const thermalPrint = () => {
    const style = document.createElement("style");
    style.id = "bh-thermal-page-style";
    style.textContent = "@page { size: 80mm auto; margin: 3mm; } body.thermal-print .thermal { font-size: 9px !important; border: 0 !important; padding: 0 !important; background: #fff !important; } body.thermal-print .crs-report-head, body.thermal-print .crs-card-head { display: none !important; }";
    document.head.appendChild(style);
    document.body.classList.add("thermal-print");
    const cleanup = () => {
      document.body.classList.remove("thermal-print");
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  const downloadText = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 30, 35);
    const lines = doc.splitTextToSize(text, 180) as string[];
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 18;
    for (const line of lines) {
      if (y > pageHeight - 16) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, 15, y);
      y += 4.4;
    }
    doc.setFontSize(7);
    doc.text("Buloba Hotel CRS · A4 receipt export · Kiwesa, Wakiso District", 15, pageHeight - 8);
    doc.save(filename.replace(/\.txt$/i, ".pdf"));
  };

  return (
    <div className="crs-inline no-print">
      <button className="crs-btn primary" onClick={thermalPrint}><Printer /> Print 80mm thermal / PDF</button>
      <button className="crs-btn gold" onClick={() => void downloadPdf()}><FileDown /> Download A4 PDF</button>
      <button className="crs-btn ghost" onClick={downloadText}><Download /> Thermal .txt</button>
    </div>
  );
}
