import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "out");
const LEGACY_TOOLS_OUT_DIR = path.join(OUT_DIR, "tools");

function removeLegacyToolsDir() {
  if (!fs.existsSync(LEGACY_TOOLS_OUT_DIR)) return { removed: false };
  fs.rmSync(LEGACY_TOOLS_OUT_DIR, { recursive: true, force: true });
  return { removed: true };
}

if (!fs.existsSync(OUT_DIR)) {
  console.log("[out] out/ 不存在，跳过清理 /tools 输出。");
} else {
  const { removed } = removeLegacyToolsDir();
  console.log(`[out] cleaned legacy tools dir: ${removed ? "removed" : "none"}`);
}

