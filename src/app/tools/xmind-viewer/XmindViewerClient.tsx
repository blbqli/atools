"use client";

import type { ChangeEvent } from "react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import XmindMindMapCanvas from "./XmindMindMapCanvas";
import type { ViewStateBundle, XmindMindMapCanvasHandle } from "./XmindMindMapCanvas";
import { getTheme, themes } from "./themes";
import type { MindMapLayoutMode, MindMapNode, MindMapSheet, MindMapThemeId } from "./types";

type TopicNode = {
  title?: string;
  labels?: string[];
  notes?: { plain?: { content?: string } };
  collapsed?: boolean;
  children?: {
    attached?: TopicNode[];
    detached?: TopicNode[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type Sheet = {
  title?: string;
  rootTopic?: TopicNode;
  structureClass?: string;
  [key: string]: unknown;
};

type ParsedXmind = {
  entries: string[];
  sheets: Sheet[];
  source: string | null;
  parseError: string | null;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
};

const sanitizeFilename = (name: string) =>
  name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

type NodeContext = {
  node: MindMapNode;
  parent: MindMapNode | null;
  index: number;
};

const createNodeWithTitle = (id: string, title = "新节点"): MindMapNode => ({
  id,
  title,
  children: [],
  collapsed: false,
});

const findNodeContext = (
  node: MindMapNode,
  targetId: string,
  parent: MindMapNode | null = null,
  index = -1,
): NodeContext | null => {
  if (node.id === targetId) return { node, parent, index };
  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    const child = node.children[childIndex]!;
    const nested = findNodeContext(child, targetId, node, childIndex);
    if (nested) return nested;
  }
  return null;
};

const mapNodeById = (
  node: MindMapNode,
  targetId: string,
  updater: (input: MindMapNode) => MindMapNode,
): [MindMapNode, boolean] => {
  let changed = false;
  let nextNode = node;

  if (node.id === targetId) {
    nextNode = updater(node);
    changed = true;
  }

  let childChanged = false;
  const nextChildren = nextNode.children.map((child) => {
    const [mapped, didChange] = mapNodeById(child, targetId, updater);
    if (didChange) childChanged = true;
    return mapped;
  });

  if (childChanged) {
    nextNode = { ...nextNode, children: nextChildren };
    changed = true;
  }

  return [changed ? nextNode : node, changed];
};

const removeNodeById = (
  node: MindMapNode,
  targetId: string,
): { node: MindMapNode; removed: boolean; parentId: string | null } => {
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]!;
    if (child.id === targetId) {
      const nextChildren = [...node.children.slice(0, index), ...node.children.slice(index + 1)];
      return { node: { ...node, children: nextChildren }, removed: true, parentId: node.id };
    }

    const nested = removeNodeById(child, targetId);
    if (nested.removed) {
      const nextChildren = node.children.map((item) => (item.id === child.id ? nested.node : item));
      return { node: { ...node, children: nextChildren }, removed: true, parentId: nested.parentId };
    }
  }

  return { node, removed: false, parentId: null };
};

const detachNodeById = (
  node: MindMapNode,
  targetId: string,
): { node: MindMapNode; detached: MindMapNode | null; parentId: string | null } => {
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]!;
    if (child.id === targetId) {
      const nextChildren = [...node.children.slice(0, index), ...node.children.slice(index + 1)];
      return { node: { ...node, children: nextChildren }, detached: child, parentId: node.id };
    }

    const nested = detachNodeById(child, targetId);
    if (nested.detached) {
      const nextChildren = node.children.map((item) => (item.id === child.id ? nested.node : item));
      return { node: { ...node, children: nextChildren }, detached: nested.detached, parentId: nested.parentId };
    }
  }

  return { node, detached: null, parentId: null };
};

const structureClassToLayoutMode = (structureClass: unknown): MindMapLayoutMode => {
  if (typeof structureClass !== "string") return "balanced";
  const normalized = structureClass.toLowerCase();
  if (normalized.includes("compact2")) return "downCompact2";
  if (normalized.includes("compact")) return "downCompact";
  if (normalized.includes("up")) return "up";
  if (normalized.includes("down")) return "down";
  if (normalized.includes("org-chart.up")) return "up";
  if (normalized.includes("org-chart.down")) return "down";
  if (normalized.includes("tree")) return "down";
  if (normalized.includes("org")) return "down";
  if (normalized.includes("left")) return "left";
  if (normalized.includes("right")) return "right";
  if (normalized.includes("map")) return "balanced";
  return "balanced";
};

type EditorSnapshot = {
  sheets: MindMapSheet[];
  activeSheetId: string | null;
  selectedNodeId: string | null;
};

type DraftPayload = {
  version: 1;
  savedAt: number;
  editor: EditorSnapshot;
};

const DRAFT_STORAGE_KEY = "atools:xmind-viewer:draft:v1";

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
};

const normalizeEditorSheets = (sheets: MindMapSheet[]): MindMapSheet[] =>
  sheets.map((sheet) => ({
    ...sheet,
    themeId: (sheet as Partial<MindMapSheet>).themeId ?? "classicLight",
  }));

const getDraftFromStorage = (): DraftPayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Partial<DraftPayload>;
    if (record.version !== 1 || !record.editor) return null;
    return record as DraftPayload;
  } catch {
    return null;
  }
};

const saveDraftToStorage = (payload: DraftPayload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
};

const clearDraftStorage = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    const normalized = raw.replace(/^\uFEFF/, "");
    return JSON.parse(normalized) as unknown;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

const asSheets = (value: unknown): Sheet[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as Sheet[];
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.sheets)) return record.sheets as Sheet[];
    if (record.rootTopic && typeof record.rootTopic === "object") return [value as Sheet];
  }
  return [];
};

const looksLikeTopicRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  if (typeof value.title === "string") return true;
  if (typeof value.text === "string") return true;
  if (typeof value.name === "string") return true;
  return false;
};

const looksLikeSheetRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  if (value.class === "sheet") return true;
  if ("rootTopic" in value) return true;
  if ("rootTopicId" in value) return true;
  if ("topic" in value) return true;
  if ("topicId" in value) return true;
  return false;
};

const extractSheetsFromUnknown = (value: unknown, maxDepth = 6): Sheet[] => {
  if (!value || maxDepth <= 0) return [];
  if (Array.isArray(value)) {
    const sheets = value.filter(looksLikeSheetRecord) as Sheet[];
    if (sheets.length > 0) return sheets;
    for (const item of value) {
      const nested = extractSheetsFromUnknown(item, maxDepth - 1);
      if (nested.length > 0) return nested;
    }
    return [];
  }

  if (!isRecord(value)) return [];

  const directKeys = ["sheets", "sheet", "content", "data", "workbook"];
  for (const key of directKeys) {
    const nested = extractSheetsFromUnknown(value[key], maxDepth - 1);
    if (nested.length > 0) return nested;
  }

  if (looksLikeSheetRecord(value)) return [value as Sheet];

  for (const nestedValue of Object.values(value)) {
    const nested = extractSheetsFromUnknown(nestedValue, maxDepth - 1);
    if (nested.length > 0) return nested;
  }

  return [];
};

