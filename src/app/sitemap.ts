import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "../i18n/locales";
import { toolSlugs } from "./tools/tool-registry";

export const dynamic = "force-static";

const baseUrl =
  String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim() || "http://www.atools.live";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    ...SUPPORTED_LOCALES.map((locale) => `/${locale}`),
    ...SUPPORTED_LOCALES.flatMap((locale) =>
      toolSlugs.map((slug) => `/${locale}/tools/${slug}`),
    ),
  ];

  const lastModified = new Date();

  // Main site sitemap entries
  const mainSitemap = routes.map((route) => ({
    url: `${baseUrl.replace(/\/+$/, "")}${route}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));

  return mainSitemap;
}
