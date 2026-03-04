"use client";

import type { ChangeEvent } from "react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOptionalToolConfig } from "../../../components/ToolConfigProvider";
import XmindMindMapCanvas from "./XmindMindMapCanvas";
import type { ViewStateBundle, XmindMindMapCanvasHandle } from "./XmindMindMapCanvas";
import { getTheme, themes } from "./themes";
import type {
  MindMapBoundary,
  MindMapLayoutMode,
  MindMapNode,
  MindMapRelationship,
  MindMapSheet,
  MindMapThemeId,
} from "./types";

type TopicNode = {
  id?: string;
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
  relationships?: MindMapRelationship[];
  boundaries?: MindMapBoundary[];
  [key: string]: unknown;
};

type ParsedXmind = {
  entries: string[];
  sheets: Sheet[];
  source: string | null;
  parseErrorKey:
    | "invalid_zip"
    | "content_json_parse_failed"
    | "content_json_sheet_not_found"
    | "content_xml_parse_failed"
    | "content_entry_not_found"
    | null;
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
const DEFAULT_DROP_REPLACE_HINT = "支持拖拽新 .xmind 到此区域直接替换";
type XmindViewerUi = {
  untitled: string;
  newNode: string;
  centerTopic: string;
  sheetPrefix: string;
  newCanvasNamePrompt: string;
  renameCanvasPrompt: string;
  duplicateCanvasPrompt: string;
  copiedSuffix: string;
  keepOneCanvasAlert: string;
  deleteCanvasConfirm: string;
  fileExtHint: string;
  parseFailed: string;
  copied: string;
  copyFailed: string;
  exportPngFailed: string;
  exportSvgFailed: string;
  exportPdfFailed: string;
  expand: string;
  collapse: string;
  collapseAll: string;
  expandAll: string;
  openFile: string;
  dropTip: string;
  chooseFile: string;
  replaceFile: string;
  copyOutline: string;
  downloadOutline: string;
  clear: string;
  parsing: string;
  error: string;
  sheetTotalPrefix: string;
  sheetTotalSuffix: string;
  newCanvas: string;
  rename: string;
  duplicate: string;
  delete: string;
  layoutTitle: string;
  themeTitle: string;
  themePrefix: string;
  undo: string;
  redo: string;
  collapseExpand: string;
  exportPng: string;
  exportSvg: string;
  exportPdf: string;
  exportXmind: string;
  panelCanvas: string;
  panelLayout: string;
  panelTheme: string;
  panelExport: string;
  panelEdit: string;
  panelNode: string;
  relationTitle: string;
  relationTarget: string;
  relationLabel: string;
  relationAdd: string;
  relationRemove: string;
  relationEmpty: string;
  relationSelfBlocked: string;
  relationExists: string;
  boundaryTitle: string;
  boundaryLabel: string;
  boundaryAdd: string;
  boundaryRemove: string;
  create: string;
  moveUp: string;
  moveDown: string;
  nodeTitlePlaceholder: string;
  childNode: string;
  siblingNode: string;
  currentNode: string;
  noNodeSelected: string;
  nodeEditor: string;
  selectNodeTip: string;
  nodeTitleLabel: string;
  inputNodeTitle: string;
  addChildNode: string;
  addSiblingNode: string;
  deleteNode: string;
  rootNodeTip: string;
  nodeEditTip: string;
  fileInfo: string;
  fileName: string;
  fileSize: string;
  fileStatus: string;
  statusParsing: string;
  statusFailed: string;
  statusParsed: string;
  statusIdle: string;
  zipEntries: string;
  parseSource: string;
  noteBlock: string;
  outlinePreview: string;
  currentSheet: string;
  outlinePlaceholder: string;
  tutorial: string;
  tutorial1: string;
  tutorial2: string;
  tutorial3: string;
  tutorial4: string;
  tutorial5: string;
  faq: string;
  faqFormat: string;
  faqFormatDesc: string;
  faqNoContent: string;
  faqNoContentDesc: string;
  privacy: string;
  privacyDesc: string;
  draftDetected: string;
  draftPrompt: string;
  restoreDraft: string;
  ignoreDraft: string;
  deleteDraft: string;
  layoutBalanced: string;
  layoutRight: string;
  layoutLeft: string;
  layoutUp: string;
  layoutDown: string;
  layoutDownCompact: string;
  layoutDownCompact2: string;
  parseErrors: {
    invalid_zip: string;
    content_json_parse_failed: string;
    content_json_sheet_not_found: string;
    content_xml_parse_failed: string;
    content_entry_not_found: string;
  };
};

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  return Boolean(
    element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']"),
  );
};

