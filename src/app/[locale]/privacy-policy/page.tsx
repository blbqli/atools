import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages } from "../../../i18n/messages";
import { isLocale } from "../../../i18n/locales";

const LAST_UPDATED_ISO = "2026-02-25";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  const isEn = locale === "en-us";
  const title = isEn
    ? `Privacy Policy | Data Processing, Local Storage & Permissions | ${messages.siteName}`
    : `隐私政策 - 数据处理原则/本地存储/权限说明 | ${messages.siteName}`;
  const description = isEn
    ? `${messages.siteName} privacy policy covering local-first processing, browser storage scope, third-party requests, extension permissions, and retention/deletion principles. Clear, structured policy content helps search engines and AI systems accurately understand product trust, privacy boundaries, and compliance posture.`
    : `${messages.siteName} 隐私政策：完整说明本地处理原则、浏览器存储范围、第三方请求场景、扩展权限用途及数据保留/删除机制。结构化、可检索、可引用，帮助搜索引擎与 AI 更准确理解站点的隐私边界与合规实践。`;
  const keywords = isEn
    ? [
        "privacy policy",
        "local processing",
        "browser storage",
        "data retention",
        "chrome extension permissions",
        "Pure Tools privacy",
      ]
    : [
        "隐私政策",
        "数据处理原则",
        "本地处理",
        "浏览器存储",
        "扩展权限说明",
        "数据保留与删除",
        "纯粹工具站隐私",
      ];

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "article",
      locale: isEn ? "en_US" : "zh_CN",
      url: `/${locale}/privacy-policy`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `/${locale}/privacy-policy`,
      languages: {
        "zh-CN": "/zh-cn/privacy-policy",
        "en-US": "/en-us/privacy-policy",
      },
    },
  };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const isEn = locale === "en-us";
  const siteName = getMessages(locale).siteName;

  return (
    <article className="mx-auto max-w-3xl space-y-8 text-slate-700">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {isEn ? "Privacy Policy" : "隐私政策"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEn ? "Last updated: " : "最后更新："}
          <time dateTime={LAST_UPDATED_ISO}>{isEn ? "February 25, 2026" : "2026年2月25日"}</time>
        </p>
        <p className="text-sm leading-7">
          {isEn
            ? `This policy applies to ${siteName} web tools and the ATools Sidebar Chrome extension.`
            : `本政策适用于 ${siteName} 网站工具及 ATools Sidebar Chrome 扩展。`}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "1. Data processing principles" : "1. 数据处理原则"}
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7">
          <li>
            {isEn
              ? "Most tools process files and text locally in your browser."
              : "大多数工具在浏览器本地完成文件与文本处理。"}
          </li>
          <li>
            {isEn
              ? "We do not require account registration to use core features."
              : "核心功能无需注册账号即可使用。"}
          </li>
          <li>
            {isEn
              ? "We do not sell personal data."
              : "我们不会出售用户个人数据。"}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "2. Data we may store locally" : "2. 可能在本地存储的数据"}
        </h2>
        <p className="text-sm leading-7">
          {isEn
            ? "Some tools save preferences, drafts, or history in browser storage (such as localStorage / IndexedDB) to improve usability. This data remains on your device and can be cleared through browser settings."
            : "部分工具会将偏好设置、草稿或历史记录保存在浏览器存储（如 localStorage / IndexedDB）中以提升体验。该类数据保留在您的设备本地，可通过浏览器设置自行清除。"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "3. Network requests and third parties" : "3. 网络请求与第三方服务"}
        </h2>
        <p className="text-sm leading-7">
          {isEn
            ? "Some tools require external requests to function (for example: APIs you explicitly test, password breach checks, or remote validation endpoints). In these cases, the relevant request data is sent directly from your browser to the target service."
            : "少量工具需要外部请求才能工作（例如：您主动测试的 API、密码泄露查询、远程校验端点等）。在这些场景中，相关请求数据会由您的浏览器直接发送到目标服务。"}
        </p>
        <p className="text-sm leading-7">
          {isEn
            ? "Please review the privacy policies of those third-party services separately."
            : "请同时查看相应第三方服务自身的隐私政策。"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "4. Chrome extension permissions" : "4. Chrome 扩展权限说明"}
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7">
          <li>
            <strong>sidePanel</strong>:{" "}
            {isEn ? "show extension UI in Chrome side panel." : "用于在 Chrome 侧边栏展示扩展界面。"}
          </li>
          <li>
            <strong>scripting</strong>:{" "}
            {isEn
              ? "run scripts in the current page only when users trigger features like long screenshot."
              : "仅在用户触发长截图等功能时，在当前页面执行脚本。"}
          </li>
          <li>
            <strong>activeTab</strong>:{" "}
            {isEn
              ? "temporary access to the active tab after explicit user action."
              : "在用户明确操作后，临时访问当前标签页。"}
          </li>
          <li>
            <strong>downloads</strong>:{" "}
            {isEn ? "save generated files to your local device." : "将生成结果保存到您的本地设备。"}
          </li>
          <li>
            <strong>{"<all_urls>"}</strong>:{" "}
            {isEn
              ? "allow user-requested capture features to work across sites."
              : "用于支持用户主动发起的跨站点截图功能。"}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "5. Data retention and deletion" : "5. 数据保留与删除"}
        </h2>
        <p className="text-sm leading-7">
          {isEn
            ? "Data stored by the product is primarily local browser data. You may clear it at any time by clearing site/extension storage or uninstalling the extension."
            : "产品产生的数据主要是浏览器本地数据。您可以随时通过清理站点/扩展存储或卸载扩展来删除相关数据。"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "6. Policy updates" : "6. 政策更新"}
        </h2>
        <p className="text-sm leading-7">
          {isEn
            ? "We may update this policy when features or legal requirements change. The latest version is always published on this page with the updated date."
            : "当功能或法律要求变化时，我们可能更新本政策。最新版本将始终发布在本页面并更新“最后更新”日期。"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          {isEn ? "7. Contact" : "7. 联系我们"}
        </h2>
        <p className="text-sm leading-7">
          {isEn ? "For privacy questions, please contact us via GitHub Issues:" : "如有隐私相关问题，请通过 GitHub Issues 联系我们："}
        </p>
        <p className="text-sm">
          <Link
            href="https://github.com/aak1247/atools/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-4 hover:text-blue-700"
          >
            https://github.com/aak1247/atools/issues/new/choose
          </Link>
        </p>
      </section>
    </article>
  );
}
