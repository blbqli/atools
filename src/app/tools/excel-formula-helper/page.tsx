import { generateToolMetadata } from "../../../lib/generate-tool-page";
import ExcelFormulaHelperClient from "./ExcelFormulaHelperClient";

export const dynamic = "force-static";
export const metadata = generateToolMetadata("excel-formula-helper");

export default function ExcelFormulaHelperPage() {
  return <ExcelFormulaHelperClient />;
}