const normalizeEditorSheets = (sheets: MindMapSheet[]): MindMapSheet[] =>
  sheets.map((sheet) => ({
    ...sheet,
    themeId: (sheet as Partial<MindMapSheet>).themeId ?? "classicLight",
    relationships: normalizeRelationships((sheet as Partial<MindMapSheet>).relationships),
    boundaries: normalizeBoundaries((sheet as Partial<MindMapSheet>).boundaries),
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
    id: rawId ?? undefined,
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
): {
  layoutMode?: MindMapLayoutMode;
  themeId?: MindMapThemeId;
  relationships?: MindMapRelationship[];
  boundaries?: MindMapBoundary[];
} => {
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
      const relationships = normalizeRelationships(record.relationships);
      const boundaries = normalizeBoundaries(record.boundaries);
      return { layoutMode, themeId, relationships, boundaries };
    }
    if (isRecord(content)) {
      const layoutMode = typeof content.layoutMode === "string" ? (content.layoutMode as MindMapLayoutMode) : undefined;
      const themeId = typeof content.themeId === "string" ? (content.themeId as MindMapThemeId) : undefined;
      const relationships = normalizeRelationships(content.relationships);
      const boundaries = normalizeBoundaries(content.boundaries);
      return { layoutMode, themeId, relationships, boundaries };
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
    const { layoutMode, themeId, relationships: extensionRelationships, boundaries: extensionBoundaries } = rootRef
      ? extractAtoolsExtensionData(rootRef, topicsById)
      : {};
    const legacyThemeId = typeof sheetRecord.atoolsThemeId === "string" ? (sheetRecord.atoolsThemeId as MindMapThemeId) : undefined;
    const legacyLayoutMode =
      typeof sheetRecord.structureClass === "string" && sheetRecord.structureClass.startsWith("atools:layout:")
        ? (sheetRecord.structureClass.slice("atools:layout:".length) as MindMapLayoutMode)
        : undefined;
    const relationships = normalizeRelationships(sheetRecord.relationships);
    const boundaries = normalizeBoundaries(sheetRecord.boundaries);

    return {
      title,
      rootTopic,
      relationships: relationships.length > 0 ? relationships : extensionRelationships ?? [],
      boundaries: boundaries.length > 0 ? boundaries : extensionBoundaries ?? [],
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
    id: topicEl.getAttribute("id") ?? undefined,
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

const normalizeRelationships = (value: unknown): MindMapRelationship[] => {
  if (!Array.isArray(value)) return [];
  const result: MindMapRelationship[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) continue;
    const fromId =
      typeof item.end1Id === "string"
        ? item.end1Id
        : typeof item.fromId === "string"
          ? item.fromId
          : typeof item.sourceId === "string"
            ? item.sourceId
            : "";
    const toId =
      typeof item.end2Id === "string"
        ? item.end2Id
        : typeof item.toId === "string"
          ? item.toId
          : typeof item.targetId === "string"
            ? item.targetId
            : "";
    if (!fromId || !toId || fromId === toId) continue;
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : `${fromId}:${toId}:${index}`;
    const title =
      typeof item.title === "string"
        ? item.title
        : typeof item.label === "string"
          ? item.label
          : undefined;
    result.push({ id, fromId, toId, title: title?.trim() || undefined });
  }
  return result;
};

const normalizeBoundaries = (value: unknown): MindMapBoundary[] => {
  if (!Array.isArray(value)) return [];
  const result: MindMapBoundary[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) continue;
    const nodeId =
      typeof item.nodeId === "string"
        ? item.nodeId
        : typeof item.topicId === "string"
          ? item.topicId
          : typeof item.targetId === "string"
            ? item.targetId
            : "";
    if (!nodeId) continue;
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : `boundary:${nodeId}:${index}`;
    const title =
      typeof item.title === "string"
        ? item.title
        : typeof item.name === "string"
          ? item.name
          : typeof item.label === "string"
            ? item.label
            : undefined;
    result.push({ id, nodeId, title: title?.trim() || undefined });
  }
  return result;
};

const collectNodeIds = (node: MindMapNode | null): Set<string> => {
  const ids = new Set<string>();
  const walk = (current: MindMapNode | null) => {
    if (!current) return;
    ids.add(current.id);
    for (const child of current.children) walk(child);
  };
  walk(node);
  return ids;
};

const filterRelationshipsByNodeIds = (
  relationships: MindMapRelationship[] | undefined,
  nodeIds: Set<string>,
): MindMapRelationship[] => {
  if (!relationships || relationships.length === 0) return [];
  return relationships.filter(
    (relation) =>
      relation.fromId !== relation.toId &&
      nodeIds.has(relation.fromId) &&
      nodeIds.has(relation.toId),
  );
};

const filterBoundariesByNodeIds = (
  boundaries: MindMapBoundary[] | undefined,
  nodeIds: Set<string>,
): MindMapBoundary[] => {
  if (!boundaries || boundaries.length === 0) return [];
  return boundaries.filter((boundary) => nodeIds.has(boundary.nodeId));
};

const topicNodeToMindMapNode = (topic: TopicNode, createId: () => string): MindMapNode => {
  const attached = topic.children?.attached ?? [];
  const detached = topic.children?.detached ?? [];
  const children = [...attached, ...detached].map((child) => topicNodeToMindMapNode(child, createId));

  return {
    id: topic.id ?? createId(),
    title: (topic.title ?? "").trim() || "(无标题)",
    labels: topic.labels && topic.labels.length > 0 ? [...topic.labels] : undefined,
    notes: topic.notes?.plain?.content ? { plain: { content: topic.notes.plain.content } } : undefined,
    children,
    collapsed: Boolean(topic.collapsed),
  };
};

const cloneMindMapNodeWithNewIds = (
  node: MindMapNode,
  createId: () => string,
  idMap: Map<string, string>,
): MindMapNode => {
  const nextId = createId();
  idMap.set(node.id, nextId);
  return {
    ...node,
    id: nextId,
    children: node.children.map((child) => cloneMindMapNodeWithNewIds(child, createId, idMap)),
  };
};

const remapRelationships = (
  relationships: MindMapRelationship[] | undefined,
  idMap: Map<string, string>,
): MindMapRelationship[] => {
  if (!relationships || relationships.length === 0) return [];
  const remapped: MindMapRelationship[] = [];
  for (const relation of relationships) {
    const fromId = idMap.get(relation.fromId);
    const toId = idMap.get(relation.toId);
    if (!fromId || !toId || fromId === toId) continue;
    remapped.push({
      ...relation,
      id: `${fromId}:${toId}:${relation.id}`,
      fromId,
      toId,
    });
  }
  return remapped;
};

const remapBoundaries = (
  boundaries: MindMapBoundary[] | undefined,
  idMap: Map<string, string>,
): MindMapBoundary[] => {
  if (!boundaries || boundaries.length === 0) return [];
  const remapped: MindMapBoundary[] = [];
  for (const boundary of boundaries) {
    const nodeId = idMap.get(boundary.nodeId);
    if (!nodeId) continue;
    remapped.push({
      ...boundary,
      id: `${nodeId}:${boundary.id}`,
      nodeId,
    });
  }
  return remapped;
};

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
    const rootTopic = createNodeWithTitle(createId(), "中心主题");
    return [
      {
        id: createId(),
        title: "Sheet 1",
        rootTopic,
        layoutMode: "balanced",
        themeId: "classicLight",
        relationships: [],
        boundaries: [],
      },
    ];
  }

  return sheets.map((sheet, index) => {
    const rootTopic = sheet.rootTopic
      ? topicNodeToMindMapNode(sheet.rootTopic, createId)
      : createNodeWithTitle(createId(), "中心主题");
    const nodeIds = collectNodeIds(rootTopic);
    const rawRelationships = normalizeRelationships((sheet as Record<string, unknown>).relationships);
    const rawBoundaries = normalizeBoundaries((sheet as Record<string, unknown>).boundaries);
    return {
      id: createId(),
      title: extractSheetTitle(sheet, index),
      rootTopic,
      layoutMode:
        typeof (sheet as Record<string, unknown>).atoolsLayoutMode === "string"
          ? ((sheet as Record<string, unknown>).atoolsLayoutMode as MindMapLayoutMode)
          : structureClassToLayoutMode(sheet.structureClass),
      themeId:
        typeof (sheet as Record<string, unknown>).atoolsThemeId === "string"
          ? ((sheet as Record<string, unknown>).atoolsThemeId as MindMapThemeId)
          : "classicLight",
      relationships: filterRelationshipsByNodeIds(rawRelationships, nodeIds),
      boundaries: filterBoundariesByNodeIds(rawBoundaries, nodeIds),
    };
  });
};

