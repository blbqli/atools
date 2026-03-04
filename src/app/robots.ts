import type { MetadataRoute } from "next";

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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    host: baseUrl,
    sitemap: [`${baseUrl}/sitemap.xml`],
  };
}
