export type MindMapLayoutMode =
  | "balanced"
  | "right"
  | "left"
  | "up"
  | "down"
  | "downCompact"
  | "downCompact2"
  | "superCompactDown"
  | "superCompactRight"
  | "superCompactDownVertical";

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

export type MindMapRelationship = {
  id: string;
  fromId: string;
  toId: string;
  title?: string;
};

export type MindMapBoundary = {
  id: string;
  nodeId: string;
  title?: string;
};

export type MindMapSummary = {
  id: string;
  nodeId: string;
  title?: string;
};

export type MindMapSheet = {
  id: string;
  title: string;
  rootTopic: MindMapNode | null;
  layoutMode: MindMapLayoutMode;
  themeId: MindMapThemeId;
  relationships?: MindMapRelationship[];
  boundaries?: MindMapBoundary[];
  summaries?: MindMapSummary[];
};