const buildTopicsById = (value: unknown, maxDepth = 6): Record<string, unknown> => {
  if (!value || maxDepth <= 0) return {};

  if (Array.isArray(value)) {
    const topicMap: Record<string, unknown> = {};
    for (const item of value) {
      if (!isRecord(item)) continue;
      const idValue = item.id;
      if (typeof idValue !== "string" && typeof idValue !== "number") continue;
      if (!looksLikeTopicRecord(item)) continue;
      topicMap[String(idValue)] = item;
    }
    if (Object.keys(topicMap).length > 0) return topicMap;

    for (const item of value) {
      const nested = buildTopicsById(item, maxDepth - 1);
      if (Object.keys(nested).length > 0) return nested;
    }
    return {};
  }

  if (!isRecord(value)) return {};

  const candidates: unknown[] = [];
  if (isRecord(value.topics) || Array.isArray(value.topics)) candidates.push(value.topics);
  if (isRecord(value.topic) || Array.isArray(value.topic)) candidates.push(value.topic);
  if (isRecord(value.resources)) candidates.push(value.resources);

  for (const candidate of candidates) {
    const nested = buildTopicsById(candidate, maxDepth - 1);
    if (Object.keys(nested).length > 0) return nested;

    if (!isRecord(candidate)) continue;
    const entries = Object.entries(candidate);
    if (entries.length === 0) continue;
    const sample = entries.slice(0, 5).map(([, v]) => v);
    if (sample.some(looksLikeTopicRecord)) return candidate;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = buildTopicsById(nestedValue, maxDepth - 1);
    if (Object.keys(nested).length > 0) return nested;
  }

  return {};
};

const resolveTopicValue = (value: unknown, topicsById: Record<string, unknown>): unknown => {
  if (looksLikeTopicRecord(value)) return value;

  if (isRecord(value)) {
    const refId =
      typeof value.id === "string" || typeof value.id === "number"
        ? String(value.id)
        : typeof value.topicId === "string" || typeof value.topicId === "number"
          ? String(value.topicId)
          : null;
    if (refId && topicsById[refId] && isRecord(topicsById[refId])) {
      return { ...(topicsById[refId] as Record<string, unknown>), ...value };
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const resolved = topicsById[String(value)];
    return resolved ?? null;
  }

  return value;
};

const normalizeLabels = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const labels = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
    return labels.length > 0 ? labels : undefined;
  }
  if (typeof value === "string") {
    const labels = value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    return labels.length > 0 ? labels : undefined;
  }
  return undefined;
};

const normalizeNoteContent = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (!isRecord(value)) return undefined;
  const plain = value.plain;
  if (typeof plain === "string") return plain.trim() || undefined;
  if (isRecord(plain) && typeof plain.content === "string") return plain.content.trim() || undefined;
  if (typeof value.content === "string") return value.content.trim() || undefined;
  return undefined;
};

const extractChildGroup = (value: unknown, topicsById: Record<string, unknown>): { type: "attached" | "detached"; items: unknown[] }[] => {
  const resolved = resolveTopicValue(value, topicsById);
  if (Array.isArray(resolved)) return [{ type: "attached", items: resolved }];
  if (!isRecord(resolved)) return [];

  const typeRaw = typeof resolved.type === "string" ? resolved.type.toLowerCase() : "";
  const type: "attached" | "detached" = typeRaw.includes("detached") ? "detached" : "attached";

  if (Array.isArray(resolved.topics)) return [{ type, items: resolved.topics }];
  if (Array.isArray(resolved.topic)) return [{ type, items: resolved.topic }];
  if (Array.isArray(resolved.attached)) return [{ type: "attached", items: resolved.attached }];
  if (Array.isArray(resolved.detached)) return [{ type: "detached", items: resolved.detached }];
  return [];
};

const toTopicNode = (rawTopic: unknown, topicsById: Record<string, unknown>, seen: Set<string>): TopicNode => {
  const resolved = resolveTopicValue(rawTopic, topicsById);
  const topicRecord = isRecord(resolved) ? resolved : {};

  const rawId = typeof topicRecord.id === "string" || typeof topicRecord.id === "number" ? String(topicRecord.id) : null;
  if (rawId) {
    if (seen.has(rawId)) {
      return { title: (String(topicRecord.title ?? topicRecord.text ?? topicRecord.name ?? "")).trim() || "(无标题)" };
    }
    seen.add(rawId);
  }

  const titleRaw =
    typeof topicRecord.title === "string"
      ? topicRecord.title
      : typeof topicRecord.text === "string"
        ? topicRecord.text
        : typeof topicRecord.name === "string"
          ? topicRecord.name
          : "";

  const labels = normalizeLabels(topicRecord.labels);
  const noteContent = normalizeNoteContent(topicRecord.notes ?? topicRecord.note);
  const collapsed = Boolean(
    topicRecord.collapsed ?? topicRecord.folded ?? topicRecord.isFolded ?? (topicRecord.branch === "folded"),
  );

  const attached: TopicNode[] = [];
  const detached: TopicNode[] = [];

  const childrenValue = topicRecord.children;
  if (Array.isArray(childrenValue)) {
    for (const item of childrenValue) attached.push(toTopicNode(item, topicsById, seen));
  }
  if (isRecord(childrenValue)) {
    if (Array.isArray(childrenValue.attached)) {
      for (const item of childrenValue.attached) attached.push(toTopicNode(item, topicsById, seen));
    }
    if (Array.isArray(childrenValue.detached)) {
      for (const item of childrenValue.detached) detached.push(toTopicNode(item, topicsById, seen));
    }

    for (const [groupKey, groupValue] of Object.entries(childrenValue)) {
      if (groupKey === "attached" || groupKey === "detached") continue;
      const groups = extractChildGroup(groupValue, topicsById);
      for (const group of groups) {
        for (const item of group.items) {
          if (group.type === "detached") detached.push(toTopicNode(item, topicsById, seen));
          else attached.push(toTopicNode(item, topicsById, seen));
        }
      }
    }
  }

  if (Array.isArray(topicRecord.attached)) {
    for (const item of topicRecord.attached) attached.push(toTopicNode(item, topicsById, seen));
  }
  if (Array.isArray(topicRecord.detached)) {
    for (const item of topicRecord.detached) detached.push(toTopicNode(item, topicsById, seen));
  }

  const resultChildren: TopicNode["children"] = {};
  if (attached.length > 0) resultChildren.attached = attached;
  if (detached.length > 0) resultChildren.detached = detached;

  return {
    title: titleRaw.trim() || "(无标题)",
    labels,
    notes: noteContent ? { plain: { content: noteContent } } : undefined,
    collapsed,
    children: Object.keys(resultChildren).length > 0 ? resultChildren : undefined,
  };
};

const ATTOOLS_EXTENSION_PROVIDER = "atools.site";

const extractAtoolsExtensionData = (
  rawTopic: unknown,
  topicsById: Record<string, unknown>,
): { layoutMode?: MindMapLayoutMode; themeId?: MindMapThemeId } => {
  const resolved = resolveTopicValue(rawTopic, topicsById);
  if (!isRecord(resolved)) return {};
  const extensionsValue = resolved.extensions;
  if (!Array.isArray(extensionsValue)) return {};
  for (const extension of extensionsValue) {
    if (!isRecord(extension)) continue;
    if (extension.provider !== ATTOOLS_EXTENSION_PROVIDER) continue;
    const content = extension.content;
    if (typeof content === "string") {
      const parsed = safeJsonParse(content);
      if (!parsed || typeof parsed !== "object") continue;
      const record = parsed as Record<string, unknown>;
      const layoutMode = typeof record.layoutMode === "string" ? (record.layoutMode as MindMapLayoutMode) : undefined;
      const themeId = typeof record.themeId === "string" ? (record.themeId as MindMapThemeId) : undefined;
      return { layoutMode, themeId };
    }
    if (isRecord(content)) {
      const layoutMode = typeof content.layoutMode === "string" ? (content.layoutMode as MindMapLayoutMode) : undefined;
      const themeId = typeof content.themeId === "string" ? (content.themeId as MindMapThemeId) : undefined;
      return { layoutMode, themeId };
    }
  }
  return {};
};

const extractSheetTitle = (sheet: Sheet, index: number) => {
  if (typeof sheet.title === "string" && sheet.title.trim()) return sheet.title.trim();
  const record = sheet as Record<string, unknown>;
  if (typeof record.name === "string" && record.name.trim()) return record.name.trim();
  return `Sheet ${index + 1}`;
};

const extractRootTopicRef = (sheet: Sheet): unknown => {
  if (sheet.rootTopic != null) return sheet.rootTopic;
  const record = sheet as Record<string, unknown>;
  if (record.rootTopicId != null) return record.rootTopicId;
  if (record.topic != null) return record.topic;
  if (record.topicId != null) return record.topicId;
  return null;
};

