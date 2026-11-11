import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buloba Hotel | Management & CRS",
  description:
    "Offline-first computerized reservation system for Buloba Hotel, Kiwesa, Wakiso District: secure departmental POS, folios, printable VAT receipts and reporting.",
  manifest: "/manifest.webmanifest",
  applicationName: "Buloba Hotel CRS",
  appleWebApp: { capable: true, title: "Buloba CRS", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102536",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
