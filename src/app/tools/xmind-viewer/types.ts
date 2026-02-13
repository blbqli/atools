export type MindMapLayoutMode = "balanced" | "right" | "left" | "up" | "down" | "downCompact" | "downCompact2";

export type MindMapThemeId = "classicLight" | "classicDark" | "ocean" | "forest" | "sunset" | "mono";

export type MindMapTheme = {
  id: MindMapThemeId;
  name: string;
  canvasBackground: string;
  linkStroke: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  rootFill: string;
  rootStroke: string;
  rootText: string;
  selectedFill: string;
  selectedStroke: string;
  hoverStroke: string;
  toggleFill: string;
  toggleStroke: string;
  toggleText: string;
  accent: string;
};

export type MindMapNode = {
  id: string;
  title: string;
  labels?: string[];
  notes?: { plain?: { content?: string } };
  children: MindMapNode[];
  collapsed?: boolean;
};

export type MindMapSheet = {
  id: string;
  title: string;
  rootTopic: MindMapNode | null;
  layoutMode: MindMapLayoutMode;
  themeId: MindMapThemeId;
};
