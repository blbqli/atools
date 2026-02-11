import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cp } from "node:fs/promises";

async function copyDirSafe(from: string, to: string) {
  await cp(from, to, { recursive: true, force: true });
}

function extensionAssetsPlugin() {
  return {
    name: "extension-assets",
    apply: "build",
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      await mkdir(outDir, { recursive: true });

      const manifestSrc = path.resolve(__dirname, "src/manifest.json");
      const manifest = JSON.parse(await readFile(manifestSrc, "utf8"));
      await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      const iconsSrc = path.resolve(__dirname, "icons");
      await copyDirSafe(iconsSrc, path.join(outDir, "icons"));

      const toolMetaFiles = ["tools-meta.json", "tools-meta.zh-cn.json", "tools-meta.en-us.json"];
      for (const file of toolMetaFiles) {
        const from = path.resolve(__dirname, file);
        await cp(from, path.join(outDir, file), { force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), extensionAssetsPlugin()],
  root: path.resolve(__dirname, "src/sidepanel"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "src/sidepanel/sidepanel.html"),
        background: path.resolve(__dirname, "src/background/index.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background.js";
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

