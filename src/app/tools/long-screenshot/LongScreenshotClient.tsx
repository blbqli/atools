"use client";

import ToolPageLayout from "../../../components/ToolPageLayout";
import { useOptionalToolConfig } from "../../../components/ToolConfigProvider";

const DEFAULT_UI = {
  whyTitle: "为什么需要扩展？",
  whyBody:
    "浏览器出于同源与安全限制，普通网页无法读取/渲染任意外站的完整 DOM，因此“输入 URL 截外部网页”很难用纯前端 Web 稳定实现。Chrome 扩展可以在当前标签页执行滚动分段截图并拼接导出。",
  howTitle: "如何使用",
  howSteps: [
    "安装 ATools Chrome 扩展（未发布到商店时，可从仓库加载已解压扩展）。",
    "在需要截图的网页打开 ATools 侧边栏。",
    "在「长截图（当前标签页）」里点击开始，等待导出 PNG。",
  ],
  tipTitle: "小提示",
  tipBody:
    "部分网站有懒加载或固定导航栏，可能影响拼接效果；可适当增加“滚动等待”时间，或先手动滚动一遍让内容加载完成。",
} as const;

type Ui = typeof DEFAULT_UI;

export default function LongScreenshotClient() {
  const config = useOptionalToolConfig("long-screenshot");
  const ui: Ui = { ...DEFAULT_UI, ...((config?.ui ?? {}) as Partial<Ui>) };

  return (
    <ToolPageLayout toolSlug="long-screenshot" maxWidthClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{ui.whyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{ui.whyBody}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{ui.howTitle}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {ui.howSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
            <div className="font-medium text-slate-700">开发者安装（加载已解压扩展）</div>
            <div className="mt-1">
              在仓库 `site/extension` 目录作为扩展根目录，打开 `chrome://extensions` → 开启开发者模式 →
              「加载已解压的扩展程序」→ 选择 `site/extension`。
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{ui.tipTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{ui.tipBody}</p>
        </div>
      </div>
    </ToolPageLayout>
  );
}

