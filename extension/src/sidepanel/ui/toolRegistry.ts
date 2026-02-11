import React from "react";

export type ToolDefinition = {
  id: string;
  path: `/${string}`;
  title: string;
  description: string;
  Component: React.LazyExoticComponent<React.ComponentType>;
};

export const tools: ToolDefinition[] = [
  {
    id: "site-tools",
    path: "/site-tools",
    title: "工具站工具搜索",
    description: "搜索并在新标签页打开工具站页面",
    Component: React.lazy(() => import("./tools/SiteToolsTool")),
  },
  {
    id: "longshot",
    path: "/longshot",
    title: "长截图（当前标签页）",
    description: "滚动截取并自动拼接为 PNG",
    Component: React.lazy(() => import("./tools/LongshotTool")),
  },
];

