const CACHE_NAME = "tools-pwa-v0.1.0";
const OFFLINE_URLS = [
  "/",
  "/zh-cn",
  "/en-us",
  "/zh-cn/tools/calculator",
  "/zh-cn/tools/image-compressor"
];

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
          .then((cachedResponse) => cachedResponse || caches.match("/zh-cn")),
      ),
  );
});

