"use client";

import { useEffect } from "react";
import { requestBackgroundSync, syncOutbox } from "@/lib/offline";

export default function PwaRegister() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("bh:connectivity", { detail: { online: navigator.onLine } }));
    let cancelled = false;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "BH_SYNC_NOW") {
          void syncOutbox().then((result) => {
            window.dispatchEvent(new CustomEvent("bh:sync-update", { detail: result }));
            if (result.synced > 0) window.dispatchEvent(new CustomEvent("bh:refresh"));
          });
        }
      });
    }

    const onOnline = () => {
      window.dispatchEvent(new CustomEvent("bh:connectivity", { detail: { online: true } }));
      void syncOutbox().then((result) => {
        if (cancelled) return;
        window.dispatchEvent(new CustomEvent("bh:sync-update", { detail: result }));
        window.dispatchEvent(new CustomEvent("bh:refresh"));
      });
      void requestBackgroundSync();
    };
    const onOffline = () => {
      window.dispatchEvent(new CustomEvent("bh:connectivity", { detail: { online: false } }));
      void requestBackgroundSync();
    };
    const onFocus = () => {
      if (navigator.onLine) {
        void syncOutbox().then((result) => {
          window.dispatchEvent(new CustomEvent("bh:sync-update", { detail: result }));
          if (result.synced > 0) window.dispatchEvent(new CustomEvent("bh:refresh"));
        });
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    void syncOutbox().then((result) => {
      if (!cancelled) window.dispatchEvent(new CustomEvent("bh:sync-update", { detail: result }));
    });

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return null;
}
