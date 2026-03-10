import { notFound } from "next/navigation";
import SiteShell from "../../components/SiteShell";
import { I18nProvider } from "../../i18n/I18nProvider";
import LocaleHtmlLang from "../../i18n/LocaleHtmlLang";
import { getMessages } from "../../i18n/messages";
import { isLocale, SUPPORTED_LOCALES } from "../../i18n/locales";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <SiteShell locale={locale} messages={messages}>
        {children}
      </SiteShell>
    </I18nProvider>
  );
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}
