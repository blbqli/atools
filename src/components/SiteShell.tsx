import Image from "next/image";
import Link from "next/link";
import type { Locale } from "../i18n/locales";
import type { Messages } from "../i18n/messages";
import LocaleSwitcher from "./LocaleSwitcher";
import { PwaActionsBar } from "../app/pwa-actions";
import ClarityConsentManager from "./ClarityConsentManager";

export default function SiteShell({
  locale,
  messages,
  children,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}>) {
  const clarityEnabled = Boolean(String(process.env.NEXT_PUBLIC_CLARITY_ID || "").trim());

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full glass border-b border-white/20 transition-all duration-300">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 transition-opacity hover:opacity-80"
          >
            <Image
              src="/icon.svg"
              alt={messages.siteName}
              width={24}
              height={24}
              className="rounded-lg shadow-sm"
            />
            <span>{messages.siteName}</span>
          </Link>

          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link href={`/${locale}`} className="transition-colors hover:text-slate-900">
              {messages.navTools}
            </Link>
            <a href="/sitemap.xml" className="transition-colors hover:text-slate-900">
              {messages.navSitemap}
            </a>
            <a
              href="https://github.com/aak1247/atools"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-900"
            >
              {messages.navGithub}
            </a>
            <a
              href="https://github.com/aak1247/atools/issues/new?template=bug_report.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-900"
            >
              {messages.navReportIssue}
            </a>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <PwaActionsBar />
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200/60 bg-white/50 py-8 text-center text-xs text-slate-500 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4">
          <p>
            © {new Date().getFullYear()} {messages.siteName}. {messages.footerTagline}
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <Link href={`/${locale}/privacy-policy`} className="transition-colors hover:text-slate-700">
              {messages.navPrivacy}
            </Link>
            {clarityEnabled ? (
              <>
                <span aria-hidden="true">·</span>
                <ClarityConsentManager locale={locale} messages={messages} />
              </>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
