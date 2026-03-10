import { generateToolMetadata } from "../../../lib/generate-tool-page";
import ToolPageLayout from "../../../components/ToolPageLayout";
import { ToolConfigProvider } from "../../../components/ToolConfigProvider";
import { DEFAULT_LOCALE } from "../../../i18n/locales";
import { getToolConfig } from "../../../lib/tool-config";
import XmindViewerClient from "./XmindViewerClient";

export const dynamic = "force-static";

export const metadata = generateToolMetadata("xmind-viewer");
const defaultConfig = getToolConfig("xmind-viewer", DEFAULT_LOCALE);

export default function XmindViewerPage() {
  return (
    <ToolConfigProvider toolSlug="xmind-viewer" locale={DEFAULT_LOCALE} config={defaultConfig}>
      <ToolPageLayout toolSlug="xmind-viewer" maxWidthClassName="max-w-7xl">
        <XmindViewerClient />
      </ToolPageLayout>
    </ToolConfigProvider>
  );
}
