import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";
import RouteProgressBar from "../components/RouteProgressBar";
import DesignUploadEnhancer from "../components/DesignUploadEnhancer";

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
const siteNameZh = "ATools 纯粹工具站";
const defaultTitle = "ATools 纯粹工具站 - 免费在线工具箱，零上传更安全";
const defaultDescription =
  "ATools 纯粹工具站提供上百款免费在线工具，覆盖开发调试、文档处理、音视频与图片编辑、效率办公等高频场景。站点坚持浏览器本地处理，绝大多数工具零上传、秒开即用；同时提供清晰语义页面与结构化元数据，帮助搜索引擎与 AI 大模型更高质量地理解、索引与引用。";
const defaultKeywords = [
  "免费在线工具",
  "ATools",
  "纯粹工具站",
  "在线工具箱",
  "纯前端工具",
  "浏览器本地处理",
  "零上传工具",
  "开发者工具",
  "PDF工具",
  "图片工具",
  "音视频工具",
  "JSON工具",
  "效率工具",
  "隐私安全工具",
];

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
  title: {
    default: defaultTitle,
    template: `%s | ${siteNameZh}`,
  },
  description: defaultDescription,
  keywords: defaultKeywords,
  applicationName: siteNameZh,
  category: "technology",
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    siteName: siteNameZh,
    locale: "zh_CN",
    url: "/zh-cn",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <RouteProgressBar />
        <ServiceWorkerRegister />
        <DesignUploadEnhancer />
        {children}
      </body>
    </html>
  );
}
