import SiteShell from "../../components/SiteShell";
import { I18nProvider } from "../../i18n/I18nProvider";
import LocaleHtmlLang from "../../i18n/LocaleHtmlLang";
import { getMessages } from "../../i18n/messages";
import type { Locale } from "../../i18n/locales";

const locale: Locale = "zh-cn";
const messages = getMessages(locale);

export default function ToolsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <SiteShell locale={locale} messages={messages}>
        {children}
      </SiteShell>
    </I18nProvider>
  );
}
