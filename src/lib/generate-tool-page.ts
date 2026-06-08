import { Metadata } from "next";
import { DEFAULT_LOCALE } from "../i18n/locales";
import { getToolConfig } from "./tool-config";

export function generateToolMetadata(toolSlug: string): Metadata {
  const config = getToolConfig(toolSlug);
  const title = `${config.name} | ATools 纯粹工具站`;
  const descriptionBase = config.seoDescription || config.description;
  const description = `${descriptionBase} 尽可能在浏览器本地运行，文件和文本默认不上传服务器。`;
  const keywords = Array.from(
    new Set([
      ...(config.keywords ?? []),
      "免费在线工具",
      "ATools",
      "纯粹工具站",
      "纯前端工具",
      "零上传工具",
      "浏览器本地处理",
    ]),
  );
  
  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    manifest: `/${DEFAULT_LOCALE}/tools/${toolSlug}/manifest.webmanifest`,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "ATools 纯粹工具站",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `/${DEFAULT_LOCALE}/tools/${toolSlug}`,
      languages: {
        "zh-CN": `/zh-cn/tools/${toolSlug}`,
        "en-US": `/en-us/tools/${toolSlug}`,
        "x-default": `/${DEFAULT_LOCALE}/tools/${toolSlug}`,
      },
    },
  };
}
