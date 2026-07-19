<template>
  <MOpenIframe
    :seoTitle="seoTitle"
    :iframeUrl="iframeUrl"
  />
  <div class="flex flex-col gap-3 p-3 h-full">
    <div class="flex flex-wrap items-center gap-3 shrink-0">
      <button
        class="btn btn-primary btn-sm"
        @click="handleFormat"
      >
        Format JSON
      </button>
      <button
        class="btn btn-secondary btn-dash btn-sm"
        @click="handleMinify"
      >
        Minify JSON
      </button>
      <button
        class="btn btn-info btn-dash btn-sm"
        @click="handleSample"
      >
        Sample JSON
      </button>
      <button
        class="btn btn-success btn-dash btn-sm"
        @click="handleCopy()"
      >
        Copy Result
      </button>
      <button
        class="btn btn-error btn-dash btn-sm"
        @click="handleClear"
      >
        Clear
      </button>
    </div>
    <div class="flex-1 rounded-[var(--radius-box)] overflow-hidden bg-base-100">
      <ClientOnly
        fallback-tag="div"
        class="text-base-content"
        fallback="Loading editor..."
      >
        <Codemirror
          v-model="info.code"
          placeholder="Paste JSON here..."
          :autofocus="true"
          :style="{ height: '100%' }"
          class="code-rich"
          :indent-with-tab="true"
          :tabSize="4"
          :extensions="extensions"
        />
      </ClientOnly>
    </div>
    <div
      class="rounded-[var(--radius-box)] gap-1 flex flex-col shrink-0 bg-base-100 p-3 overflow-hidden"
    >
      <h2 class="font-bold">{{ seoTitle }}</h2>
      <p class="text-xs font-bold">{{ seoDescription }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from "vue";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import "@codemirror/search";
import "@codemirror/commands";

const extensions = markRaw([json()]);
const info = reactive({
  code: `{"service": "toolsbox","version": 1,"features": ["format", "minify", "validate"],"meta": { "updated": "2025-01-05T12:00:00Z" }}`,
  error: "",
  sampleJson: `{"service": "toolsbox","version": 1,"features": ["format", "minify", "validate"],"meta": { "updated": "2025-01-05T12:00:00Z" }}`,
});
const tool = flattenMenu(menu).find((item) => item.name === "json");
const {
  seoTitle = "",
  seoDescription = "",
  seoKeywords = [],
  path = "",
  iframeUrl = "",
} = tool || {};

/** 格式化 */
const handleFormat = () => {
  try {
    const parsed = JSON.parse(info.code);
    const pretty = JSON.stringify(parsed, null, 2);
    info.code = pretty;
    info.error = "";
  } catch (error) {
    info.error = "Invalid JSON input.";
  }
};

onMounted(() => {
  handleFormat();
});

/** 压缩 */
const handleMinify = () => {
  try {
    const parsed = JSON.parse(info.code);
    const minified = JSON.stringify(parsed);
    info.code = minified;
    info.error = "";
  } catch (error) {
    info.error = "Invalid JSON input.";
  }
};

/** 清空 */
const handleClear = () => {
  info.code = "";
  info.error = "";
};

/** 给一个json案例 */
const handleSample = () => {
  info.code = info.sampleJson;
  info.error = "";
  handleFormat();
};

/** 复制结果 */
const handleCopy = () => {
  navigator.clipboard.writeText(info.code);
};

usePageSeo({
  canonicalPath: path,
  title: seoTitle,
  seoDescription,
  keywords: seoKeywords,
});
</script>

<style scoped>
:deep .code-rich .cm-editor .cm-scroller .cm-gutters {
  background-color: var(--color-base-100) !important;
  border: none !important;
}

:deep .code-rich .cm-editor .cm-scroller .cm-content {
  padding: 0px !important;
}

:deep .code-rich .cm-editor .cm-scroller .cm-gutters .cm-gutter .cm-gutterElement {
  background-color: var(--color-base-100) !important;
  border: none !important;
}
</style>

