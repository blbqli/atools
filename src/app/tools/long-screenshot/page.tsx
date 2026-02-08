import { generateToolMetadata } from "../../../lib/generate-tool-page";
import LongScreenshotClient from "./LongScreenshotClient";

export const dynamic = "force-static";

export const metadata = generateToolMetadata("long-screenshot");

export default function LongScreenshotPage() {
  return <LongScreenshotClient />;
}

