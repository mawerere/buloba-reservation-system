"use client";

import { CloudUpload, HardDriveDownload, RefreshCw, Wifi, WifiOff } from "lucide-react";

export default function OfflineBanner({
  online,
  pending,
  syncing,
  lastSync,
  onSync,
}: {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  onSync: () => void;
}) {
  return (
    <div className={`crs-note ${online ? "" : "warning"}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {online ? <Wifi size={15} /> : <WifiOff size={15} />}
        <span>
          <strong>{online ? "Online · live sync enabled" : "Offline mode · transactions are saved locally"}</strong>
          {" · "}
          <span className="crs-mono">{pending}</span> pending outbox item{pending === 1 ? "" : "s"}
          {lastSync ? ` · last sync ${lastSync}` : ""}
        </span>
      </div>
      <div className="crs-inline">
        <span className="crs-chip chip-neutral"><HardDriveDownload size={11} /> Dexie cache</span>
        <button className="crs-btn ghost small" onClick={onSync} disabled={!online || syncing}>
          <RefreshCw size={12} /> {syncing ? "Syncing…" : "Sync now"}
        </button>
        {!online && <span className="crs-chip chip-dirty"><CloudUpload size={11} /> Auto-sync on reconnect</span>}
      </div>
    </div>
  );
}
