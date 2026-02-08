import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

function getMetadataBase(): URL {
  const fallback = "http://www.atools.live";
  const raw = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const candidate = raw || fallback;
  try {
    return new URL(candidate);
  } catch {
    try {
      return new URL(`http://${candidate}`);
    } catch {
      return new URL(fallback);
    }
  }
}

const metadataBase = getMetadataBase();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase,
  title: "纯粹工具站",
  description: "纯前端 SSR 工具集合示例站点",
  applicationName: "纯粹工具站",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)] selection:bg-blue-500/20 selection:text-blue-600`}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
