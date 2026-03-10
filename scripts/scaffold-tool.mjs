import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT_DIR = process.cwd();
const TOOLS_DIR = path.join(ROOT_DIR, "src", "app", "tools");

const toPascalCase = (slug) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const toEnglishNameFromSlug = (slug) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const validateSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const rl = readline.createInterface({ input, output });

const ask = async (question, defaultValue = "") => {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue || "";
};

const fileExists = (filePath) => fs.existsSync(filePath);

const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${content}\n`, "utf8");
};

const main = async () => {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  let slug = args[0] ?? "";

  if (!slug) {
    slug = await ask("工具 slug（kebab-case，如 text-to-speech）");
  }

  if (!validateSlug(slug)) {
    console.error(
      "[scaffold-tool] 无效的 slug。仅支持小写字母、数字和中划线（例如: text-to-speech）",
    );
    process.exit(1);
  }

  const toolDir = path.join(TOOLS_DIR, slug);
  if (fileExists(toolDir) && fs.readdirSync(toolDir).length > 0) {
    console.error(`[scaffold-tool] 目标目录已存在且非空: ${toolDir}`);
    process.exit(1);
  }

  const defaultZhShortName = slug;
  const defaultEnShortName = toEnglishNameFromSlug(slug);

  const zhShortName = await ask("中文短名称（shortName）", defaultZhShortName);
  const enShortName = await ask("英文短名称（shortName）", defaultEnShortName);
  const category = await ask("工具分类（如 文本处理、数据处理工具）", "其他工具");

  const defaultZhFullName = `免费在线${zhShortName}工具 - 纯粹工具站`;
  const defaultEnFullName = `Free Online ${enShortName} - ATools`;

  const zhName = await ask("中文全名（用于 name）", defaultZhFullName);
  const enName = await ask("英文全名（用于 name）", defaultEnFullName);

  const zhDescription = await ask(
    "中文描述（简要说明工具功能）",
    "这是一款免费在线工具，所有处理均在浏览器本地完成。",
  );

  const enDescription = await ask(
    "英文描述（简要说明工具功能）",
    "Free online tool that runs entirely in your browser with zero uploads.",
  );

  const pascalName = toPascalCase(slug);
  const clientComponentName = `${pascalName}Client`;
  const pageComponentName = `${pascalName}Page`;

  fs.mkdirSync(toolDir, { recursive: true });

  const toolJsonPath = path.join(toolDir, "tool.json");
  const toolEnJsonPath = path.join(toolDir, "tool.en-us.json");
  const pagePath = path.join(toolDir, "page.tsx");
  const clientPath = path.join(toolDir, `${clientComponentName}.tsx`);

  const toolJson = {
    name: zhName,
    shortName: zhShortName,
    description: zhDescription,
    seoDescription: zhDescription,
    category,
    lang: "zh-CN",
    themeColor: "#0f172a",
    backgroundColor: "#0f172a",
    icon: "/icon.svg",
    keywords: [zhShortName, slug, "免费在线工具", "ATools", "纯粹工具站"],
  };

  const toolEnJson = {
    name: enName,
    shortName: enShortName,
    description: enDescription,
    seoDescription: enDescription,
    category: "Tools",
    lang: "en-US",
    keywords: [
      `free online ${enShortName}`,
      enShortName,
      slug,
      "ATools",
      "Pure Tools",
    ],
    ui: {
      title: enShortName,
      inputLabel: "Input",
      outputLabel: "Output",
      processButton: "Process",
      clearButton: "Clear",
      inputPlaceholder: "Enter your input here...",
      outputPlaceholder: "Results will appear here...",
      errorMessage: "Error: {message}",
      successMessage: "Processing completed successfully!",
    },
  };

  const pageTsx = `import { generateToolMetadata } from "../../../lib/generate-tool-page";
import ${clientComponentName} from "./${clientComponentName}";

export const dynamic = "force-static";
export const metadata = generateToolMetadata("${slug}");

export default function ${pageComponentName}() {
  return <${clientComponentName} />;
}
`;

  const clientTsx = `"use client";

import ToolPageLayout from "../../../components/ToolPageLayout";
import { useOptionalToolConfig } from "../../../components/ToolConfigProvider";

const DEFAULT_UI = {
  title: "我的工具",
  inputLabel: "输入",
  outputLabel: "输出",
  processButton: "处理",
  clearButton: "清空",
  inputPlaceholder: "请输入内容...",
  outputPlaceholder: "处理结果会显示在这里...",
  errorMessage: "错误：{message}",
  successMessage: "处理完成！",
} as const;

type ${pascalName}Ui = typeof DEFAULT_UI;

export default function ${clientComponentName}() {
  const config = useOptionalToolConfig("${slug}");
  const ui: ${pascalName}Ui = {
    ...DEFAULT_UI,
    ...((config?.ui ?? {}) as Partial<${pascalName}Ui>),
  };

  return (
    <ToolPageLayout toolSlug="${slug}">
      <div className="glass-card mt-8 rounded-3xl p-6 shadow-2xl ring-1 ring-black/5">
        <div className="text-sm font-semibold text-slate-900">{ui.title}</div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {ui.inputLabel}
            </label>
            <textarea
              placeholder={ui.inputPlaceholder}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
            />
          </div>

          <div className="flex gap-2">
            <button className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
              {ui.processButton}
            </button>
            <button className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-200">
              {ui.clearButton}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {ui.outputLabel}
            </label>
            <textarea
              readOnly
              placeholder={ui.outputPlaceholder}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            />
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
`;

  writeFile(toolJsonPath, JSON.stringify(toolJson, null, 2));
  writeFile(toolEnJsonPath, JSON.stringify(toolEnJson, null, 2));
  writeFile(pagePath, pageTsx);
  writeFile(clientPath, clientTsx);

  await rl.close();

  console.log("[scaffold-tool] 已创建新工具骨架:");
  console.log(`  - ${path.relative(ROOT_DIR, toolJsonPath)}`);
  console.log(`  - ${path.relative(ROOT_DIR, toolEnJsonPath)}`);
  console.log(`  - ${path.relative(ROOT_DIR, pagePath)}`);
  console.log(`  - ${path.relative(ROOT_DIR, clientPath)}`);
  console.log("记得补充更完整的 SEO 文案与具体功能实现。");
};

main().catch((error) => {
  console.error("[scaffold-tool] 执行失败:", error);
  process.exit(1);
});