const normalizeSheetsFromContentJson = (content: unknown, topicsById: Record<string, unknown>): Sheet[] => {
  const rawSheets = extractSheetsFromUnknown(content);
  if (rawSheets.length === 0) return [];

  return rawSheets.map((sheet, index) => {
    const title = extractSheetTitle(sheet, index);
    const rootRef = extractRootTopicRef(sheet);
    const rootTopic = rootRef ? toTopicNode(rootRef, topicsById, new Set()) : { title: "中心主题" };
    const sheetRecord = sheet as Record<string, unknown>;
    const resolvedRoot = rootRef ? resolveTopicValue(rootRef, topicsById) : null;
    const resolvedRootRecord = isRecord(resolvedRoot) ? resolvedRoot : null;
    const structureClass =
      typeof sheetRecord.structureClass === "string"
        ? sheetRecord.structureClass
        : typeof resolvedRootRecord?.structureClass === "string"
          ? resolvedRootRecord.structureClass
          : undefined;
    const { layoutMode, themeId } = rootRef ? extractAtoolsExtensionData(rootRef, topicsById) : {};
    const legacyThemeId = typeof sheetRecord.atoolsThemeId === "string" ? (sheetRecord.atoolsThemeId as MindMapThemeId) : undefined;
    const legacyLayoutMode =
      typeof sheetRecord.structureClass === "string" && sheetRecord.structureClass.startsWith("atools:layout:")
        ? (sheetRecord.structureClass.slice("atools:layout:".length) as MindMapLayoutMode)
        : undefined;

    return {
      title,
      rootTopic,
      structureClass,
      atoolsLayoutMode: layoutMode ?? legacyLayoutMode,
      atoolsThemeId: themeId ?? legacyThemeId,
    };
  });
};

const getFirstChildElementByLocalName = (el: Element, localName: string): Element | null => {
  for (const child of Array.from(el.children)) {
    if (child.localName === localName) return child;
  }
  return null;
};

const getChildElementsByLocalName = (el: Element, localName: string): Element[] =>
  Array.from(el.children).filter((child) => child.localName === localName);

const getChildTextByLocalName = (el: Element, localName: string): string => {
  const child = getFirstChildElementByLocalName(el, localName);
  return (child?.textContent ?? "").trim();
};

const parseTopicXml = (topicEl: Element): TopicNode => {
  const title = getChildTextByLocalName(topicEl, "title");

  const labelsEl = getFirstChildElementByLocalName(topicEl, "labels");
  const labels = labelsEl
    ? getChildElementsByLocalName(labelsEl, "label")
        .map((labelEl) => (labelEl.textContent ?? "").trim())
        .filter(Boolean)
    : [];

  const notesEl = getFirstChildElementByLocalName(topicEl, "notes");
  const plainEl = notesEl ? getFirstChildElementByLocalName(notesEl, "plain") : null;
  const noteContent = (plainEl?.textContent ?? "").trim();

  const childrenEl = getFirstChildElementByLocalName(topicEl, "children");
  const topicsGroups = childrenEl ? getChildElementsByLocalName(childrenEl, "topics") : [];

  const attached: TopicNode[] = [];
  const detached: TopicNode[] = [];
  for (const groupEl of topicsGroups) {
    const groupType = (groupEl.getAttribute("type") ?? "attached").toLowerCase();
    const topicChildren = getChildElementsByLocalName(groupEl, "topic").map(parseTopicXml);
    if (groupType === "detached") detached.push(...topicChildren);
    else attached.push(...topicChildren);
  }

  const children: TopicNode["children"] = {};
  if (attached.length > 0) children.attached = attached;
  if (detached.length > 0) children.detached = detached;

  return {
    title,
    labels: labels.length > 0 ? labels : undefined,
    notes: noteContent ? { plain: { content: noteContent } } : undefined,
    children: Object.keys(children).length > 0 ? children : undefined,
  };
};

const parseXmindXml = (xmlText: string): Sheet[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return [];

  const sheetEls = Array.from(doc.getElementsByTagNameNS("*", "sheet"));
  return sheetEls.map((sheetEl, index) => {
    const title = getChildTextByLocalName(sheetEl, "title") || `Sheet ${index + 1}`;
    const directTopic = getFirstChildElementByLocalName(sheetEl, "topic");
    const anyTopic = directTopic ?? sheetEl.getElementsByTagNameNS("*", "topic")[0] ?? null;
    const rootTopic = anyTopic ? parseTopicXml(anyTopic) : undefined;
    return { title, rootTopic };
  });
};

const mindMapNodeToLines = (topic: MindMapNode, indent: number): string[] => {
  const pad = "  ".repeat(indent);
  const title = topic.title.trim() || "(无标题)";
  const labels = Array.isArray(topic.labels) && topic.labels.length > 0 ? ` [${topic.labels.join(", ")}]` : "";
  const lines = [`${pad}- ${title}${labels}`];

  const note = topic.notes?.plain?.content;
  if (typeof note === "string" && note.trim()) {
    lines.push(`${pad}  > ${note.trim().replace(/\s+/g, " ").slice(0, 200)}`);
  }

  for (const child of topic.children) {
    lines.push(...mindMapNodeToLines(child, indent + 1));
  }
  return lines;
};

const topicNodeToMindMapNode = (topic: TopicNode, createId: () => string): MindMapNode => {
  const attached = topic.children?.attached ?? [];
  const detached = topic.children?.detached ?? [];
  const children = [...attached, ...detached].map((child) => topicNodeToMindMapNode(child, createId));

  return {
    id: createId(),
    title: (topic.title ?? "").trim() || "(无标题)",
    labels: topic.labels && topic.labels.length > 0 ? [...topic.labels] : undefined,
    notes: topic.notes?.plain?.content ? { plain: { content: topic.notes.plain.content } } : undefined,
    children,
    collapsed: Boolean(topic.collapsed),
  };
};

const cloneMindMapNodeWithNewIds = (node: MindMapNode, createId: () => string): MindMapNode => ({
  ...node,
  id: createId(),
  children: node.children.map((child) => cloneMindMapNodeWithNewIds(child, createId)),
});

const setCollapseForAll = (node: MindMapNode, collapsed: boolean): MindMapNode => ({
  ...node,
  collapsed: node.children.length > 0 ? collapsed : false,
  children: node.children.map((child) => setCollapseForAll(child, collapsed)),
});

const hasAnyExpandedBranch = (node: MindMapNode): boolean => {
  if (node.children.length > 0 && !node.collapsed) return true;
  return node.children.some((child) => hasAnyExpandedBranch(child));
};

const normalizeToMindMapSheets = (sheets: Sheet[], createId: () => string): MindMapSheet[] => {
  if (sheets.length === 0) {
    return [
      {
        id: createId(),
        title: "Sheet 1",
        rootTopic: createNodeWithTitle(createId(), "中心主题"),
        layoutMode: "balanced",
        themeId: "classicLight",
      },
    ];
  }

  return sheets.map((sheet, index) => ({
    id: createId(),
    title: extractSheetTitle(sheet, index),
    rootTopic: sheet.rootTopic ? topicNodeToMindMapNode(sheet.rootTopic, createId) : createNodeWithTitle(createId(), "中心主题"),
    layoutMode:
      typeof (sheet as Record<string, unknown>).atoolsLayoutMode === "string"
        ? ((sheet as Record<string, unknown>).atoolsLayoutMode as MindMapLayoutMode)
        : structureClassToLayoutMode(sheet.structureClass),
    themeId:
      typeof (sheet as Record<string, unknown>).atoolsThemeId === "string"
        ? ((sheet as Record<string, unknown>).atoolsThemeId as MindMapThemeId)
        : "classicLight",
  }));
};

