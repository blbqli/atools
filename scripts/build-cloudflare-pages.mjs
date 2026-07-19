import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const FFMPEG_CDN_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawnSync(npmCommand, ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_R2_ASSETS_URL: FFMPEG_CDN_BASE_URL,
  },
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

rmSync("out/vendor/ffmpeg/core", { recursive: true, force: true });
console.log("[cloudflare-pages] 已移除超过 Pages 单文件限制的本地 FFmpeg 资源，运行时改用 CDN。");
