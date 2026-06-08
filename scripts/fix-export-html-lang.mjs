import fsp from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "out");
const LOCALE_LANG = new Map([
  ["zh-cn", "zh-CN"],
  ["en-us", "en-US"],
]);

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function* walkFiles(rootDir) {
  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(fullPath);
    else if (entry.isFile()) yield fullPath;
  }
}

function localeForHtmlFile(filePath) {
  const relativeParts = path.relative(OUT_DIR, filePath).split(path.sep);
  const firstPart = relativeParts[0] ?? "";

  if (LOCALE_LANG.has(firstPart)) return LOCALE_LANG.get(firstPart);

  for (const [locale, lang] of LOCALE_LANG) {
    if (firstPart === `${locale}.html`) return lang;
  }

  return null;
}

async function fixHtmlLang() {
  if (!(await exists(OUT_DIR))) return { scanned: 0, changed: 0 };

  let scanned = 0;
  let changed = 0;

  for await (const filePath of walkFiles(OUT_DIR)) {
    if (!filePath.endsWith(".html")) continue;
    const lang = localeForHtmlFile(filePath);
    if (!lang) continue;

    scanned += 1;
    const html = await fsp.readFile(filePath, "utf8");
    const nextHtml = html.replace(/<html\b([^>]*)\blang=["'][^"']*["']([^>]*)>/i, `<html$1lang="${lang}"$2>`);
    if (nextHtml === html) continue;

    await fsp.writeFile(filePath, nextHtml);
    changed += 1;
  }

  return { scanned, changed };
}

const result = await fixHtmlLang();
console.log(`[export-lang] scanned=${result.scanned} changed=${result.changed}`);
