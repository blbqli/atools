import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "../lib/site-url";

export const dynamic = "force-static";

const baseUrl = getSiteBaseUrl();

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
