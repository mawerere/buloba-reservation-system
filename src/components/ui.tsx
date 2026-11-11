"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  Receipt,
  X,
} from "lucide-react";
import type { ReceiptDetail } from "@/lib/crs";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "ghost" | "danger";
  small?: boolean;
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  small,
  block,
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`crs-btn ${variant} ${small ? "small" : ""} ${block ? "block" : ""} ${className}`}
    >
      {loading ? <span className="crs-mono">…</span> : children}
    </button>
  );
}

export function Card({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
  id,
  bodyClass = "",
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`crs-card ${className}`} id={id}>
      {title && (
        <header className="crs-card-head">
          <div>
            <div className="crs-card-title">
              {icon}
              <span>{title}</span>
            </div>
            {description && <div className="crs-card-desc">{description}</div>}
          </div>
          {actions && <div className="crs-inline no-print">{actions}</div>}
        </header>
      )}
      <div className={`crs-card-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="crs-label">{label}</label>
      {children}
      {hint && <div className="crs-field-hint">{hint}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "gold" | "teal";
}) {
  return (
    <div className={`crs-stat ${tone ?? ""}`}>
      <div className="crs-stat-label">{icon}{label}</div>
      <div className="crs-stat-value">{value}</div>
      {hint && <div className="crs-stat-hint">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/[\s_]+/g, "-");
  const map: Record<string, string> = {
    clean: "chip-clean",
    paid: "chip-paid",
    "checked-out": "chip-checked-out",
    dirty: "chip-dirty",
    open: "chip-open",
    reserved: "chip-reserved",
    "under-maintenance": "chip-maintenance",
    cancelled: "chip-cancelled",
    voided: "chip-voided",
    "checked-in": "chip-inhouse",
    "in-house": "chip-inhouse",
  };
  return (
    <span className={`crs-chip ${map[normalized] ?? "chip-neutral"}`}>
      <span className="crs-dot" /> {status}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="crs-empty">{children}</div>;
}

export function printElement(targetId: string) {
  const element = document.getElementById(targetId);
  if (!element) {
    window.print();
    return;
  }
  element.classList.add("print-target");
  const cleanup = () => {
    element.classList.remove("print-target");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1200);
}

export function PrintButton({
  targetId,
  label = "Print / Save PDF",
  variant = "ghost",
  small = true,
}: {
  targetId: string;
  label?: string;
  variant?: "primary" | "gold" | "ghost" | "danger";
  small?: boolean;
}) {
  return (
    <Button variant={variant} small={small} onClick={() => printElement(targetId)} className="no-print">
      <Printer /> {label}
    </Button>
  );
}

export function DownloadTextButton({
  text,
  filename,
  label = "Download .txt",
}: {
  text: string;
  filename: string;
  label?: string;
}) {
  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="ghost" small onClick={download} className="no-print">
      <Download /> {label}
    </Button>
  );
}

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div className={`crs-toast ${type === "error" ? "error" : ""}`} role="status">
      {type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <span style={{ lineHeight: 1.55 }}>{message}</span>
      <button className="crs-icon-btn" onClick={onClose} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptDetail | null;
  onClose: () => void;
}) {
  if (!receipt) return null;
  return (
    <div className="crs-modal-backdrop no-print" onClick={onClose}>
      <div className="crs-modal" onClick={(event) => event.stopPropagation()}>
        <header className="crs-modal-head">
          <div>
            <div className="crs-card-title"><Receipt size={15} /> Official receipt</div>
            <div className="crs-card-desc">{receipt.receiptNo} · ready for thermal printer or PDF</div>
          </div>
          <button className="crs-icon-btn" onClick={onClose} aria-label="Close receipt">
            <X size={15} />
          </button>
        </header>
        <div className="crs-modal-body">
          <div id="receipt-modal-print">
            <pre className="thermal">{receipt.text}</pre>
          </div>
          <div className="crs-divider" />
          <div className="crs-inline">
            <Button small onClick={() => printElement("receipt-modal-print")}>
              <Printer /> Print / Save PDF
            </Button>
            <DownloadTextButton text={receipt.text} filename={`${receipt.receiptNo}.txt`} label="Thermal .txt" />
            <a className="crs-btn ghost small" href={`/receipt/${receipt.id}`} target="_blank" rel="noreferrer">
              <Receipt /> Open receipt page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
