export interface ToolConfig {
  name: string;
  shortName?: string;
  description: string;
  seoDescription?: string;
  lang?: string;
  themeColor?: string;
  backgroundColor?: string;
  icon?: string;
  startUrl?: string;
  scope?: string;
  category?: string;
  keywords?: string[];
  pageFeatures?: {
    floatingUploadAction?: boolean;
    globalDropZone?: boolean;
  };
  ui?: Record<string, unknown>;
}
