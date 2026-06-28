import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolNavClient from "../ToolNavClient";
import { getMessages } from "../../i18n/messages";
import { DEFAULT_LOCALE, isLocale, LOCALE_TAG } from "../../i18n/locales";
import { getSiteBaseUrl } from "../../lib/site-url";
import { getToolConfig } from "../../lib/tool-config";
import { toolSlugs } from "../tools/tool-registry";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  const isEn = locale === "en-us";

  const title = isEn
    ? `Free Online Tools Directory | ${messages.siteName}`
    : `免费在线工具导航大全 - 开发/办公/音视频/图片工具一站直达 | ${messages.siteName}`;
  const description = isEn
    ? `${messages.siteName} is a free online tools directory for developer workflows, document handling, image and media processing, and productivity tasks. Most tools run locally in the browser with no file upload by default.`
    : `${messages.siteName} 是免费在线工具导航，覆盖开发调试、文档处理、图片与音视频处理、办公效率等场景。多数工具在浏览器本地运行，文件和文本默认不上传服务器。`;
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
      siteName: messages.siteName,
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
        "x-default": `/${DEFAULT_LOCALE}`,
      },
    },
  };
}

function buildHomeJsonLd(locale: string, siteName: string, isEn: boolean) {
  const baseUrl = getSiteBaseUrl();
  const localePath = `/${locale}`;
  const language = LOCALE_TAG[locale as keyof typeof LOCALE_TAG] ?? (isEn ? "en-US" : "zh-CN");
  const homeUrl = `${baseUrl}${localePath}`;
  const listedToolSlugs = toolSlugs.slice(0, 80);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "ATools",
        alternateName: ["Pure Tools", "纯粹工具站"],
        url: baseUrl,
        logo: `${baseUrl}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        name: siteName,
        url: homeUrl,
        inLanguage: language,
        publisher: {
          "@id": `${baseUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${homeUrl}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "CollectionPage",
        "@id": `${homeUrl}#collection`,
        url: homeUrl,
        name: isEn ? "Free Online Tools Directory" : "免费在线工具导航大全",
        description: isEn
          ? "Directory of browser-based tools for development, documents, media processing, images, and productivity."
          : "面向开发调试、文档处理、图片与音视频处理、办公效率的浏览器工具导航。",
        inLanguage: language,
        isPartOf: {
          "@id": `${baseUrl}/#website`,
        },
      },
      {
        "@type": "ItemList",
        "@id": `${homeUrl}#tools`,
        name: isEn ? "Available online tools" : "可用在线工具列表",
        numberOfItems: listedToolSlugs.length,
        itemListElement: listedToolSlugs.map((slug, index) => {
          const config = getToolConfig(slug, locale);
          return {
            "@type": "ListItem",
            position: index + 1,
            url: `${baseUrl}${localePath}/tools/${slug}`,
            name: config.name,
            description: config.description,
          };
        }),
      },
    ],
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const isEn = locale === "en-us";
  const jsonLd = buildHomeJsonLd(locale, messages.siteName, isEn);

  return (
    <div className="space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="relative mx-auto max-w-2xl text-center animate-fade-in-up">
        <div className="mb-6 inline-flex items-center rounded-full border border-blue-100 bg-blue-50/50 px-3 py-1 text-xs font-medium text-blue-600 backdrop-blur-sm">
          <span className="mr-2 flex h-2 w-2 rounded-full bg-blue-600" />
          {messages.homeBadge}
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          {messages.homeTitlePrefix}
          <span className="text-gradient">{messages.homeTitleHighlight}</span>
        </h1>
        <p className="hidden text-lg leading-8 text-slate-600 sm:block">{messages.homeDescription}</p>
      </section>

      <ToolNavClient />
    </div>
  );
}
