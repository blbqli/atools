import type { UsePageSeoOptions } from "@/utils";

export const usePageSeo = (values: UsePageSeoOptions) => {
  const { h1Title, shortTitle } = useAppConfig();
  const siteBase = `https://${h1Title}`;
  const {
    title = shortTitle,
    seoDescription = defaultDescription,
    type = "website",
    canonicalPath = siteBase,
    image = `${siteBase}/toolsbox.png`,
    publishedTime,
    modifiedTime,
    keywords = [],
  } = values;
  const canonicalUrl = new URL(canonicalPath, siteBase).toString();
  const keywordsStr = [h1Title, shortTitle, ...keywords].join(", ");

  useSeoMeta({
    title,
    description: seoDescription,
    ogTitle: title,
    ogDescription: seoDescription,
    ogType: type,
    ogUrl: canonicalUrl,
    ogImage: image,
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: seoDescription,
    twitterImage: image,
    robots: "index, follow",
    articlePublishedTime: type === "article" ? publishedTime : undefined,
    articleModifiedTime: type === "article" ? modifiedTime : undefined,
    keywords: keywordsStr,
  });

  useHead({
    link: [{ rel: "canonical", href: canonicalUrl }],
  });
};

