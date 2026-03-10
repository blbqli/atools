import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALE_TAG, SUPPORTED_LOCALES } from "../i18n/locales";
import { toolSlugs } from "./tools/tool-registry";

export const dynamic = "force-static";

function getBaseUrl(): string {
  const fallback = "https://www.atools.live";
  const raw = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const candidate = raw || fallback;
  try {
    return new URL(candidate).origin;
  } catch {
    try {
      return new URL(`https://${candidate}`).origin;
    } catch {
      return fallback;
    }
  }
}

const baseUrl = getBaseUrl();

function buildAlternates(pathname: string): Record<string, string> {
  const entries = SUPPORTED_LOCALES.map((locale) => [LOCALE_TAG[locale], `${baseUrl}/${locale}${pathname}`] as const);
  entries.push(["x-default", `${baseUrl}/${DEFAULT_LOCALE}${pathname}`]);
  return Object.fromEntries(entries);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of SUPPORTED_LOCALES) {
    entries.push({
      url: `${baseUrl}/${locale}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.95,
      alternates: {
        languages: buildAlternates(""),
      },
    });

    entries.push({
      url: `${baseUrl}/${locale}/privacy-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
      alternates: {
        languages: buildAlternates("/privacy-policy"),
      },
    });
  }

  for (const slug of toolSlugs) {
    for (const locale of SUPPORTED_LOCALES) {
      entries.push({
        url: `${baseUrl}/${locale}/tools/${slug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.85,
        alternates: {
          languages: buildAlternates(`/tools/${slug}`),
        },
      });
    }
  }

  return entries;
}