const parseXmind = async (file: File): Promise<ParsedXmind> => {
  const raw = new Uint8Array(await file.arrayBuffer());
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(raw);
  } catch {
    return { entries: [], sheets: [], source: null, parseErrorKey: "invalid_zip" };
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
        parseErrorKey: "content_json_parse_failed",
      };
    }
    const topicsById = buildTopicsById(parsed);
    const normalizedSheets = normalizeSheetsFromContentJson(parsed, topicsById);
    const sheets =
      normalizedSheets.length > 0
      ? normalizedSheets
        : asSheets(parsed).map((sheet, index) => {
            const rootRef = extractRootTopicRef(sheet);
            const { layoutMode, themeId, relationships: extensionRelationships, boundaries: extensionBoundaries } =
              rootRef ? extractAtoolsExtensionData(rootRef, topicsById) : {};
            const sheetRecord = sheet as Record<string, unknown>;
            const relationships = normalizeRelationships(sheetRecord.relationships);
            const boundaries = normalizeBoundaries(sheetRecord.boundaries);
            return {
              title: extractSheetTitle(sheet, index),
              rootTopic: rootRef ? toTopicNode(rootRef, topicsById, new Set()) : { title: "中心主题" },
              relationships: relationships.length > 0 ? relationships : extensionRelationships ?? [],
              boundaries: boundaries.length > 0 ? boundaries : extensionBoundaries ?? [],
              structureClass:
                typeof (sheet as Sheet).structureClass === "string" ? (sheet as Sheet).structureClass : undefined,
              atoolsLayoutMode: layoutMode,
              atoolsThemeId: themeId,
            };
          });
    if (sheets.length === 0) {
      return {
        entries: entryNames,
        sheets: [],
        source: contentJsonKey,
        parseErrorKey: "content_json_sheet_not_found",
      };
    }
    return { entries: entryNames, sheets, source: contentJsonKey, parseErrorKey: null };
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
        parseErrorKey: "content_xml_parse_failed",
      };
    }
    return { entries: entryNames, sheets, source: contentXmlKey, parseErrorKey: null };
  }

  return {
    entries: entryNames,
    sheets: [],
    source: null,
    parseErrorKey: "content_entry_not_found",
  };
};

