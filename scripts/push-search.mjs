import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

function isBlankEnvValue(value) {
  return value == null || !String(value).trim();
}

function unquoteDotEnvValue(raw) {
  const value = String(raw ?? "");
  if (value.length < 2) return value;

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const inner = value.slice(1, -1);
    if (first === "'") return inner;
    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\")
      .replace(/\\"/g, '"');
  }
  return value;
}

function parseDotEnv(content) {
  const result = {};
  const lines = String(content ?? "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const name = match[1];
    const rest = match[2] ?? "";
    let value = rest;

    const startsQuoted = value.startsWith('"') || value.startsWith("'");
    if (!startsQuoted) {
      const commentIndex = value.search(/\s+#/);
      if (commentIndex >= 0) value = value.slice(0, commentIndex);
    }

    result[name] = unquoteDotEnvValue(value.trim());
  }

  return result;
}

function loadDotEnvFiles(cwd = process.cwd()) {
  const loadedKeys = new Set();
  const nodeEnv = String(process.env.NODE_ENV ?? "").trim().toLowerCase();
  const candidates = [
    ".env",
    nodeEnv ? `.env.${nodeEnv}` : null,
    ".env.local",
    nodeEnv ? `.env.${nodeEnv}.local` : null,
  ].filter(Boolean);

  for (const rel of candidates) {
    const filePath = path.join(cwd, rel);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    const vars = parseDotEnv(content);

    for (const [name, value] of Object.entries(vars)) {
      const alreadySetExternally = !isBlankEnvValue(process.env[name]) && !loadedKeys.has(name);
      if (alreadySetExternally) continue;
      if (process.env[name] === value) continue;
      process.env[name] = value;
      loadedKeys.add(name);
    }
  }
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true";
}

loadDotEnvFiles();

const ENABLE = process.env.ENABLE_SEARCH_PUSH === "true";

if (!ENABLE) {
  console.log("[search-push] 环境变量 ENABLE_SEARCH_PUSH != 'true'，跳过自动推送。");
  process.exit(0);
}

const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

if (!siteUrl) {
  console.warn(
    "[search-push] 未设置 SITE_URL 或 NEXT_PUBLIC_SITE_URL，无法构造链接，跳过自动推送。",
  );
  process.exit(0);
}

const siteBase = siteUrl.replace(/\/+$/, "");
const OUT_DIR = path.join(process.cwd(), "out");
const SITEMAP_PATH = path.join(OUT_DIR, "sitemap.xml");

if (!fs.existsSync(OUT_DIR)) {
  console.warn("[search-push] out 目录不存在，可能尚未执行静态导出，跳过自动推送。");
  process.exit(0);
}

async function collectRoutes(dir, root) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const routes = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childRoutes = await collectRoutes(fullPath, root);
      routes.push(...childRoutes);
    } else if (entry.isFile() && entry.name === "index.html") {
      const relative = path.relative(root, fullPath);
      let route = `/${relative
        .replace(/index\.html$/, "")
        .replace(/\\/g, "/")}`;

      if (route === "/") {
        routes.push("/");
        continue;
      }

      if (route.endsWith("/")) {
        route = route.slice(0, -1);
      }

      if (!route.startsWith("/_")) {
        routes.push(route);
      }
    }
  }

  return routes;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseSitemapLocs(xml) {
  const matches = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)];
  return matches
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