const parseXmind = async (file: File): Promise<ParsedXmind> => {
  const raw = new Uint8Array(await file.arrayBuffer());
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(raw);
  } catch {
    return { entries: [], sheets: [], source: null, parseError: "文件不是有效的 .xmind（zip）或已损坏。" };
  }
  const entryNames = Object.keys(unzipped).sort((a, b) => a.localeCompare(b, "en"));

  const contentJsonKey = entryNames.find((name) => name.toLowerCase().endsWith("content.json")) ?? null;
  if (contentJsonKey) {
    const text = strFromU8(unzipped[contentJsonKey]);
    const parsed = safeJsonParse(text);
    if (!parsed) {
      return {
        entries: entryNames,
        sheets: [],
        source: contentJsonKey,
        parseError: "已找到 content.json，但解析失败（文件可能损坏或编码异常）。",
      };
    }
    const topicsById = buildTopicsById(parsed);
    const normalizedSheets = normalizeSheetsFromContentJson(parsed, topicsById);
    const sheets =
      normalizedSheets.length > 0
        ? normalizedSheets
        : asSheets(parsed).map((sheet, index) => ({
            title: extractSheetTitle(sheet, index),
            rootTopic: sheet.rootTopic ? toTopicNode(sheet.rootTopic, topicsById, new Set()) : { title: "中心主题" },
            structureClass:
              typeof (sheet as Sheet).structureClass === "string" ? (sheet as Sheet).structureClass : undefined,
          }));
    if (sheets.length === 0) {
      return {
        entries: entryNames,
        sheets: [],
        source: contentJsonKey,
        parseError: "已找到 content.json，但未识别出 Sheet 数据（可能是格式差异）。",
      };
    }
    return { entries: entryNames, sheets, source: contentJsonKey, parseError: null };
  }

  const contentXmlKey = entryNames.find((name) => name.toLowerCase().endsWith("content.xml")) ?? null;
  if (contentXmlKey) {
    const text = strFromU8(unzipped[contentXmlKey]);
    const sheets = parseXmindXml(text);
    if (sheets.length === 0) {
      return {
        entries: entryNames,
        sheets: [],
        source: contentXmlKey,
        parseError: "已找到 content.xml，但解析失败（可能是格式差异或文件损坏）。",
      };
    }
    return { entries: entryNames, sheets, source: contentXmlKey, parseError: null };
  }

  return {
    entries: entryNames,
    sheets: [],
    source: null,
    parseError: "未找到 content.json 或 content.xml（可能不是 XMind 文件或格式暂不支持）。",
  };
};