export default function XmindViewerClient() {
  const providedConfig = useOptionalToolConfig("xmind-viewer");
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
  const [relationTargetId, setRelationTargetId] = useState("");
  const [relationTitleInput, setRelationTitleInput] = useState("");
  const [boundaryTitleInput, setBoundaryTitleInput] = useState("");
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
  const ui = useMemo(() => providedConfig?.ui as XmindViewerUi, [providedConfig?.ui]);

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
  const selectedNodeBoundary = useMemo(() => {
    if (!activeSheet?.boundaries || !selectedNodeId) return null;
    return activeSheet.boundaries.find((boundary) => boundary.nodeId === selectedNodeId) ?? null;
  }, [activeSheet?.boundaries, selectedNodeId]);

  const nodeTitleById = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (node: MindMapNode | null) => {
      if (!node) return;
      map.set(node.id, node.title || ui.untitled);
      for (const child of node.children) walk(child);
    };
    walk(activeSheet?.rootTopic ?? null);
    return map;
  }, [activeSheet?.rootTopic, ui.untitled]);

  const relationTargetOptions = useMemo(() => {
    if (!activeSheet?.rootTopic || !selectedNodeId) return [];
    const options: Array<{ id: string; title: string }> = [];
    const walk = (node: MindMapNode) => {
      if (node.id !== selectedNodeId) options.push({ id: node.id, title: node.title || ui.untitled });
      for (const child of node.children) walk(child);
    };
    walk(activeSheet.rootTopic);
    return options;
  }, [activeSheet?.rootTopic, selectedNodeId, ui.untitled]);

  const selectedNodeRelationships = useMemo(() => {
    if (!activeSheet?.relationships || !selectedNodeId) return [];
    return activeSheet.relationships
      .filter((relation) => relation.fromId === selectedNodeId || relation.toId === selectedNodeId)
      .map((relation) => {
        const targetId = relation.fromId === selectedNodeId ? relation.toId : relation.fromId;
        return {
          ...relation,
          targetId,
          targetTitle: nodeTitleById.get(targetId) ?? ui.untitled,
        };
      });
  }, [activeSheet?.relationships, nodeTitleById, selectedNodeId, ui.untitled]);

  const relationExists = useMemo(() => {
    if (!activeSheet?.relationships || !selectedNodeId || !relationTargetId) return false;
    return activeSheet.relationships.some(
      (relation) =>
        (relation.fromId === selectedNodeId && relation.toId === relationTargetId) ||
        (relation.fromId === relationTargetId && relation.toId === selectedNodeId),
    );
  }, [activeSheet?.relationships, relationTargetId, selectedNodeId]);

  const relationGuardText = useMemo(() => {
    if (!selectedNodeId || !relationTargetId) return "";
    if (selectedNodeId === relationTargetId) return ui.relationSelfBlocked;
    if (relationExists) return ui.relationExists;
    return "";
  }, [relationExists, relationTargetId, selectedNodeId, ui.relationExists, ui.relationSelfBlocked]);

  const collapseAction = useMemo(() => {
    if (!activeSheet?.rootTopic) return null;
    const canToggleSelected = Boolean(selectedNodeId && selectedNodeHasChildren);
    if (canToggleSelected) {
      return {
        label: selectedNode?.collapsed ? ui.expand : ui.collapse,
        mode: "selected" as const,
      };
    }

    const shouldCollapse = hasAnyExpandedBranch(activeSheet.rootTopic);
    return {
      label: shouldCollapse ? ui.collapseAll : ui.expandAll,
      mode: shouldCollapse ? ("collapse-all" as const) : ("expand-all" as const),
    };
  }, [activeSheet?.rootTopic, selectedNode?.collapsed, selectedNodeHasChildren, selectedNodeId, ui.collapse, ui.collapseAll, ui.expand, ui.expandAll]);

  const outline = useMemo(() => {
    if (!activeSheet?.rootTopic) return "";
    const lines: string[] = [];
    lines.push(`# ${activeSheet.title.trim() || "Sheet"}`);
    lines.push(...mindMapNodeToLines(activeSheet.rootTopic, 0));
    const text = lines.join("\n").trim();
    return text.replaceAll("(无标题)", ui.untitled);
  }, [activeSheet, ui.untitled]);

  useEffect(() => {
    setEditingTitle(selectedNode?.title ?? "");
    titleEditSessionRef.current = { nodeId: selectedNode?.id ?? null, hasPushedHistory: false };
    setRelationTargetId("");
    setRelationTitleInput("");
    setBoundaryTitleInput(selectedNodeBoundary?.title ?? "");
  }, [selectedNode?.id, selectedNode?.title, selectedNodeBoundary?.id, selectedNodeBoundary?.title]);

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
    const defaultTitle = `${ui.sheetPrefix} ${editorSheets.length + 1}`;
    const rawTitle = window.prompt(ui.newCanvasNamePrompt, defaultTitle);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    const nextSheet: MindMapSheet = {
      id: createId(),
      title,
      rootTopic: createNodeWithTitle(createId(), ui.centerTopic),
      layoutMode: activeSheet?.layoutMode ?? "balanced",
      themeId: activeSheet?.themeId ?? "classicLight",
      relationships: [],
      boundaries: [],
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
    ui.centerTopic,
    ui.newCanvasNamePrompt,
    ui.sheetPrefix,
    switchActiveSheet,
  ]);

  const renameActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    const current = editorSheets.find((sheet) => sheet.id === activeSheetId);
    if (!current) return;
    const rawTitle = window.prompt(ui.renameCanvasPrompt, current.title);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    setEditorSheets((prev) => prev.map((sheet) => (sheet.id === activeSheetId ? { ...sheet, title } : sheet)));
  }, [activeSheetId, editorSheets, pushHistory, selectedNodeId, ui.renameCanvasPrompt]);

  const duplicateActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    const current = editorSheets.find((sheet) => sheet.id === activeSheetId);
    if (!current) return;

    const nextTitle = `${current.title}${ui.copiedSuffix}`;
    const rawTitle = window.prompt(ui.duplicateCanvasPrompt, nextTitle);
    if (!rawTitle) return;
    const title = rawTitle.trim();
    if (!title) return;

    const idMap = new Map<string, string>();
    const clonedRoot = current.rootTopic
      ? cloneMindMapNodeWithNewIds(current.rootTopic, createId, idMap)
      : createNodeWithTitle(createId(), ui.centerTopic);
    const nextSheet: MindMapSheet = {
      ...current,
      id: createId(),
      title,
      rootTopic: clonedRoot,
      themeId: current.themeId ?? "classicLight",
      relationships: remapRelationships(current.relationships, idMap),
      boundaries: remapBoundaries(current.boundaries, idMap),
    };

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    setEditorSheets((prev) => [...prev, nextSheet]);
    switchActiveSheet(nextSheet.id);
    setSelectedNodeId(nextSheet.rootTopic?.id ?? null);
  }, [activeSheetId, createId, editorSheets, pushHistory, selectedNodeId, switchActiveSheet, ui.centerTopic, ui.copiedSuffix, ui.duplicateCanvasPrompt]);

  const deleteActiveSheet = useCallback(() => {
    if (!activeSheetId) return;
    if (editorSheets.length <= 1) {
      window.alert(ui.keepOneCanvasAlert);
      return;
    }
    const sheet = editorSheets.find((item) => item.id === activeSheetId);
    if (!sheet) return;
    const ok = window.confirm(`${ui.deleteCanvasConfirm} "${sheet.title}"?`);
    if (!ok) return;

    pushHistory({ sheets: editorSheets, activeSheetId, selectedNodeId });
    const nextSheets = editorSheets.filter((item) => item.id !== activeSheetId);
    setEditorSheets(nextSheets);

    const nextActive = nextSheets[Math.max(0, activeSheetIndex - 1)] ?? nextSheets[0] ?? null;
    const nextActiveId = nextActive?.id ?? null;
    switchActiveSheet(nextActiveId);
    setSelectedNodeId(nextActive?.rootTopic?.id ?? null);
  }, [activeSheetId, activeSheetIndex, editorSheets, pushHistory, selectedNodeId, switchActiveSheet, ui.deleteCanvasConfirm, ui.keepOneCanvasAlert]);

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
        children: [...node.children, createNodeWithTitle(nextId, ui.newNode)],
      }));
      return { ...sheet, rootTopic: nextRoot };
    });
    setSelectedNodeId(nextId);
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, createId, selectedNodeId, ui.newNode]);

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
        nextChildren.splice(insertIndex, 0, createNodeWithTitle(nextId, ui.newNode));
        return { ...parentNode, collapsed: false, children: nextChildren };
      });
      return { ...sheet, rootTopic: nextRoot };
    });

    setSelectedNodeId(nextId);
  }, [activeSheet?.rootTopic, applyActiveSheetUpdate, createId, selectedNodeId, ui.newNode]);

  const deleteSelectedNode = useCallback(() => {
    if (!activeSheet?.rootTopic || !selectedNodeId) return;
    if (activeSheet.rootTopic.id === selectedNodeId) return;
    let nextSelectedId: string | null = null;

    applyActiveSheetUpdate((sheet) => {
      if (!sheet.rootTopic) return sheet;
      const result = removeNodeById(sheet.rootTopic, selectedNodeId);
      if (!result.removed) return sheet;
      nextSelectedId = result.parentId ?? sheet.rootTopic.id;
      const nodeIds = collectNodeIds(result.node);
      return {
        ...sheet,
        rootTopic: result.node,
        relationships: filterRelationshipsByNodeIds(sheet.relationships, nodeIds),
        boundaries: filterBoundariesByNodeIds(sheet.boundaries, nodeIds),
      };
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

  const addRelationship = useCallback(() => {
    if (!selectedNodeId || !relationTargetId || selectedNodeId === relationTargetId) return;
    const normalizedTitle = relationTitleInput.trim() || undefined;

    applyActiveSheetUpdate((sheet) => {
      const existing = sheet.relationships ?? [];
      const duplicate = existing.some(
        (relation) =>
          (relation.fromId === selectedNodeId && relation.toId === relationTargetId) ||
          (relation.fromId === relationTargetId && relation.toId === selectedNodeId),
      );
      if (duplicate) return sheet;
      return {
        ...sheet,
        relationships: [
          ...existing,
          {
            id: createId(),
            fromId: selectedNodeId,
            toId: relationTargetId,
            title: normalizedTitle,
          },
        ],
      };
    });

    setRelationTargetId("");
    setRelationTitleInput("");
  }, [applyActiveSheetUpdate, createId, relationTargetId, relationTitleInput, selectedNodeId]);

  const removeRelationship = useCallback(
    (relationId: string) => {
      applyActiveSheetUpdate((sheet) => ({
        ...sheet,
        relationships: (sheet.relationships ?? []).filter((relation) => relation.id !== relationId),
      }));
    },
    [applyActiveSheetUpdate],
  );

  const addBoundary = useCallback(() => {
    if (!selectedNodeId || selectedNodeBoundary) return;
    const normalizedTitle = boundaryTitleInput.trim() || undefined;
    applyActiveSheetUpdate((sheet) => {
      const boundaries = sheet.boundaries ?? [];
      if (boundaries.some((boundary) => boundary.nodeId === selectedNodeId)) return sheet;
      return {
        ...sheet,
        boundaries: [
          ...boundaries,
          {
            id: createId(),
            nodeId: selectedNodeId,
            title: normalizedTitle,
          },
        ],
      };
    });
  }, [applyActiveSheetUpdate, boundaryTitleInput, createId, selectedNodeBoundary, selectedNodeId]);

  const updateBoundaryTitle = useCallback(() => {
    if (!selectedNodeId || !selectedNodeBoundary) return;
    const normalizedTitle = boundaryTitleInput.trim() || undefined;
    const currentTitle = selectedNodeBoundary.title?.trim() || undefined;
    if (currentTitle === normalizedTitle) return;
    applyActiveSheetUpdate((sheet) => {
      const boundaries = sheet.boundaries ?? [];
      let changed = false;
      const nextBoundaries = boundaries.map((boundary) => {
        if (boundary.nodeId !== selectedNodeId) return boundary;
        const previousTitle = boundary.title?.trim() || undefined;
        if (previousTitle === normalizedTitle) return boundary;
        changed = true;
        return { ...boundary, title: normalizedTitle };
      });
      if (!changed) return sheet;
      return { ...sheet, boundaries: nextBoundaries };
    });
  }, [applyActiveSheetUpdate, boundaryTitleInput, selectedNodeBoundary, selectedNodeId]);

  const removeBoundary = useCallback(() => {
    if (!selectedNodeId || !selectedNodeBoundary) return;
    applyActiveSheetUpdate((sheet) => {
      const boundaries = sheet.boundaries ?? [];
      const nextBoundaries = boundaries.filter((boundary) => boundary.nodeId !== selectedNodeId);
      if (nextBoundaries.length === boundaries.length) return sheet;
      return { ...sheet, boundaries: nextBoundaries };
    });
    setBoundaryTitleInput("");
  }, [applyActiveSheetUpdate, selectedNodeBoundary, selectedNodeId]);

  useEffect(() => {
    if (editorSheets.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const hasMod = event.metaKey || event.ctrlKey;
      const canvas = canvasHandleRef.current;

      if (hasMod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          if (canRedo) redo();
        } else if (canUndo) {
          undo();
        }
        return;
      }

      if (hasMod && key === "y") {
        event.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (hasMod && (key === "=" || key === "+")) {
        event.preventDefault();
        canvas?.zoomByFactor(1.1);
        return;
      }

      if (hasMod && key === "-") {
        event.preventDefault();
        canvas?.zoomByFactor(0.9);
        return;
      }

      if (hasMod && key === "0") {
        event.preventDefault();
        canvas?.fitToView();
        return;
      }

      if (hasMod && event.shiftKey && key === "f") {
        event.preventDefault();
        canvas?.toggleFullscreen();
        return;
      }

      if (event.repeat && (key === "tab" || key === "enter" || key === "delete" || key === "backspace")) return;

      if (key === "tab") {
        event.preventDefault();
        addChildNode();
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        addSiblingNode();
        return;
      }

      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        deleteSelectedNode();
        return;
      }

      if (key === " ") {
        event.preventDefault();
        runCollapseAction();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addChildNode,
    addSiblingNode,
    canRedo,
    canUndo,
    deleteSelectedNode,
    editorSheets.length,
    redo,
    runCollapseAction,
    undo,
  ]);

  const runParse = async (selected: File) => {
    const looksLikeXmind = /\.xmind$/i.test(selected.name);
    if (!looksLikeXmind) {
      setError(ui.fileExtHint);
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
      if (next.parseErrorKey) {
        setError(ui.parseErrors[next.parseErrorKey]);
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
      setError(err instanceof Error ? err.message : ui.parseFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await runParse(selected);
    e.target.value = "";
  };

  const openFilePicker = () => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const copy = async () => {
    if (!outline) return;
    try {
      await navigator.clipboard.writeText(outline);
      setCopyHint(ui.copied);
    } catch {
      setCopyHint(ui.copyFailed);
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
      setError(err instanceof Error ? err.message : ui.exportPngFailed);
    }
  }, [activeSheet, exportBaseName, ui.exportPngFailed]);

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
      setError(err instanceof Error ? err.message : ui.exportSvgFailed);
    }
  }, [activeSheet, exportBaseName, ui.exportSvgFailed]);

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
      setError(err instanceof Error ? err.message : ui.exportPdfFailed);
    }
  }, [activeSheet, exportBaseName, ui.exportPdfFailed]);

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
        const extensionPayload = {
          version: 1,
          layoutMode: options.sheet.layoutMode,
          themeId: options.sheet.themeId,
          relationships: (options.sheet.relationships ?? []).map((relation) => ({
            id: relation.id,
            fromId: relation.fromId,
            toId: relation.toId,
            title: relation.title ?? "",
          })),
          boundaries: (options.sheet.boundaries ?? []).map((boundary) => ({
            id: boundary.id,
            nodeId: boundary.nodeId,
            title: boundary.title ?? "",
          })),
        };
        topic.extensions = [
          {
            provider: ATTOOLS_EXTENSION_PROVIDER,
            content: JSON.stringify(extensionPayload),
          },
        ];
      }

      return topic;
    };

    const content = sheets.map((sheet) => ({
      id: sheet.id,
      title: sheet.title,
      rootTopic: sheet.rootTopic ? nodeToXmindTopic(sheet.rootTopic, { isRoot: true, sheet }) : { id: createZipId(), title: "中心主题" },
      relationships: (sheet.relationships ?? []).map((relation) => ({
        id: relation.id || createZipId(),
        end1Id: relation.fromId,
        end2Id: relation.toId,
        title: relation.title ?? "",
        style: createStyle(),
      })),
      boundaries: (sheet.boundaries ?? []).map((boundary) => ({
        id: boundary.id || createZipId(),
        nodeId: boundary.nodeId,
        title: boundary.title ?? "",
      })),
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
                <div className="text-sm font-semibold text-amber-900">{ui.draftDetected}</div>
                <div className="mt-1 text-xs text-amber-800">{ui.draftPrompt}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  {ui.restoreDraft}
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatus("dismissed")}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
                >
                  {ui.ignoreDraft}
                </button>
                <button
                  type="button"
                  onClick={deleteDraft}
                  className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  {ui.deleteDraft}
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
              <div className="text-sm font-semibold text-slate-900">{ui.openFile}</div>
              <div className="mt-1 text-xs text-slate-500">{ui.dropTip || DEFAULT_DROP_REPLACE_HINT}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {file ? ui.replaceFile : ui.chooseFile}
              </button>
              <button
                type="button"
                disabled={!outline}
                onClick={() => void copy()}
                className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {ui.copyOutline}
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
                {ui.downloadOutline}
              </button>
              <button
                type="button"
                disabled={!file && !parsed}
                onClick={clear}
                className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {ui.clear}
              </button>
              <input ref={inputRef} type="file" accept=".xmind" className="hidden" onChange={onChange} />
            </div>
          </div>

          {(isLoading || error || copyHint) && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              {isLoading && <div className="text-slate-600">{ui.parsing}</div>}
              {copyHint && <div className="text-slate-600" aria-live="polite">{copyHint}</div>}
              {error && (
                <div className="text-rose-600" aria-live="polite">
                  {ui.error}: {error}
                </div>
              )}
            </div>
          )}
        </div>

        {editorSheets.length > 0 && activeSheet && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 ring-1 ring-slate-200">
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{ui.sheetTotalPrefix}</span>{" "}
              <span className="text-slate-500">
                ({editorSheets.length}
                {ui.sheetTotalSuffix ? ` ${ui.sheetTotalSuffix}` : ""})
              </span>
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
                {ui.newCanvas}
              </button>
              <button
                type="button"
                onClick={renameActiveSheet}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                {ui.rename}
              </button>
              <button
                type="button"
                onClick={duplicateActiveSheet}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                {ui.duplicate}
              </button>
              <button
                type="button"
                onClick={deleteActiveSheet}
                disabled={editorSheets.length <= 1}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60"
              >
                {ui.delete}
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
                title={ui.layoutTitle}
              >
                <option value="balanced">{ui.layoutBalanced}</option>
                <option value="right">{ui.layoutRight}</option>
                <option value="left">{ui.layoutLeft}</option>
                <option value="up">{ui.layoutUp}</option>
                <option value="down">{ui.layoutDown}</option>
                <option value="downCompact">{ui.layoutDownCompact}</option>
                <option value="downCompact2">{ui.layoutDownCompact2}</option>
              </select>

              <select
                value={activeSheet.themeId}
                onChange={(e) => setSheetTheme(e.target.value as MindMapThemeId)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                title={ui.themeTitle}
              >
                {Object.values(themes).map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {ui.themePrefix}: {theme.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {ui.undo}
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {ui.redo}
              </button>
              <button
                type="button"
                disabled={!collapseAction}
                onClick={runCollapseAction}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {collapseAction?.label ?? ui.collapseExpand}
              </button>

              <button
                type="button"
                onClick={() => void exportPng()}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {ui.exportPng}
              </button>
              <button
                type="button"
                onClick={exportSvg}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {ui.exportSvg}
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {ui.exportPdf}
              </button>
              <button
                type="button"
                onClick={exportXmind}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {ui.exportXmind}
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
            relationships={activeSheet?.relationships ?? []}
            boundaries={activeSheet?.boundaries ?? []}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onToggleCollapse={toggleCollapse}
            onMoveNode={moveNode}
            viewResetKey={canvasViewResetKey}
            isEnglish={providedConfig?.lang?.toLowerCase().startsWith("en") ?? false}
            fullscreenSidebar={
              activeSheet ? (
                <div className="space-y-3">
                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">{ui.panelCanvas}</div>
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
                        {ui.create}
                      </button>
                      <button
                        type="button"
                        onClick={renameActiveSheet}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200"
                      >
                        {ui.rename}
                      </button>
                      <button
                        type="button"
                        onClick={duplicateActiveSheet}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200"
                      >
                        {ui.duplicate}
                      </button>
                      <button
                        type="button"
                        onClick={deleteActiveSheet}
                        disabled={editorSheets.length <= 1}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        {ui.delete}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActiveSheet(-1)}
                        disabled={activeSheetIndex <= 0}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.moveUp}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActiveSheet(1)}
                        disabled={activeSheetIndex < 0 || activeSheetIndex >= editorSheets.length - 1}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.moveDown}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">{ui.panelLayout}</div>
                    <select
                      value={activeSheet.layoutMode}
                      onChange={(e) => setSheetLayout(e.target.value as MindMapLayoutMode)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                      title={ui.layoutTitle}
                    >
                      <option value="balanced">{ui.layoutBalanced}</option>
                      <option value="right">{ui.layoutRight}</option>
                      <option value="left">{ui.layoutLeft}</option>
                      <option value="up">{ui.layoutUp}</option>
                      <option value="down">{ui.layoutDown}</option>
                      <option value="downCompact">{ui.layoutDownCompact}</option>
                      <option value="downCompact2">{ui.layoutDownCompact2}</option>
                    </select>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">{ui.panelTheme}</div>
                    <select
                      value={activeSheet.themeId}
                      onChange={(e) => setSheetTheme(e.target.value as MindMapThemeId)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none"
                      title={ui.themeTitle}
                    >
                      {Object.values(themes).map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">{ui.panelExport}</div>
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
                    <div className="text-xs font-semibold text-slate-700">{ui.panelEdit}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={!canUndo}
                        onClick={undo}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.undo}
                      </button>
                      <button
                        type="button"
                        disabled={!canRedo}
                        onClick={redo}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.redo}
                      </button>
                      <button
                        type="button"
                        disabled={!collapseAction}
                        onClick={runCollapseAction}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {collapseAction?.label ?? ui.collapseExpand}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold text-slate-700">{ui.panelNode}</div>
                    <input
                      value={editingTitle}
                      onChange={(event) => {
                        const nextTitle = event.target.value;
                        setEditingTitle(nextTitle);
                        updateSelectedNodeTitle(nextTitle);
                      }}
                      onBlur={() => {
                        const normalized = editingTitle.trim() || ui.untitled;
                        if (normalized !== editingTitle) {
                          setEditingTitle(normalized);
                          updateSelectedNodeTitle(normalized);
                        }
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none"
                      placeholder={ui.nodeTitlePlaceholder}
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={addChildNode}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        {ui.childNode}
                      </button>
                      <button
                        type="button"
                        onClick={addSiblingNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.siblingNode}
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        {ui.delete}
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {selectedNode ? `${ui.currentNode}: ${selectedNode.title.slice(0, 30)}` : ui.noNodeSelected}
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <div className="text-[11px] font-semibold text-slate-700">{ui.boundaryTitle}</div>
                      <input
                        value={boundaryTitleInput}
                        onChange={(event) => setBoundaryTitleInput(event.target.value)}
                        onBlur={updateBoundaryTitle}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none"
                        placeholder={ui.boundaryLabel}
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={addBoundary}
                          disabled={!selectedNodeId || Boolean(selectedNodeBoundary)}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {ui.boundaryAdd}
                        </button>
                        <button
                          type="button"
                          onClick={removeBoundary}
                          disabled={!selectedNodeBoundary}
                          className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          {ui.boundaryRemove}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
                      <div className="text-[11px] font-semibold text-slate-700">{ui.relationTitle}</div>
                      <select
                        value={relationTargetId}
                        onChange={(event) => setRelationTargetId(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none"
                      >
                        <option value="">{ui.relationTarget}</option>
                        {relationTargetOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.title.slice(0, 60)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={relationTitleInput}
                        onChange={(event) => setRelationTitleInput(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none"
                        placeholder={ui.relationLabel}
                      />
                      <button
                        type="button"
                        onClick={addRelationship}
                        disabled={!relationTargetId || relationExists}
                        className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {ui.relationAdd}
                      </button>
                      {relationGuardText ? <div className="mt-1 text-[11px] text-amber-700">{relationGuardText}</div> : null}
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
                <div className="text-sm font-semibold text-slate-900">{ui.nodeEditor}</div>
                {!selectedNode ? (
                  <div className="mt-3 text-sm text-slate-500">{ui.selectNodeTip}</div>
                ) : (
                  <>
                    <label className="mt-3 block text-xs font-semibold text-slate-700">
                      {ui.nodeTitleLabel}
                      <input
                        value={editingTitle}
                        onChange={(event) => {
                          const nextTitle = event.target.value;
                          setEditingTitle(nextTitle);
                          updateSelectedNodeTitle(nextTitle);
                        }}
                        onBlur={() => {
                          const normalized = editingTitle.trim() || ui.untitled;
                          if (normalized !== editingTitle) {
                            setEditingTitle(normalized);
                            updateSelectedNodeTitle(normalized);
                          }
                        }}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none"
                        placeholder={ui.inputNodeTitle}
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={addChildNode}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {ui.addChildNode}
                      </button>
                      <button
                        type="button"
                        onClick={addSiblingNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                      >
                        {ui.addSiblingNode}
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
                        {selectedNode.collapsed ? ui.expand : ui.collapse}
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNode}
                        disabled={selectedNodeIsRoot}
                        className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        {ui.deleteNode}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">{ui.boundaryTitle}</div>
                      <div className="mt-2 grid gap-2">
                        <input
                          value={boundaryTitleInput}
                          onChange={(event) => setBoundaryTitleInput(event.target.value)}
                          onBlur={updateBoundaryTitle}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                          placeholder={ui.boundaryLabel}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={addBoundary}
                            disabled={!selectedNodeId || Boolean(selectedNodeBoundary)}
                            className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            {ui.boundaryAdd}
                          </button>
                          <button
                            type="button"
                            onClick={removeBoundary}
                            disabled={!selectedNodeBoundary}
                            className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            {ui.boundaryRemove}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">{ui.relationTitle}</div>
                      <div className="mt-2 grid gap-2">
                        <select
                          value={relationTargetId}
                          onChange={(event) => setRelationTargetId(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                        >
                          <option value="">{ui.relationTarget}</option>
                          {relationTargetOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title.slice(0, 80)}
                            </option>
                          ))}
                        </select>
                        <input
                          value={relationTitleInput}
                          onChange={(event) => setRelationTitleInput(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                          placeholder={ui.relationLabel}
                        />
                        <button
                          type="button"
                          onClick={addRelationship}
                          disabled={!relationTargetId || relationExists}
                          className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {ui.relationAdd}
                        </button>
                        {relationGuardText ? <div className="text-xs text-amber-700">{relationGuardText}</div> : null}
                      </div>

                      <div className="mt-3 space-y-2">
                        {selectedNodeRelationships.length === 0 ? (
                          <div className="text-xs text-slate-500">{ui.relationEmpty}</div>
                        ) : (
                          selectedNodeRelationships.map((relation) => (
                            <div
                              key={relation.id}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900">{relation.targetTitle}</div>
                                {relation.title ? <div className="truncate text-slate-500">{relation.title}</div> : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeRelationship(relation.id)}
                                className="rounded-xl bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              >
                                {ui.relationRemove}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      {selectedNodeIsRoot ? ui.rootNodeTip : ui.nodeEditTip}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">{ui.fileInfo}</div>
              <div className="mt-3 text-sm text-slate-700">
                <div>{ui.fileName}: {file?.name ?? "-"}</div>
                <div className="mt-1">{ui.fileSize}: {file ? formatBytes(file.size) : "-"}</div>
                <div className="mt-1">
                  {ui.fileStatus}: {isLoading ? ui.statusParsing : error ? ui.statusFailed : parsed ? ui.statusParsed : ui.statusIdle}
                </div>
              </div>
              {parsed && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-900">{ui.zipEntries}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {ui.parseSource}: <code className="font-mono">{parsed.source ?? "-"}</code>
                  </div>
                  <div className="mt-2 max-h-44 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                    {parsed.entries.join("\n")}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 text-xs text-slate-500">
              {ui.noteBlock}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{ui.outlinePreview}</div>
                <div className="text-xs text-slate-500">
                  {activeSheet ? `${ui.currentSheet}: ${activeSheet.title}` : "-"}
                </div>
              </div>
              <textarea
                value={outline}
                readOnly
                placeholder={ui.outlinePlaceholder}
                className="mt-4 h-96 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <div className="text-base font-semibold text-slate-900">{ui.tutorial}</div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>{ui.tutorial1}</li>
            <li>{ui.tutorial2}</li>
            <li>{ui.tutorial3}</li>
            <li>{ui.tutorial4}</li>
            <li>{ui.tutorial5}</li>
          </ol>
        </div>

        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
          <div className="text-base font-semibold text-slate-900">{ui.faq}</div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div>
                  <div className="font-semibold text-slate-900">{ui.faqFormat}</div>
                  <div className="mt-1 text-slate-600">{ui.faqFormatDesc}</div>
                </div>
            <div>
              <div className="font-semibold text-slate-900">{ui.faqNoContent}</div>
              <div className="mt-1 text-slate-600">{ui.faqNoContentDesc}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">{ui.privacy}</div>
              <div className="mt-1 text-slate-600">{ui.privacyDesc}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
