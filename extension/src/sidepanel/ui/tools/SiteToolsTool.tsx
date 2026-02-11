import React, { useEffect, useMemo, useState } from "react";

type ToolMeta = {
  slug?: string;
  path?: string;
  name?: string;
  shortName?: string;
  description?: string;
  category?: string;
  keywords?: string[];
};

type LanguageSetting = "auto" | "zh" | "en";
type EffectiveLanguage = "zh" | "en";

type MergedTool = {
  key: string;
  slug?: string;
  path?: string;
  zh?: ToolMeta;
  en?: ToolMeta;
};

const BASE_URL = "https://www.atools.live";

const TOOL_META_FILES = {
  zh: "tools-meta.zh-cn.json",
  en: "tools-meta.en-us.json",
} as const;

function getDefaultEffectiveLanguage(): EffectiveLanguage {
  const uiLang = (chrome.i18n?.getUILanguage?.() || "zh-CN").toLowerCase();
  return uiLang.startsWith("zh") ? "zh" : "en";
}

function getStoredLanguage(): LanguageSetting {
  try {
    const raw = localStorage.getItem("atools.extension.siteTools.language");
    if (raw === "zh" || raw === "en" || raw === "auto") return raw;
    return "auto";
  } catch {
    return "auto";
  }
}

function storeLanguage(value: LanguageSetting) {
  try {
    localStorage.setItem("atools.extension.siteTools.language", value);
  } catch {
    // Ignore.
  }
}

async function loadToolsIndex(filename: string): Promise<ToolMeta[]> {
  const url = chrome.runtime.getURL(filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  return (await res.json()) as ToolMeta[];
}

function mergeTools({ zh, en }: { zh: ToolMeta[]; en: ToolMeta[] }): MergedTool[] {
  const order: string[] = [];
  const map = new Map<string, MergedTool>();

  const upsert = (lang: EffectiveLanguage, tool: ToolMeta) => {
    const key = tool.slug || tool.path || tool.name || "";
    if (!key) return;

    let item = map.get(key);
    if (!item) {
      item = { key, slug: tool.slug, path: tool.path };
      map.set(key, item);
      order.push(key);
    }
    item.slug ||= tool.slug;
    item.path ||= tool.path;
    item[lang] = tool;
  };

  for (const tool of zh) upsert("zh", tool);
  for (const tool of en) upsert("en", tool);

  return order.map((key) => map.get(key)!).filter(Boolean);
}

function toolToSearchText(tool: MergedTool) {
  const parts: string[] = [];
  for (const lang of ["zh", "en"] as const) {
    const meta = tool[lang];
    if (!meta) continue;
    parts.push(
      meta.slug || "",
      meta.path || "",
      meta.name || "",
      meta.shortName || "",
      meta.description || "",
      meta.category || "",
      Array.isArray(meta.keywords) ? meta.keywords.join(" ") : "",
    );
  }
  return parts.join(" ").toLowerCase();
}

function effectiveLanguageToLocale(lang: EffectiveLanguage): "zh-cn" | "en-us" {
  return lang === "zh" ? "zh-cn" : "en-us";
}

function buildToolUrl(locale: string, tool: MergedTool) {
  const path = tool.path || (tool.slug ? `/tools/${tool.slug}` : "/tools");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}/${locale}${normalized}`;
}

export default function SiteToolsTool() {
  const [tools, setTools] = useState<MergedTool[]>([]);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<LanguageSetting>(() => getStoredLanguage());

  useEffect(() => {
    let canceled = false;
    Promise.allSettled([loadToolsIndex(TOOL_META_FILES.zh), loadToolsIndex(TOOL_META_FILES.en)])
      .then((results) => {
        if (canceled) return;

        const zh = results[0].status === "fulfilled" ? results[0].value : [];
        const en = results[1].status === "fulfilled" ? results[1].value : [];
        setTools(mergeTools({ zh, en }));

        const errors: string[] = [];
        if (results[0].status === "rejected") errors.push(`${TOOL_META_FILES.zh}: ${String(results[0].reason)}`);
        if (results[1].status === "rejected") errors.push(`${TOOL_META_FILES.en}: ${String(results[1].reason)}`);
        setError(errors.length ? errors.join(" | ") : "");
      })
      .catch((err) => {
        if (canceled) return;
        setError(String(err?.message || err));
      });
    return () => {
      canceled = true;
    };
  }, []);

  const effectiveLanguage: EffectiveLanguage = useMemo(() => {
    if (language === "auto") return getDefaultEffectiveLanguage();
    return language;
  }, [language]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => toolToSearchText(tool).includes(q));
  }, [query, tools]);

  const slice = filtered.slice(0, 80);

  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-3 p-3">
      <section className="panel flex min-h-0 flex-1 flex-col p-3">
        <div className="text-sm font-extrabold">工具搜索</div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs muted" htmlFor="language">
            语言
          </label>
          <select
            id="language"
            className="select"
            value={language}
            onChange={(e) => {
              const value = e.target.value as LanguageSetting;
              setLanguage(value);
              storeLanguage(value);
            }}
          >
            <option value="auto">自动（跟随浏览器）</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <input
          className="input mt-3"
          placeholder="输入名称 / slug / 关键词…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {error ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">工具索引加载失败：{error}</div> : null}
        <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-auto pr-1">
          {slice.map((tool) => {
            const primary = (effectiveLanguage === "zh" ? tool.zh : tool.en) || tool.zh || tool.en || {};
            const title = primary.shortName || primary.name || tool.slug || tool.key || "unknown";
            const meta = primary.description || tool.path || "";
            const tags = `${primary.category || "其他"} · ${tool.slug || ""}`;
            const open = () => {
              const locale = effectiveLanguageToLocale(effectiveLanguage);
              const url = buildToolUrl(locale, tool);
              chrome.tabs.create({ url });
            };
            return (
              <button
                key={`${tool.slug || tool.path || title}`}
                type="button"
                className="card"
                onClick={open}
              >
                <div className="text-sm font-extrabold leading-tight">{title}</div>
                <div className="mt-1 text-xs muted">{meta}</div>
                <div className="mt-1 text-[11px] muted2">{tags}</div>
              </button>
            );
          })}
          {!slice.length ? <div className="text-xs muted2">没有匹配的工具。</div> : null}
          {filtered.length > slice.length ? (
            <div className="text-xs muted2">已显示前 {slice.length} 个结果，请继续输入以缩小范围。</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
