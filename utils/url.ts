const protocolPattern = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

/**
 * Normalize internal links so every directory-style path ends with "/"
 * while external or special links remain untouched.
 */
export const normalizeInternalHref = (href?: string): string => {
  if (!href) {
    return "/";
  }

  const raw = href.trim();
  if (raw === "" || raw === "/") {
    return "/";
  }

  if (raw.startsWith("#")) {
    return raw;
  }

  if (protocolPattern.test(raw) || raw.startsWith("//")) {
    return raw;
  }

  if (raw.includes("?") || raw.includes("#")) {
    return raw;
  }

  if (!raw.startsWith("/")) {
    return raw.endsWith("/") ? `/${raw}` : `/${raw}/`;
  }

  return raw.endsWith("/") ? raw : `${raw}/`;
};

