#!/usr/bin/env node

/**
 * 上传大文件（FFmpeg、RealCUGAN 等）到 Cloudflare R2
 *
 * 用法:
 *   npm run upload:assets
 *
 * 环境变量:
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare 账户 ID
 *   CLOUDFLARE_R2_BUCKET - R2 bucket 名称
 *   R2_PUBLIC_URL - R2 公共访问 URL（可选，默认使用自定义域名）
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// 定义要上传的大文件
const ASSETS = [
  {
    name: "FFmpeg",
    dir: path.join(ROOT, "public", "vendor", "ffmpeg", "core"),
    files: ["ffmpeg-core.js", "ffmpeg-core.wasm"],
    r2Path: "ffmpeg/",
  },
  {
    name: "RealCUGAN",
    dir: path.join(ROOT, "public", "vendor", "realcugan"),
    files: [
      "realcugan-ncnn-webassembly-simd-threads.js",
      "realcugan-ncnn-webassembly-simd-threads.wasm",
      "realcugan-ncnn-webassembly-simd-threads.data",
    ],
    r2Path: "realcugan/",
  },
];

// 从环境变量获取配置
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || "atools-assets";

/**
 * 检查文件是否存在
 */
async function checkFiles() {
  console.log("🔍 检查大文件资源...");
  let totalSize = 0;

  for (const asset of ASSETS) {
    console.log(`\n  📦 ${asset.name}:`);
    for (const file of asset.files) {
      const filePath = path.join(asset.dir, file);
      try {
        const stat = await fs.stat(filePath);
        const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
        console.log(`    ✓ ${file} (${sizeMB} MB)`);
        totalSize += stat.size;
      } catch {
        console.error(`    ✗ 文件不存在: ${filePath}`);
        console.error(`\n请先运行: npm run prepare:ffmpeg`);
        process.exit(1);
      }
    }
  }

  console.log(`\n  📊 总计: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);
}

/**
 * 检查 wrangler 是否安装
 */
function checkWrangler() {
  try {
    execSync("wrangler --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 上传文件到 R2
 */
async function uploadToR2(asset, filename) {
  const localPath = path.join(asset.dir, filename);
  const r2Path = `${asset.r2Path}${filename}`;

  console.log(`  📤 上传 ${filename} → r2://${BUCKET_NAME}/${r2Path}`);

  try {
    const cmd = [
      "wrangler",
      "r2",
      "object",
      "put",
      `${BUCKET_NAME}/${r2Path}`,
      "--file",
      localPath,
    ];

    execSync(cmd.join(" "), {
      stdio: "pipe",
      cwd: ROOT,
    });

    const stat = await fs.stat(localPath);
    console.log(`  ✓ ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB) 上传成功`);
    return true;
  } catch (error) {
    console.error(`  ✗ ${filename} 上传失败:`);
    console.error(`    ${error.message || error}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("🚀 开始上传大文件到 Cloudflare R2\n");

  // 检查 wrangler
  if (!checkWrangler()) {
    console.error("❌ 未找到 wrangler CLI");
    console.error("\n请安装: npm install -g wrangler");
    process.exit(1);
  }

  // 检查文件
  await checkFiles();

  // 上传文件
  console.log("📦 上传文件到 R2:");
  let totalFiles = 0;
  let successCount = 0;

  for (const asset of ASSETS) {
    console.log(`\n  ${asset.name}:`);
    for (const file of asset.files) {
      totalFiles++;
      if (await uploadToR2(asset, file)) {
        successCount++;
      }
    }
  }

  // 总结
  console.log("\n" + "=".repeat(60));
  if (successCount === totalFiles) {
    console.log("✅ 所有文件上传成功！");
    console.log("\n📝 下一步:");
    console.log("  1. 确保 R2 bucket 已配置公共访问");
    console.log("  2. 设置环境变量 NEXT_PUBLIC_R2_ASSETS_URL");
    console.log("     例如: https://assets.atools.com");
    console.log("  3. 运行: npm run build");
  } else {
    console.error(`❌ 部分文件上传失败 (${successCount}/${totalFiles})`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ 上传失败:", error);
  process.exit(1);
});
