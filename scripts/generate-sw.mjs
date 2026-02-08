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

function ensurePublicDir() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
}

function generateServiceWorker() {
  const version = readPackageVersion();
  const cacheName = `tools-pwa-v${version}`;

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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

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

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          !hasRange &&
          isSameOrigin &&
          networkResponse &&
          networkResponse.status === 200
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
          .then((cachedResponse) => cachedResponse || caches.match("/${DEFAULT_LOCALE}")),
      ),
  );
});
`;

  ensurePublicDir();
  fs.writeFileSync(SW_PATH, `${swSource}\n`, "utf8");
  console.log(`[sw] 已生成 ${SW_PATH}，CACHE_NAME=${cacheName}`);
}

generateServiceWorker();