function normalizeUrl(rawUrl) {
  try {
    const base = new URL(siteBase);
    const parsed = new URL(rawUrl);
    return `${base.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

async function collectUrlsFromSitemap() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    return [];
  }

  try {
    const xml = await fs.promises.readFile(SITEMAP_PATH, "utf8");
    const urls = parseSitemapLocs(xml)
      .map((loc) => normalizeUrl(loc))
      .filter(Boolean);
    return [...new Set(urls)];
  } catch {
    return [];
  }
}

function request(
  targetUrl,
  { method = "GET", body, headers = {} } = {},
) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === "http:" ? http : https;
      const normalizedHeaders = { ...headers };

      if (body && normalizedHeaders["Content-Length"] == null) {
        normalizedHeaders["Content-Length"] = Buffer.byteLength(body);
      }

      const options = {
        method,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "http:" ? 80 : 443),
        path: `${urlObj.pathname}${urlObj.search}`,
        headers: normalizedHeaders,
      };

      const req = client.request(options, (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          if (responseBody.length < 500) {
            responseBody += chunk;
          }
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: responseBody.slice(0, 500),
          });
        });
      });

      req.on("error", () => resolve({ statusCode: 0, body: "" }));

      if (body) {
        req.write(body);
      }
      req.end();
    } catch {
      resolve({ statusCode: 0, body: "" });
    }
  });
}

function toPingUrl(template, sitemapUrl) {
  const encoded = encodeURIComponent(sitemapUrl);
  if (template.includes("{sitemap}")) {
    return template.replaceAll("{sitemap}", encoded);
  }
  return template;
}

async function pingSitemap() {
  const sitemapUrl = `${siteBase}/sitemap.xml`;
  const endpoints = [];

  if (envFlag("ENABLE_LEGACY_SITEMAP_PING", false)) {
    endpoints.push(
      {
        name: "Google(legacy)",
        url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      },
      {
        name: "Bing(legacy)",
        url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      },
    );
  } else {
    console.log(
      "[search-push] 已跳过 Google/Bing legacy sitemap ping（接口已下线）。如需兼容旧流程可设置 ENABLE_LEGACY_SITEMAP_PING=1。",
    );
  }

  const optionalEndpoints = [
    {
      name: "神马",
      template: process.env.SHENMA_SITEMAP_PING_URL,
    },
    {
      name: "360",
      template: process.env.SO360_SITEMAP_PING_URL,
    },
  ].filter((item) => item.template);

  const extraTemplates = (process.env.EXTRA_SITEMAP_PING_ENDPOINTS ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  optionalEndpoints.forEach((item) => {
    endpoints.push({
      name: item.name,
      url: toPingUrl(item.template, sitemapUrl),
    });
  });

  extraTemplates.forEach((template, index) => {
    endpoints.push({
      name: `Extra#${index + 1}`,
      url: toPingUrl(template, sitemapUrl),
    });
  });

  if (!endpoints.length) {
    console.log("[search-push] 未配置可用 sitemap ping 端点，跳过 sitemap ping。");
    return;
  }

  console.log("[search-push] 开始提交 sitemap：", sitemapUrl);

  for (const ep of endpoints) {
    const res = await request(ep.url);
    console.log(
      `[search-push] ${ep.name} 响应状态码: ${res.statusCode || "请求失败"}`,
    );
  }
}

async function pushBaidu(urls) {
  const endpoint = process.env.BAIDU_PUSH_ENDPOINT;
  if (!endpoint) {
    console.log(
      "[search-push] 未配置 BAIDU_PUSH_ENDPOINT，跳过百度主动推送（可在百度站长平台获取接口地址）。",
    );
    return;
  }

  if (!urls.length) {
    console.log("[search-push] 没有可推送的 URL，跳过百度主动推送。");
    return;
  }

  console.log(
    `[search-push] 向百度主动推送 ${urls.length} 条链接到: ${endpoint}`,
  );

  const body = urls.join("\n");
  const res = await request(endpoint, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
  console.log(
    `[search-push] 百度推送响应状态码: ${res.statusCode || "请求失败"}`,
  );
}

async function pushIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log(
      "[search-push] 未配置 INDEXNOW_KEY，跳过 Bing IndexNow 推送。",
    );
    return;
  }

  if (!urls.length) {
    console.log("[search-push] 没有可推送的 URL，跳过 Bing IndexNow 推送。");
    return;
  }

  const endpoint = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION ?? `${siteBase}/${key}.txt`;
  const host = new URL(siteBase).hostname;
  const payload = JSON.stringify({
    host,
    key,
    keyLocation,
    urlList: urls,
  });

  console.log(
    `[search-push] 向 IndexNow 提交 ${urls.length} 条链接到: ${endpoint}`,
  );
  const res = await request(endpoint, {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  console.log(
    `[search-push] IndexNow 响应状态码: ${res.statusCode || "请求失败"}`,
  );
}

async function main() {
  const sitemapUrls = await collectUrlsFromSitemap();
  const routes = sitemapUrls.length ? [] : await collectRoutes(OUT_DIR, OUT_DIR);
  const urls = sitemapUrls.length
    ? sitemapUrls
    : routes.map((route) => `${siteBase}${route}`);

  console.log(`[search-push] 本次待推送 URL 数量: ${urls.length}`);

  const preview = urls.slice(0, 10);
  if (preview.length) {
    console.log("[search-push] URL 示例（前 10 条）：");
    preview.forEach((u) => console.log(`  - ${u}`));
  }

  await pingSitemap();
  await pushBaidu(urls);
  await pushIndexNow(urls);

  console.log(
    "[search-push] 已执行 sitemap ping、百度主动推送（如配置）与 IndexNow（如配置）。",
  );
}

main().catch((err) => {
  console.error("[search-push] 执行异常：", err);
  process.exit(0);
});
