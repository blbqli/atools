import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const TOOLS_DIR = path.join(ROOT, "src", "app", "tools");
const PUBLIC_DIR = path.join(ROOT, "public");

const SUPPORTED_LOCALES = ["zh-cn", "en-us"];
const publicToolsDirForLocale = (locale) => path.join(PUBLIC_DIR, locale, "tools");

function listToolSlugs() {
  const slugs = new Set();

  try {
    const out = execSync('git ls-files "src/app/tools/*/tool.json"', {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString("utf8")
      .trim();
    if (out) {
      for (const line of out.split(/\r?\n/)) {
        const filePath = line.trim();
        if (!filePath) continue;
        const slug = filePath
          .replace(/^src\/app\/tools\//, "")
          .replace(/\/tool\.json$/, "")
          .trim();
        if (slug) slugs.add(slug);
      }
    }
  } catch {
    // ignore
  }

  if (fs.existsSync(TOOLS_DIR)) {
    for (const entry of fs.readdirSync(TOOLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      if (!slug) continue;
      if (!fs.existsSync(path.join(TOOLS_DIR, slug, "tool.json"))) continue;
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort((a, b) => String(a).localeCompare(String(b), "en"));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findToolHtml(locale, slug) {
  const direct = path.join(OUT_DIR, locale, "tools", `${slug}.html`);
  if (fs.existsSync(direct)) return direct;

  const indexHtml = path.join(OUT_DIR, locale, "tools", slug, "index.html");
  if (fs.existsSync(indexHtml)) return indexHtml;

  return null;
}

function checkHtml({ html, locale, slug, config }) {
  const problems = [];

  const htmlEscape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  if (html.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING")) {
    problems.push("contains BAILOUT_TO_CLIENT_SIDE_RENDERING");
  }

  if (!html.includes('type="application/ld+json"')) {
    problems.push("missing JSON-LD script");
  }

  const name = typeof config?.name === "string" ? config.name.trim() : "";
  if (name && !(html.includes(name) || html.includes(htmlEscape(name)))) {
    problems.push("missing tool name text");
  }

  const description = typeof config?.description === "string" ? config.description.trim() : "";
  if (description && !(html.includes(description) || html.includes(htmlEscape(description)))) {
    problems.push("missing tool description text");
  }

  if (!html.includes(`/${locale}/tools/${slug}`)) {
    problems.push("missing canonical tool path");
  }

  return problems;
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`[ssg] out/ 不存在：${OUT_DIR}。请先运行 npm run build`);
    process.exitCode = 2;
    return;
  }

  const slugs = listToolSlugs();
  if (slugs.length === 0) {
    console.error("[ssg] 未发现任何工具 slug（src/app/tools/*/tool.json）");
    process.exitCode = 2;
    return;
  }

  /** @type {{ locale: string; slug: string; ok: boolean; htmlPath?: string; problems?: string[] }[]} */
  const results = [];

  for (const locale of SUPPORTED_LOCALES) {
    for (const slug of slugs) {
      const htmlPath = findToolHtml(locale, slug);
      if (!htmlPath) {
        results.push({
          locale,
          slug,
          ok: false,
          problems: ["missing exported html"],
        });
        continue;
      }

      const configPath = path.join(publicToolsDirForLocale(locale), slug, "tool.json");
      const config = readJsonIfExists(configPath);

      const html = fs.readFileSync(htmlPath, "utf8");
      const problems = checkHtml({ html, locale, slug, config });
      results.push({
        locale,
        slug,
        ok: problems.length === 0,
        htmlPath: path.relative(ROOT, htmlPath),
        ...(problems.length ? { problems } : {}),
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;

  console.log(`[ssg] checked: ${results.length}, passed: ${passed}, failed: ${failed.length}`);
  if (failed.length) {
    for (const r of failed.slice(0, 50)) {
      console.log(`[ssg] FAIL ${r.locale}/${r.slug}: ${r.problems?.join("; ")}`);
    }
    if (failed.length > 50) console.log(`[ssg] ... and ${failed.length - 50} more`);
    process.exitCode = 1;
  }

  const reportPath = path.join(OUT_DIR, "ssg-check-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify({ results }, null, 2)}\n`, "utf8");
  console.log(`[ssg] report: ${path.relative(ROOT, reportPath)}`);
}

main();
