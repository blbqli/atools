import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "out");

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(relativePath) {
  const src = path.join(PUBLIC_DIR, relativePath);
  const dest = path.join(OUT_DIR, relativePath);
  if (!(await exists(src))) return false;
  if (!(await exists(OUT_DIR))) return false;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest);
  return true;
}

const copied = [];
if (await copyIfPresent("sw.js")) copied.push("sw.js");

console.log(`[sync-out] copied: ${copied.length ? copied.join(", ") : "none"}`);

