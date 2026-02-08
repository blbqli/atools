import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const baseUrl =
  String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim() || "http://www.atools.live";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
