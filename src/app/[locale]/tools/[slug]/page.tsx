import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "../../../../i18n/locales";
import { getToolConfig } from "../../../../lib/tool-config";
import { toolLoaders, toolSlugs, type ToolSlug } from "../../../tools/tool-registry";
import { ToolConfigProvider } from "../../../../components/ToolConfigProvider";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) => toolSlugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  if (!(slug in toolLoaders)) return {};

  const config = getToolConfig(slug, locale);
  const canonical = `/${locale}/tools/${slug}`;
  const isEn = locale === "en-us";
  const title = isEn ? `${config.name} | Pure Tools` : `${config.name} | ATools 纯粹工具站`;
  const descriptionBase = config.seoDescription || config.description;
  const description = isEn
    ? `${descriptionBase} Runs in the browser where possible, with no file upload by default.`
    : `${descriptionBase} 尽可能在浏览器本地运行，文件和文本默认不上传服务器。`;
  const keywords = Array.from(
    new Set([
      ...(config.keywords ?? []),
      ...(isEn
        ? ["free online tools", "web tools", "local processing", "privacy-first", "Pure Tools"]
        : ["免费在线工具", "ATools", "纯粹工具站", "纯前端工具", "零上传工具", "本地处理"]),
    ]),
  );

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    manifest: `/${locale}/tools/${slug}/manifest.webmanifest`,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: isEn ? "Pure Tools" : "ATools 纯粹工具站",
      locale: isEn ? "en_US" : "zh_CN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        "zh-CN": `/zh-cn/tools/${slug}`,
        "en-US": `/en-us/tools/${slug}`,
        "x-default": `/${DEFAULT_LOCALE}/tools/${slug}`,
      },
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;

	if (!isLocale(locale)) notFound();
	if (!(slug in toolLoaders)) notFound();

  const toolSlug = slug as ToolSlug;
  const config = getToolConfig(toolSlug, locale);
  const ToolClient = (await toolLoaders[toolSlug]()).default;
  return (
    <ToolConfigProvider toolSlug={toolSlug} locale={locale} config={config}>
      <ToolClient />
    </ToolConfigProvider>
  );
}
