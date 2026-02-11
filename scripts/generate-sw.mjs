import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const SW_PATH = path.join(PUBLIC_DIR, "sw.js");
const DEFAULT_LOCALE = "zh-cn";
const SUPPORTED_LOCALES = ["zh-cn", "en-us"];

function readPackageVersion() {
  try {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const pkg = JSON.parse(raw);
    if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
      return pkg.version.trim();
    }
  } catch (error) {
    console.warn("[sw] 读取 package.json 失败，将使用默认版本 0.0.0。", error);
  }
  return "0.0.0";
}

function readBuildFingerprint() {
  const candidates = [
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GIT_COMMIT,
    process.env.BUILD_ID,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (candidates.length) {
    return candidates[0].slice(0, 12);
  }

  // Fallback to git HEAD when env isn't available (stable per commit).
  try {
    const headPath = path.join(ROOT, ".git", "HEAD");
    if (fs.existsSync(headPath)) {
      const head = String(fs.readFileSync(headPath, "utf8") ?? "").trim();
      const refPrefix = "ref:";
      if (head.startsWith(refPrefix)) {
        const ref = head.slice(refPrefix.length).trim();
        const refPath = path.join(ROOT, ".git", ref);
        if (fs.existsSync(refPath)) {
          const hash = String(fs.readFileSync(refPath, "utf8") ?? "").trim();
          if (hash) return hash.slice(0, 12);
        }
      } else if (head) {
        return head.slice(0, 12);
      }
    }
  } catch {
    // ignore
  }

  // Last resort: change per build to avoid being stuck with an outdated SW.
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function ensurePublicDir() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
}

function generateServiceWorker() {
  const version = readPackageVersion();
  const fingerprint = readBuildFingerprint();
  const cacheName = `tools-pwa-v${version}-${fingerprint}`;

  const offlineUrls = [
    "/",
    ...SUPPORTED_LOCALES.map((locale) => `/${locale}`),
    `/${DEFAULT_LOCALE}/tools/calculator`,
    `/${DEFAULT_LOCALE}/tools/image-compressor`,
  ];

  const swSource = `const CACHE_NAME = "${cacheName}";
const OFFLINE_URLS = ${JSON.stringify(offlineUrls, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        OFFLINE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isLikelyNextRsc(pathname) {
  if (!pathname.endsWith(".txt")) return false;
  if (pathname === "/index.txt") return true;
  if (pathname === "/_not-found.txt") return true;
  if (pathname === "/zh-cn.txt" || pathname === "/en-us.txt") return true;
  if (pathname.includes("/__next.")) return true;
  if (pathname.startsWith("/zh-cn/tools/")) return true;
  if (pathname.startsWith("/en-us/tools/")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 只处理 http/https，同步跳过 chrome-extension 等不支持的协议
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Cache API 不支持缓存 206 Partial Content（常见于 Range 请求的音视频/大文件）
  const hasRange = request.headers.has("range");
  const isSameOrigin = url.origin === self.location.origin;
  const pathname = url.pathname;
  const isHtml = isHtmlNavigation(request);
  const isNextRsc = isLikelyNextRsc(pathname);

  // Avoid being stuck with long-lived HTTP caches on HTML/RSC after a deployment.
  const fetchRequest =
    isHtml || isNextRsc ? new Request(request, { cache: "reload" }) : request;

  event.respondWith(
    fetch(fetchRequest)
      .then((networkResponse) => {
        if (
          !hasRange &&
          isSameOrigin &&
          networkResponse &&
          networkResponse.status === 200 &&
          !isHtml &&
          !isNextRsc
        ) {
          const responseClone = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => {});
        }
        return networkResponse;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (isHtml) return caches.match("/${DEFAULT_LOCALE}");
            return null;
          })
          .then((fallback) => fallback || Response.error()),
      ),
  );
});
`;

  ensurePublicDir();
  fs.writeFileSync(SW_PATH, `${swSource}\n`, "utf8");
  console.log(`[sw] 已生成 ${SW_PATH}，CACHE_NAME=${cacheName}`);
}

generateServiceWorker();