export default function XmindViewerClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasHandleRef = useRef<XmindMindMapCanvasHandle>(null);
  const idCounterRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedXmind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [editorSheets, setEditorSheets] = useState<MindMapSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [canvasViewResetKey, setCanvasViewResetKey] = useState(0);
  const copyHintTimerRef = useRef<number | null>(null);
  const titleEditSessionRef = useRef<{ nodeId: string | null; hasPushedHistory: boolean }>({
    nodeId: null,
    hasPushedHistory: false,
  });

  const historyRef = useRef<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });
  const [historyTick, setHistoryTick] = useState(0);

  const [draftStatus, setDraftStatus] = useState<"idle" | "available" | "dismissed">("idle");
  const draftRef = useRef<DraftPayload | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const sheetViewByIdRef = useRef<Record<string, ViewStateBundle>>({});

  const createId = useCallback(() => {
    idCounterRef.current += 1;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `xmind-node-${idCounterRef.current}`;
  }, []);

  const resetHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] };
    setHistoryTick((prev) => prev + 1);
  }, []);

  const pushHistory = useCallback((snapshot: EditorSnapshot) => {
    const history = historyRef.current;
    history.past = [...history.past, cloneValue(snapshot)].slice(-80);
    history.future = [];
    setHistoryTick((prev) => prev + 1);
  }, []);

  const canUndo = historyTick >= 0 && historyRef.current.past.length > 0;
  const canRedo = historyTick >= 0 && historyRef.current.future.length > 0;

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1]!;
    history.past = history.past.slice(0, -1);
    history.future = [
      cloneValue({ sheets: editorSheets, activeSheetId, selectedNodeId }),
      ...history.future,
    ].slice(0, 80);
    setEditorSheets(normalizeEditorSheets(cloneValue(previous.sheets)));
    setActiveSheetId(previous.activeSheetId);
    setSelectedNodeId(previous.selectedNodeId);
    setHistoryTick((prev) => prev + 1);
  }, [activeSheetId, editorSheets, selectedNodeId]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (history.future.length === 0) return;
    const next = history.future[0]!;
    history.future = history.future.slice(1);
    history.past = [
      ...history.past,
      cloneValue({ sheets: editorSheets, activeSheetId, selectedNodeId }),
    ].slice(-80);
    setEditorSheets(normalizeEditorSheets(cloneValue(next.sheets)));
    setActiveSheetId(next.activeSheetId);
    setSelectedNodeId(next.selectedNodeId);
    setHistoryTick((prev) => prev + 1);
  }, [activeSheetId, editorSheets, selectedNodeId]);

  useEffect(() => {
    const draft = getDraftFromStorage();
    if (!draft || !draft.editor.sheets || draft.editor.sheets.length === 0) {
      setDraftStatus("dismissed");
      return;
    }
    draftRef.current = draft;
    setDraftStatus("available");
  }, []);

  const restoreDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;
    setFile(null);
    setParsed(null);
    setError(null);
    setEditorSheets(normalizeEditorSheets(cloneValue(draft.editor.sheets)));
    setActiveSheetId(draft.editor.activeSheetId);
    setSelectedNodeId(draft.editor.selectedNodeId);
    setCanvasViewResetKey((prev) => prev + 1);
    resetHistory();
    sheetViewByIdRef.current = {};
    setDraftStatus("dismissed");
  }, [resetHistory]);

  const deleteDraft = useCallback(() => {
    draftRef.current = null;
    clearDraftStorage();
    setDraftStatus("dismissed");
  }, []);

  useEffect(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    if (editorSheets.length === 0) return;
    autosaveTimerRef.current = window.setTimeout(() => {
      saveDraftToStorage({
        version: 1,
        savedAt: Date.now(),
        editor: {
          sheets: cloneValue(editorSheets),
          activeSheetId,
          selectedNodeId,
        },
      });
    }, 650);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [activeSheetId, editorSheets, selectedNodeId]);

  useEffect(() => {
    return () => {
      if (copyHintTimerRef.current) window.clearTimeout(copyHintTimerRef.current);
    };
  }, []);

  const activeSheet = useMemo(() => {
    if (!activeSheetId) return null;
    return editorSheets.find((sheet) => sheet.id === activeSheetId) ?? null;
  }, [activeSheetId, editorSheets]);

  const activeTheme = useMemo(() => getTheme(activeSheet?.themeId), [activeSheet?.themeId]);

  const activeSheetIndex = useMemo(() => {
    if (!activeSheetId) return -1;
    return editorSheets.findIndex((sheet) => sheet.id === activeSheetId);
  }, [activeSheetId, editorSheets]);

  useEffect(() => {
    if (!activeSheet?.rootTopic) {
      setSelectedNodeId(null);
      return;
    }
    const rootTopic = activeSheet.rootTopic;
    setSelectedNodeId((prev) => (prev && findNodeContext(rootTopic, prev) ? prev : rootTopic.id));
  }, [activeSheet?.id, activeSheet?.rootTopic]);

  const selectedContext = useMemo(() => {
    if (!activeSheet?.rootTopic || !selectedNodeId) return null;
    return findNodeContext(activeSheet.rootTopic, selectedNodeId);
  }, [activeSheet?.rootTopic, selectedNodeId]);

  const selectedNode = selectedContext?.node ?? null;
  const selectedNodeIsRoot = selectedContext?.parent === null;
  const selectedNodeHasChildren = (selectedNode?.children.length ?? 0) > 0;

  const collapseAction = useMemo(() => {
    if (!activeSheet?.rootTopic) return null;
    const canToggleSelected = Boolean(selectedNodeId && selectedNodeHasChildren);
    if (canToggleSelected) {
      return {
        label: selectedNode?.collapsed ? "展开" : "折叠",
        mode: "selected" as const,
      };
    }

    const shouldCollapse = hasAnyExpandedBranch(activeSheet.rootTopic);
    return {
      label: shouldCollapse ? "全部折叠" : "全部展开",
      mode: shouldCollapse ? ("collapse-all" as const) : ("expand-all" as const),
    };
  }, [activeSheet?.rootTopic, selectedNode?.collapsed, selectedNodeHasChildren, selectedNodeId]);

  const outline = useMemo(() => {
    if (!activeSheet?.rootTopic) return "";
    const lines: string[] = [];
    lines.push(`# ${activeSheet.title.trim() || "Sheet"}`);
    lines.push(...mindMapNodeToLines(activeSheet.rootTopic, 0));
    return lines.join("\n").trim();
  }, [activeSheet]);

  useEffect(() => {
    setEditingTitle(selectedNode?.title ?? "");
    titleEditSessionRef.current = { nodeId: selectedNode?.id ?? null, hasPushedHistory: false };
  }, [selectedNode?.id, selectedNode?.title]);

  const applyActiveSheetUpdate = useCallback(
    (updater: (sheet: MindMapSheet) => MindMapSheet, options?: { recordHistory?: boolean }) => {
      if (!activeSheetId) return;
      setEditorSheets((prev) => {
        if (options?.recordHistory !== false) {
          pushHistory({ sheets: prev, activeSheetId, selectedNodeId });
        }
        return prev.map((sheet) => (sheet.id === activeSheetId ? updater(sheet) : sheet));
      });
    },
    [activeSheetId, pushHistory, selectedNodeId],
  );

  const setSheetLayout = useCallback(
    (layoutMode: MindMapLayoutMode) => {
      applyActiveSheetUpdate((sheet) => ({ ...sheet, layoutMode }));
    },
    [applyActiveSheetUpdate],
  );

  const setSheetTheme = useCallback(
    (themeId: MindMapThemeId) => {
      applyActiveSheetUpdate((sheet) => ({ ...sheet, themeId }));
    },
    [applyActiveSheetUpdate],
  );

  const updateSelectedNodeTitle = useCallback(
    (rawTitle: string) => {
      if (!activeSheet?.rootTopic || !selectedNodeId) return;
      const normalizedTitle = rawTitle;

      const session = titleEditSessionRef.current;
      if (session.nodeId !== selectedNodeId) {
        session.nodeId = selectedNodeId;
        session.hasPushedHistory = false;
      }
      const recordHistory = !session.hasPushedHistory;
      if (recordHistory) session.hasPushedHistory = true;

      applyActiveSheetUpdate((sheet) => {
        if (!sheet.rootTopic) return sheet;
        const [nextRoot] = mapNodeById(sheet.rootTopic, selectedNodeId, (node) => ({ ...node, title: normalizedTitle }));
        return { ...sheet, rootTopic: nextRoot };
      }, { recordHistory });
    },
    [activeSheet?.rootTopic, applyActiveSheetUpdate, selectedNodeId],
  );

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      applyActiveSheetUpdate((sheet) => {
        if (!sheet.rootTopic) return sheet;
        const [nextRoot] = mapNodeById(sheet.rootTopic, nodeId, (node) => {
          if (node.children.length === 0) return node;
          return { ...node, collapsed: !node.collapsed };
        });
        return { ...sheet, rootTopic: nextRoot };
      });
    },
    [applyActiveSheetUpdate],
  );

  const runCollapseAction = useCallback(() => {
    if (!activeSheet?.rootTopic || !collapseAction) return;
    if (collapseAction.mode === "selected") {
      if (!selectedNodeId) return;
      toggleCollapse(selectedNodeId);
      return;
    }
    const collapsed = collapseAction.mode === "collapse-all";
    applyActiveSheetUpdate((sheet) => {
      if (!sheet.rootTopic) return sheet;
      return { ...sheet, rootTopic: setCollapseForAll(sheet.rootTopic, collapsed) };
    });
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, collapseAction, selectedNodeId, toggleCollapse]);

  const switchActiveSheet = useCallback(
    (nextSheetId: string | null) => {
      if (activeSheetId && canvasHandleRef.current) {
        sheetViewByIdRef.current[activeSheetId] = canvasHandleRef.current.getViewStateBundle();
      }
      setActiveSheetId(nextSheetId);
      if (nextSheetId) {
        const saved = sheetViewByIdRef.current[nextSheetId];
        if (saved && canvasHandleRef.current) {
          canvasHandleRef.current.setViewStateBundle(saved);
        } else {
          setCanvasViewResetKey((prev) => prev + 1);
        }
      } else {
        setCanvasViewResetKey((prev) => prev + 1);
      }
    },
    [activeSheetId],
  );

  const createNewSheet = useCallback(() => {
    const defaultTitle = `画布 ${editorSheets.length + 1}`;
    const rawTitle = window.prompt("新建画布名称", defaultTitle);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    const nextSheet: MindMapSheet = {
      id: createId(),
      title,
      rootTopic: createNodeWithTitle(createId(), "中心主题"),
      layoutMode: activeSheet?.layoutMode ?? "balanced",
      themeId: activeSheet?.themeId ?? "classicLight",
    };

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    setEditorSheets((prev) => [...prev, nextSheet]);
    switchActiveSheet(nextSheet.id);
    setSelectedNodeId(nextSheet.rootTopic?.id ?? null);
  }, [
    activeSheet?.layoutMode,
    activeSheet?.themeId,
    activeSheetId,
    createId,
    editorSheets,
    pushHistory,
    selectedNodeId,
    switchActiveSheet,
  ]);

  const renameActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    const current = editorSheets.find((sheet) => sheet.id === activeSheetId);
    if (!current) return;
    const rawTitle = window.prompt("重命名画布", current.title);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    setEditorSheets((prev) => prev.map((sheet) => (sheet.id === activeSheetId ? { ...sheet, title } : sheet)));
  }, [activeSheetId, editorSheets, pushHistory, selectedNodeId]);

  const duplicateActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    const current = editorSheets.find((sheet) => sheet.id === activeSheetId);
    if (!current) return;

    const nextTitle = `${current.title} 副本`;
    const rawTitle = window.prompt("复制画布名称", nextTitle);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    const clonedRoot = current.rootTopic
      ? cloneMindMapNodeWithNewIds(current.rootTopic, createId)
      : createNodeWithTitle(createId(), "中心主题");
    const nextSheet: MindMapSheet = {
      ...current,
      id: createId(),
      title,
      rootTopic: clonedRoot,
      themeId: current.themeId ?? "classicLight",
    };

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    setEditorSheets((prev) => [...prev, nextSheet]);
    switchActiveSheet(nextSheet.id);
    setSelectedNodeId(nextSheet.rootTopic?.id ?? null);
  }, [activeSheetId, createId, editorSheets, pushHistory, selectedNodeId, switchActiveSheet]);

  const deleteActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    if (editorSheets.length <= 1) {
      window.alert("至少保留一个画布。");
      return;
    }
    const sheet = editorSheets.find((item) => item.id === activeSheetId);
    if (!sheet) return;
    const ok = window.confirm(`确认删除画布「${sheet.title}」？`);
    if (!ok) return;

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    const nextSheets = editorSheets.filter((item) => item.id !== activeSheetId);
    setEditorSheets(nextSheets);

    const nextActive = nextSheets[Math.max(0, activeSheetIndex - 1)] ?? nextSheets[0] ?? null;
    const nextActiveId = nextActive?.id ?? null;
    switchActiveSheet(nextActiveId);
    setSelectedNodeId(nextActive?.rootTopic?.id ?? null);
  }, [activeSheetId, activeSheetIndex, editorSheets, pushHistory, selectedNodeId, switchActiveSheet]);

  const moveActiveSheet = useCallback(
    (direction: -1 | 1) => {
      if (!activeSheetId) return;
      const index = editorSheets.findIndex((sheet) => sheet.id === activeSheetId);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= editorSheets.length) return;

      pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
      const nextSheets = [...editorSheets];
      const [removed] = nextSheets.splice(index, 1);
      nextSheets.splice(nextIndex, 0, removed!);
      setEditorSheets(nextSheets);
    },
    [activeSheetId, editorSheets, pushHistory, selectedNodeId],
  );

  const addChildNode = useCallback(() => {
    if (!activeSheet?.rootTopic) return;
    const targetId = selectedNodeId ?? activeSheet.rootTopic.id;
    const nextId = createId();
    applyActiveSheetUpdate((sheet) => {
      if (!sheet.rootTopic) return sheet;
      const [nextRoot] = mapNodeById(sheet.rootTopic, targetId, (node) => ({
        ...node,
        collapsed: false,
        children: [...node.children, createNodeWithTitle(nextId)],
      }));
      return { ...sheet, rootTopic: nextRoot };
    });
    setSelectedNodeId(nextId);
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, createId, selectedNodeId]);

  const addSiblingNode = useCallback(() => {
    if (!activeSheet?.rootTopic || !selectedNodeId) return;
    const context = findNodeContext(activeSheet.rootTopic, selectedNodeId);
    if (!context?.parent) return;
    const parentId = context.parent.id;
    const insertIndex = context.index + 1;
    const nextId = createId();

    applyActiveSheetUpdate((sheet) => {
      if (!sheet.rootTopic) return sheet;
      const [nextRoot] = mapNodeById(sheet.rootTopic, parentId, (parentNode) => {
        const nextChildren = [...parentNode.children];
        nextChildren.splice(insertIndex, 0, createNodeWithTitle(nextId));
        return { ...parentNode, collapsed: false, children: nextChildren };
      });
      return { ...sheet, rootTopic: nextRoot };
    });

    setSelectedNodeId(nextId);
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, createId, selectedNodeId]);

  const deleteSelectedNode = useCallback(() => {
    if (!activeSheet?.rootTopic || !selectedNodeId) return;
    if (activeSheet.rootTopic.id === selectedNodeId) return;
    let nextSelectedId: string | null = null;

    applyActiveSheetUpdate((sheet) => {
      if (!sheet.rootTopic) return sheet;
      const result = removeNodeById(sheet.rootTopic, selectedNodeId);
      if (!result.removed) return sheet;
      nextSelectedId = result.parentId ?? sheet.rootTopic.id;
      return { ...sheet, rootTopic: result.node };
    });

    setSelectedNodeId(nextSelectedId);
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, selectedNodeId]);

  const moveNode = useCallback(
    (draggedId: string, targetId: string, placement: "before" | "after" | "child") => {
      if (!activeSheet?.rootTopic) return;
      if (activeSheet.rootTopic.id === draggedId) return;

      applyActiveSheetUpdate((sheet) => {
        if (!sheet.rootTopic) return sheet;

        const draggedContext = findNodeContext(sheet.rootTopic, draggedId);
        if (!draggedContext) return sheet;
        if (findNodeContext(draggedContext.node, targetId)) return sheet;

        const detached = detachNodeById(sheet.rootTopic, draggedId);
        if (!detached.detached) return sheet;

        const nodeToInsert = detached.detached;
        let workingRoot = detached.node;

        if (placement === "child") {
          const [nextRoot] = mapNodeById(workingRoot, targetId, (node) => ({
            ...node,
            collapsed: false,
            children: [...node.children, nodeToInsert],
          }));
          workingRoot = nextRoot;
        } else {
          const targetContext = findNodeContext(workingRoot, targetId);
          if (!targetContext) return sheet;
          const parent = targetContext.parent;
          if (!parent) {
            const [nextRoot] = mapNodeById(workingRoot, workingRoot.id, (node) => ({
              ...node,
              collapsed: false,
              children: [...node.children, nodeToInsert],
            }));
            workingRoot = nextRoot;
          } else {
            const insertIndex = targetContext.index + (placement === "after" ? 1 : 0);
            const [nextRoot] = mapNodeById(workingRoot, parent.id, (node) => {
              const nextChildren = [...node.children];
              nextChildren.splice(Math.max(0, Math.min(insertIndex, nextChildren.length)), 0, nodeToInsert);
              return { ...node, collapsed: false, children: nextChildren };
            });
            workingRoot = nextRoot;
          }
        }

        return { ...sheet, rootTopic: workingRoot };
      });

      setSelectedNodeId(draggedId);
    },
    [activeSheet?.rootTopic, applyActiveSheetUpdate],
  );

  const runParse = async (selected: File) => {
    const looksLikeXmind = /\.xmind$/i.test(selected.name);
    if (!looksLikeXmind) {
      setError("提示：文件后缀不是 .xmind，但仍会尝试解析（如果是改名文件也可以）。");
    }
    setFile(selected);
    setParsed(null);
    setCopyHint(null);
    setIsLoading(true);
    setEditorSheets([]);
    setActiveSheetId(null);
    setSelectedNodeId(null);
    resetHistory();
    try {
      const next = await parseXmind(selected);
      setParsed(next);
      if (next.parseError) {
        setError(next.parseError);
        setEditorSheets([]);
        setActiveSheetId(null);
        setSelectedNodeId(null);
        resetHistory();
        return;
      }

      const normalizedSheets = normalizeToMindMapSheets(next.sheets, createId);
      setEditorSheets(normalizedSheets);
      const nextActiveId = normalizedSheets[0]?.id ?? null;
      setActiveSheetId(nextActiveId);
      setSelectedNodeId(normalizedSheets[0]?.rootTopic?.id ?? null);
      setCanvasViewResetKey((prev) => prev + 1);
      resetHistory();
      sheetViewByIdRef.current = {};

      if (looksLikeXmind) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败，请确认文件是 .xmind。");
    } finally {
      setIsLoading(false);
    }
  };

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await runParse(selected);
  };

  const copy = async () => {
    if (!outline) return;
    try {
      await navigator.clipboard.writeText(outline);
      setCopyHint("已复制");
    } catch {
      setCopyHint("复制失败（请检查浏览器权限/HTTPS 环境）");
    } finally {
      if (copyHintTimerRef.current) window.clearTimeout(copyHintTimerRef.current);
      copyHintTimerRef.current = window.setTimeout(() => setCopyHint(null), 1500);
    }
  };

  const downloadText = (filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBaseName = useMemo(() => {
    const fileBase = file?.name ? file.name.replace(/\.xmind$/i, "") : null;
    const sheetBase = activeSheet?.title ?? null;
    return sanitizeFilename(fileBase || sheetBase || "mindmap") || "mindmap";
  }, [activeSheet?.title, file?.name]);

  const exportPng = useCallback(async () => {
    const canvas = canvasHandleRef.current;
    if (!canvas) return;
    try {
      const blob = await canvas.exportAsPng({ scale: 2, padding: 56 });
      const suffix = activeSheet ? `-${sanitizeFilename(activeSheet.title)}` : "";
      downloadBlob(`${exportBaseName}${suffix}.png`, blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出 PNG 失败");
    }
  }, [activeSheet, exportBaseName]);

  const exportSvg = useCallback(() => {
    const canvas = canvasHandleRef.current;
    if (!canvas) return;
    try {
      const svg = canvas.exportAsSvg({ padding: 56 });
      const suffix = activeSheet ? `-${sanitizeFilename(activeSheet.title)}` : "";
      downloadBlob(
        `${exportBaseName}${suffix}.svg`,
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出 SVG 失败");
    }
  }, [activeSheet, exportBaseName]);

  const exportPdf = useCallback(async () => {
    const canvas = canvasHandleRef.current;
    if (!canvas) return;
    try {
      const pngBlob = await canvas.exportAsPng({ scale: 2, padding: 56 });
      const pngBytes = await pngBlob.arrayBuffer();

      const doc = await PDFDocument.create();
      const image = await doc.embedPng(pngBytes);
      const page = doc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

      const pdfBytes = await doc.save();
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      const suffix = activeSheet ? `-${sanitizeFilename(activeSheet.title)}` : "";
      downloadBlob(`${exportBaseName}${suffix}.pdf`, new Blob([pdfBuffer], { type: "application/pdf" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出 PDF 失败");
    }
  }, [activeSheet, exportBaseName]);

  const exportXmind = useCallback(() => {
    const sheets = editorSheets.length > 0 ? editorSheets : null;
    if (!sheets) return;

    const createZipId = (): string => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
      return `xmind-export-${Math.random().toString(16).slice(2)}-${Date.now()}`;
    };

    const createStyle = () => ({ id: createZipId(), properties: {} as Record<string, string> });

    const nodeToXmindTopic = (node: MindMapNode, options?: { isRoot?: boolean; sheet?: MindMapSheet }): Record<string, unknown> => {
      const attached = node.children.map((child) => nodeToXmindTopic(child));
      const topic: Record<string, unknown> = {
        id: node.id,
        title: node.title,
        style: createStyle(),
      };

      if (node.labels && node.labels.length > 0) topic.labels = node.labels.join(",");
      if (node.notes?.plain?.content) topic.notes = { plain: { content: node.notes.plain.content } };
      if (node.collapsed) topic.branch = "folded";
      if (attached.length > 0) topic.children = { attached };

      if (options?.isRoot && options.sheet) {
        topic.extensions = [
          {
            provider: ATTOOLS_EXTENSION_PROVIDER,
            content: JSON.stringify({ version: 1, layoutMode: options.sheet.layoutMode, themeId: options.sheet.themeId }),
          },
        ];
      }

      return topic;
    };

    const content = sheets.map((sheet) => ({
      id: sheet.id,
      title: sheet.title,
      rootTopic: sheet.rootTopic ? nodeToXmindTopic(sheet.rootTopic, { isRoot: true, sheet }) : { id: createZipId(), title: "中心主题" },
      style: createStyle(),
      topicPositioning: "fixed",
    }));

    const metadata = {};
    const manifest = { "file-entries": { "content.json": {}, "metadata.json": {} } };
    const contentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" modified-by="atools" timestamp="0" version="2.0"><sheet id="atools-warning" modified-by="atools" theme="atools" timestamp="0"><topic id="atools-warning-topic" modified-by="atools" structure-class="org.xmind.ui.logic.right" timestamp="0"><title>Warning\n警告\nAttention\nWarnung\n경고</title><children><topics type="attached"><topic id="atools-warning-node" modified-by="atools" timestamp="0"><title svg:width="500">This file may not be fully compatible with older XMind versions. Please open with XMind 8 Update 3 or later.</title></topic></topics></children></topic></sheet></xmap-content>';

    const zip = zipSync(
      {
        "content.json": strToU8(JSON.stringify(content, null, 2)),
        "metadata.json": strToU8(JSON.stringify(metadata, null, 2)),
        "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
        "content.xml": strToU8(contentXml),
      },
      { level: 6 },
    );

    const zipBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    downloadBlob(`${exportBaseName}.xmind`, new Blob([zipBuffer], { type: "application/octet-stream" }));
  }, [editorSheets, exportBaseName]);

  const clear = () => {
    setFile(null);
    setParsed(null);
    setError(null);
    setEditorSheets([]);
    setActiveSheetId(null);
    setSelectedNodeId(null);
    setEditingTitle("");
    setCanvasViewResetKey((prev) => prev + 1);
    resetHistory();
    sheetViewByIdRef.current = {};
    clearDraftStorage();
    setDraftStatus("dismissed");
    setCopyHint(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-3xl p-6 shadow-2xl ring-1 ring-black/5">
        {draftStatus === "available" && editorSheets.length === 0 && (
          <div className="mb-6 rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-amber-900">检测到上次未完成的本地草稿</div>
                <div className="mt-1 text-xs text-amber-800">是否恢复继续编辑？（草稿仅保存在本地浏览器）</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  恢复草稿
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatus("dismissed")}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
                >
                  忽略
                </button>
                <button
                  type="button"
                  onClick={deleteDraft}
                  className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  删除草稿
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          className={[
            "rounded-3xl border border-dashed bg-white p-6 ring-1 ring-slate-200 transition",
            isDragging ? "border-slate-900 bg-slate-50" : "border-slate-200",
          ].join(" ")}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (!dropped) return;
            void runParse(dropped);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">打开 .xmind 文件</div>
              <div className="mt-1 text-xs text-slate-500">拖拽到此处或点击选择文件（本地解析，不上传）</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  inputRef.current?.click();
                }}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                选择文件
              </button>
              <button
                type="button"
                disabled={!outline}
                onClick={() => void copy()}
                className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                复制大纲
              </button>
              <button
                type="button"
                disabled={!outline || !file}
                onClick={() => {
                  if (!outline || !file) return;
                  const base = file.name.replace(/\.xmind$/i, "");
                  downloadText(`${base || "xmind"}.md`, outline + "\n", "text/markdown;charset=utf-8");
                }}
                className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                下载大纲
              </button>
              <button
                type="button"
                disabled={!file && !parsed}
                onClick={clear}
                className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60"
              >
                清除
              </button>
              <input ref={inputRef} type="file" accept=".xmind" className="hidden" onChange={onChange} />
            </div>
          </div>

          {(isLoading || error || copyHint) && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              {isLoading && <div className="text-slate-600">解析中…</div>}
              {copyHint && <div className="text-slate-600" aria-live="polite">{copyHint}</div>}
              {error && (
                <div className="text-rose-600" aria-live="polite">
                  错误：{error}
                </div>
              )}
            </div>
          )}
        </div>

        {editorSheets.length > 0 && activeSheet && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 ring-1 ring-slate-200">
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Sheet</span>{" "}
              <span className="text-slate-500">（共 {editorSheets.length} 个）</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeSheetId ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  switchActiveSheet(nextId);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
              >
                {editorSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.title.slice(0, 80)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={createNewSheet}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                新建画布
              </button>
              <button
                type="button"
                onClick={renameActiveSheet}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                重命名
              </button>
              <button
                type="button"
                onClick={duplicateActiveSheet}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                复制
              </button>
              <button
                type="button"
                onClick={deleteActiveSheet}
                disabled={editorSheets.length <= 1}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60"
              >
                删除
              </button>
              <button
                type="button"
                onClick={() => moveActiveSheet(-1)}
                disabled={activeSheetIndex <= 0}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveActiveSheet(1)}
                disabled={activeSheetIndex < 0 || activeSheetIndex >= editorSheets.length - 1}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                ↓
              </button>

              <select
                value={activeSheet.layoutMode}
                onChange={(e) => setSheetLayout(e.target.value as MindMapLayoutMode)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                title="布局模式"
              >
                <option value="balanced">布局：左右均衡</option>
                <option value="right">布局：向右</option>
                <option value="left">布局：向左</option>
                <option value="up">布局：向上（树形）</option>
                <option value="down">布局：向下（树形）</option>
                <option value="downCompact">布局：向下紧凑</option>
                <option value="downCompact2">布局：向下紧凑2</option>
              </select>

              <select
                value={activeSheet.themeId}
                onChange={(e) => setSheetTheme(e.target.value as MindMapThemeId)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                title="主题"
              >
                {Object.values(themes).map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    主题：{theme.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                撤销
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                重做
              </button>
              <button
                type="button"
                disabled={!collapseAction}
                onClick={runCollapseAction}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {collapseAction?.label ?? "折叠/展开"}
              </button>

              <button
                type="button"
                onClick={() => void exportPng()}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                导出 PNG
              </button>
              <button
                type="button"
                onClick={exportSvg}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                导出 SVG
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                导出 PDF
              </button>
              <button
                type="button"
                onClick={exportXmind}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                导出 .xmind
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <XmindMindMapCanvas
            ref={canvasHandleRef}
            rootTopic={activeSheet?.rootTopic ?? null}
            layoutMode={activeSheet?.layoutMode ?? "balanced"}
            theme={activeTheme}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onToggleCollapse={toggleCollapse}
            onMoveNode={moveNode}
            viewResetKey={canvasViewResetKey}
            fullscreenSidebar={
              activeSheet ? (
                <div className="space-y-3">
                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">画布</div>
                    <select
                      value={activeSheetId ?? ""}
                      onChange={(e) => {
                        const nextId = e.target.value || null;
                        switchActiveSheet(nextId);
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                    >
                      {editorSheets.map((sheet) => (
                        <option key={sheet.id} value={sheet.id}>
                          {sheet.title.slice(0, 80)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 max-h-40 overflow-auto rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <div className="grid gap-1">
                        {editorSheets.map((sheet) => {
                          const isActive = sheet.id === activeSheetId;
                          return (
                            <button
                              key={sheet.id}
                              type="button"
                              onClick={() => switchActiveSheet(sheet.id)}
                              className={
                                isActive
                                  ? "rounded-2xl bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-white"
                                  : "rounded-2xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                              }
                            >
                              {sheet.title.slice(0, 80)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={createNewSheet}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        新建
                      </button>
                      <button
                        type="button"
                        onClick={renameActiveSheet}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200"
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={duplicateActiveSheet}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200"
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        onClick={deleteActiveSheet}
                        disabled={editorSheets.length <= 1}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActiveSheet(-1)}
                        disabled={activeSheetIndex <= 0}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActiveSheet(1)}
                        disabled={activeSheetIndex < 0 || activeSheetIndex >= editorSheets.length - 1}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        下移
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">布局</div>
                    <select
                      value={activeSheet.layoutMode}
                      onChange={(e) => setSheetLayout(e.target.value as MindMapLayoutMode)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                      title="布局模式"
                    >
                      <option value="balanced">左右均衡</option>
                      <option value="right">向右</option>
                      <option value="left">向左</option>
                      <option value="up">向上</option>
                      <option value="down">向下</option>
                      <option value="downCompact">向下紧凑</option>
                      <option value="downCompact2">向下紧凑2</option>
                    </select>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">主题</div>
                    <select
                      value={activeSheet.themeId}
                      onChange={(e) => setSheetTheme(e.target.value as MindMapThemeId)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                      title="主题"
                    >
                      {Object.values(themes).map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">导出</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void exportPng()}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={exportSvg}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportPdf()}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={exportXmind}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        .xmind
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">编辑</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={!canUndo}
                        onClick={undo}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        撤销
                      </button>
                      <button
                        type="button"
                        disabled={!canRedo}
                        onClick={redo}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        重做
                      </button>
                      <button
                        type="button"
                        disabled={!collapseAction}
                        onClick={runCollapseAction}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {collapseAction?.label ?? "折叠/展开"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">节点</div>
                    <input
                      value={editingTitle}
                      onChange={(event) => {
                        const nextTitle = event.target.value;
                        setEditingTitle(nextTitle);
                        updateSelectedNodeTitle(nextTitle);
                      }}
                      onBlur={() => {
                        const normalized = editingTitle.trim() || "(无标题)";
                        if (normalized !== editingTitle) {
                          setEditingTitle(normalized);
                          updateSelectedNodeTitle(normalized);
                        }
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none"
                      placeholder="节点标题"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={addChildNode}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        子节点
                      </button>
                      <button
                        type="button"
                        onClick={addSiblingNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        同级
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        删除
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {selectedNode ? `当前：${selectedNode.title.slice(0, 30)}` : "未选中节点"}
                    </div>
                  </div>
                </div>
              ) : null
            }
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {activeSheet && (
              <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">节点编辑</div>
                {!selectedNode ? (
                  <div className="mt-3 text-sm text-slate-500">请选择一个节点开始编辑。</div>
                ) : (
                  <>
                    <label className="mt-3 block text-xs font-semibold text-slate-700">
                      节点标题
                      <input
                        value={editingTitle}
                        onChange={(event) => {
                          const nextTitle = event.target.value;
                          setEditingTitle(nextTitle);
                          updateSelectedNodeTitle(nextTitle);
                        }}
                        onBlur={() => {
                          const normalized = editingTitle.trim() || "(无标题)";
                          if (normalized !== editingTitle) {
                            setEditingTitle(normalized);
                            updateSelectedNodeTitle(normalized);
                          }
                        }}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none"
                        placeholder="输入节点标题"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={addChildNode}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        添加子节点
                      </button>
                      <button
                        type="button"
                        onClick={addSiblingNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        添加同级
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedNodeId) return;
                          toggleCollapse(selectedNodeId);
                        }}
                        disabled={!selectedNodeHasChildren}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {selectedNode.collapsed ? "展开" : "折叠"}
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        删除节点
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      {selectedNodeIsRoot ? "根节点不能删除，也不能添加同级节点。" : "可编辑选中节点，并进行增删改与折叠。"}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">文件信息</div>
              <div className="mt-3 text-sm text-slate-700">
                <div>文件名：{file?.name ?? "-"}</div>
                <div className="mt-1">大小：{file ? formatBytes(file.size) : "-"}</div>
                <div className="mt-1">状态：{isLoading ? "解析中..." : error ? "解析失败" : parsed ? "已解析" : "未解析"}</div>
              </div>
              {parsed && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-900">压缩包条目</div>
                  <div className="mt-2 text-xs text-slate-500">
                    解析来源：<code className="font-mono">{parsed.source ?? "-"}</code>
                  </div>
                  <div className="mt-2 max-h-44 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                    {parsed.entries.join("\n")}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 text-xs text-slate-500">
              说明：.xmind 本质是 zip 文件。当前版本支持解析 <code className="font-mono">content.json</code>（新格式）与{" "}
              <code className="font-mono">content.xml</code>（旧格式），支持在 Canvas 中进行基础编辑。
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">大纲预览</div>
                <div className="text-xs text-slate-500">
                  {activeSheet ? `当前：${activeSheet.title}` : "-"}
                </div>
              </div>
              <textarea
                value={outline}
                readOnly
                placeholder="解析后的大纲会显示在这里…"
                className="mt-4 h-96 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <div className="text-base font-semibold text-slate-900">使用教程</div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>拖拽或选择一个 <code className="font-mono">.xmind</code> 文件（文件仅在本地浏览器解析，不会上传）。</li>
            <li>如果文件包含多个 Sheet，可在上方下拉框切换。</li>
            <li>Canvas 支持：点击节点选中、点击 +/- 折叠展开、拖拽平移、滚轮缩放、双击自适应。</li>
            <li>在左侧「节点编辑」中可改标题、增删节点；支持撤销/重做；编辑会自动保存为本地草稿。</li>
            <li>在「大纲预览」中复制或下载 Markdown，方便粘贴到 Obsidian/Notion/飞书文档等。</li>
          </ol>
        </div>

        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <div className="text-base font-semibold text-slate-900">兼容性与常见问题</div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div>
                  <div className="font-semibold text-slate-900">支持格式</div>
                  <div className="mt-1 text-slate-600">
                    支持 <code className="font-mono">content.json</code>（较新 XMind）与 <code className="font-mono">content.xml</code>（较旧 XMind 8/Classic）。
                    若仍提示无法解析，可尝试在 XMind 中另存为兼容格式后再打开。
                  </div>
                </div>
            <div>
              <div className="font-semibold text-slate-900">为什么看不到内容？</div>
              <div className="mt-1 text-slate-600">
                可能是文件格式较旧、或压缩包内缺少 <code className="font-mono">content.json</code>。你可以先查看左侧「压缩包条目」确认包含哪些文件。
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">隐私说明</div>
              <div className="mt-1 text-slate-600">解析与渲染在本地完成，页面不上传思维导图内容。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
