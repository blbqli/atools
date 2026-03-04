import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "../i18n/locales";
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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: {
          "zh-CN": `${baseUrl}/zh-cn`,
          "en-US": `${baseUrl}/en-us`,
        },
      },
    },
  ];

  for (const locale of SUPPORTED_LOCALES) {
    entries.push({
      url: `${baseUrl}/${locale}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.95,
      alternates: {
        languages: {
          "zh-CN": `${baseUrl}/zh-cn`,
          "en-US": `${baseUrl}/en-us`,
        },
      },
    });

    entries.push({
      url: `${baseUrl}/${locale}/privacy-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
      alternates: {
        languages: {
          "zh-CN": `${baseUrl}/zh-cn/privacy-policy`,
          "en-US": `${baseUrl}/en-us/privacy-policy`,
        },
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
          languages: {
            "zh-CN": `${baseUrl}/zh-cn/tools/${slug}`,
            "en-US": `${baseUrl}/en-us/tools/${slug}`,
          },
        },
      });
    }
  }

  return entries;
}
