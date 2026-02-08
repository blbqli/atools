type Fetcher = {
  fetch(request: Request): Promise<Response>;
};

type Env = {
  ASSETS: Fetcher;
};

function hasFileExtension(pathname: string) {
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

async function fetchAsset(request: Request, env: Env) {
  return env.ASSETS.fetch(request);
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const originalResponse = await fetchAsset(request, env);
    if (originalResponse.status !== 404) return originalResponse;

    if (request.method !== "GET" && request.method !== "HEAD") return originalResponse;
    if (hasFileExtension(url.pathname)) return originalResponse;

    const pathname =
      url.pathname !== "/" && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

    // Next.js static export usually writes either:
    // - /route/index.html (when trailingSlash is enabled)
    // - /route.html
    const tryIndexHtmlUrl = new URL(pathname.replace(/\/?$/, "/index.html"), url);
    const tryIndexHtml = await fetchAsset(new Request(tryIndexHtmlUrl, request), env);
    if (tryIndexHtml.status !== 404) return tryIndexHtml;

    if (pathname !== "/") {
      const tryHtmlUrl = new URL(`${pathname}.html`, url);
      const tryHtml = await fetchAsset(new Request(tryHtmlUrl, request), env);
      if (tryHtml.status !== 404) return tryHtml;
    }

    return originalResponse;
  },
};

export default worker;
