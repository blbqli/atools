import { generateToolMetadata } from "../../../lib/generate-tool-page";
import DocumentMetadataEditorClient from "./DocumentMetadataEditorClient";

export const dynamic = "force-static";

export const metadata = generateToolMetadata("document-metadata-editor");

export default function DocumentMetadataEditorPage() {
  return <DocumentMetadataEditorClient />;
}

