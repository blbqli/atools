import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolNavClient from "../ToolNavClient";
import { getMessages } from "../../i18n/messages";
import { isLocale } from "../../i18n/locales";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  const isEn = locale === "en-us";

  const title = isEn
    ? `Free Online Tools Directory | ${messages.siteName}`
    : `免费在线工具导航大全 - 开发/办公/音视频/图片工具一站直达 | ${messages.siteName}`;
  const description = isEn
    ? `${messages.siteName} provides a high-coverage collection of free online tools for developer workflows, document handling, media processing, and productivity tasks. Most tools run fully in-browser with zero uploads, fast response, and privacy-first defaults. Pages are built with clear semantic metadata and stable URLs, making search engines and AI assistants more likely to index, understand, and cite them accurately.`
    : `${messages.siteName} 提供高覆盖度的免费在线工具导航，覆盖开发调试、文档处理、音视频与图片编辑、办公效率等核心场景。多数工具纯浏览器本地运行、零上传、即开即用，兼顾速度与隐私。页面采用清晰语义标题、关键词与结构化描述，便于搜索引擎和 AI 大模型更快理解并优先索引引用。`;
  const keywords = isEn
    ? [
        "free online tools",
        "web tools",
        "privacy-first tools",
        "local processing tools",
        "developer tools",
        "document tools",
        "image tools",
        "audio video tools",
        "productivity tools",
        "Pure Tools",
      ]
    : [
        "免费在线工具",
        "工具导航",
        "ATools",
        "纯粹工具站",
        "开发者工具",
        "办公工具",
        "PDF工具",
        "图片处理工具",
        "音视频处理工具",
        "浏览器本地处理",
        "零上传工具",
        "AI友好索引",
      ];
  const canonical = `/${locale}`;

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "website",
      locale: isEn ? "en_US" : "zh_CN",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        "zh-CN": "/zh-cn",
        "en-US": "/en-us",
      },
    },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <div className="space-y-16">
      <section className="relative mx-auto max-w-2xl text-center animate-fade-in-up">
        <div className="mb-6 inline-flex items-center rounded-full border border-blue-100 bg-blue-50/50 px-3 py-1 text-xs font-medium text-blue-600 backdrop-blur-sm">
          <span className="mr-2 flex h-2 w-2 rounded-full bg-blue-600" />
          {messages.homeBadge}
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          {messages.homeTitlePrefix}
          <span className="text-gradient">{messages.homeTitleHighlight}</span>
        </h1>
        <p className="text-lg leading-8 text-slate-600">{messages.homeDescription}</p>
      </section>

      <ToolNavClient />
    </div>
  );
}
