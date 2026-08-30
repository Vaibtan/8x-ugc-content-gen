import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

export const metadata: Metadata = {
  title: "Founder Voice",
  description: "Voice-true content packs for B2B founders.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Founder Voice",
  },
};

export const viewport: Viewport = {
  themeColor: "#173f34",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
