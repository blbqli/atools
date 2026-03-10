import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TOOLS_DIR = path.join(ROOT_DIR, "src", "app", "tools");

const REQUIRED_TOOL_FIELDS = ["name", "description"];

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const readFileIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
};

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const listToolSlugs = () => {
  if (!fs.existsSync(TOOLS_DIR)) return [];
  const entries = fs.readdirSync(TOOLS_DIR, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(TOOLS_DIR, slug, "tool.json")));

  return slugs.sort((a, b) => a.localeCompare(b, "en"));
};

const checkToolConfig = (slug) => {
  const errors = [];
  const warnings = [];

  const toolDir = path.join(TOOLS_DIR, slug);
  const baseConfigPath = path.join(toolDir, "tool.json");

  if (!fs.existsSync(baseConfigPath)) {
    errors.push("缺少 tool.json");
    return { errors, warnings };
  }

  let baseConfig;

  try {
    baseConfig = readJson(baseConfigPath);
  } catch (error) {
    errors.push(`tool.json 解析失败: ${(error && error.message) || String(error)}`);
    return { errors, warnings };
  }

  for (const fieldName of REQUIRED_TOOL_FIELDS) {
    if (!isNonEmptyString(baseConfig[fieldName])) {
      errors.push(`tool.json 缺少必填字段或字段为空: ${fieldName}`);
    }
  }

  if (baseConfig.keywords && !Array.isArray(baseConfig.keywords)) {
    warnings.push("tool.json 中 keywords 不是数组，将在生成脚本中被忽略");
  }

  const enConfigPath = path.join(toolDir, "tool.en-us.json");
  if (fs.existsSync(enConfigPath)) {
    try {
      const enConfig = readJson(enConfigPath);
      for (const fieldName of REQUIRED_TOOL_FIELDS) {
        if (!isNonEmptyString(enConfig[fieldName])) {
          warnings.push(
            `tool.en-us.json 中字段 ${fieldName} 非必填但建议填写，当前为空或缺失`,
          );
        }
      }
      if (enConfig.lang && enConfig.lang !== "en-US") {
        warnings.push(
          `tool.en-us.json 中 lang 建议为 \"en-US\"，当前为: ${String(
            enConfig.lang,
          )}`,
        );
      }
    } catch (error) {
      errors.push(`tool.en-us.json 解析失败: ${(error && error.message) || String(error)}`);
    }
  } else {
    warnings.push("缺少 tool.en-us.json（英文配置未单独覆盖）");
  }

  const pagePath = path.join(toolDir, "page.tsx");
  if (!fs.existsSync(pagePath)) {
    errors.push("缺少 page.tsx 页面文件");
  } else {
    const pageContent = readFileIfExists(pagePath) ?? "";

    if (!pageContent.includes("export const dynamic = \"force-static\"")) {
      warnings.push("page.tsx 中未声明 export const dynamic = \"force-static\";");
    }

    if (!pageContent.includes(`generateToolMetadata("${slug}")`)) {
      warnings.push(
        "page.tsx 中 generateToolMetadata 调用未使用当前工具 slug，SEO 元数据可能不正确",
      );
    }

    const clientImportMatch = pageContent.match(
      /import\s+([A-Za-z0-9_]+)\s+from\s+["']\.\/(.+)["'];/,
    );

    if (!clientImportMatch) {
      warnings.push("page.tsx 未找到默认客户端组件的 import 语句");
    } else {
      const importedName = clientImportMatch[1];
      const importedPath = clientImportMatch[2];

      const hasExtension = /\.tsx?$/.test(importedPath);
      const clientFilePath = path.join(
        toolDir,
        hasExtension ? importedPath : `${importedPath}.tsx`,
      );

      if (!fs.existsSync(clientFilePath)) {
        warnings.push(
          `page.tsx 中引用的客户端组件文件不存在: ${importedName} from ./` +
            importedPath,
        );
      }
    }
  }

  return { errors, warnings };
};

const main = () => {
  if (!fs.existsSync(TOOLS_DIR)) {
    console.error(`[check-tools] 未找到工具目录: ${TOOLS_DIR}`);
    process.exit(1);
  }

  const slugs = listToolSlugs();
  if (slugs.length === 0) {
    console.log("[check-tools] 未检测到任何工具目录，已跳过检查。");
    return;
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const slug of slugs) {
    const { errors, warnings } = checkToolConfig(slug);
    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0 && warnings.length === 0) continue;

    console.log(`\n=== 工具: ${slug} ===`);
    for (const message of errors) {
      console.log(`ERROR: ${message}`);
    }
    for (const message of warnings) {
      console.log(`WARN: ${message}`);
    }
  }

  console.log("\n[check-tools] 检查完成。");
  console.log(`工具数量: ${slugs.length}`);
  console.log(`错误总数: ${totalErrors}`);
  console.log(`警告总数: ${totalWarnings}`);

  if (totalErrors > 0) {
    process.exitCode = 1;
  }
};

main();

