<template>
  <MOpenIframe
    :seoTitle="seoTitle"
    :iframeUrl="iframeUrl"
  />
  <article
    class="bg-base-100 p-3 m-3 mb-0 rounded-[var(--radius-box)] flex-1 flex flex-col gap-4 shadow-sm"
    itemscope
    itemtype="https://schema.org/SoftwareApplication"
  >
    <div class="flex flex-wrap items-center gap-3">
      <input
        id="png-upload"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif"
        class="hidden"
        @change="handleFileChange"
      />
      <label
        class="btn btn-info btn-sm"
        for="png-upload"
      >
        Upload Image
      </label>
      <button
        class="btn btn-secondary btn-sm"
        :disabled="!state.convertedUrl || state.converting"
        @click="handleDownload"
      >
        Download {{ state.targetFormat.toUpperCase() }}
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="!state.originalUrl"
        @click="handleReset"
      >
        Clear
      </button>
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-base-content/70">Quality</span>
        <input
          class="range range-xs w-32"
          type="range"
          min="50"
          max="100"
          step="5"
          v-model.number="state.quality"
          :disabled="!state.originalUrl || state.targetFormat !== 'jpg'"
        />
        <span class="text-xs w-10 text-right">{{ state.quality }}%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-base-content/70">Background</span>
        <input
          type="color"
          class="w-10 h-8 rounded border border-base-300 bg-base-100"
          v-model="state.background"
          :disabled="!state.originalUrl || state.targetFormat !== 'jpg'"
          aria-label="Background color"
        />
        <button
          class="btn btn-ghost btn-xs"
          :disabled="!state.originalUrl || state.targetFormat !== 'jpg'"
          @click="setBackground('#ffffff')"
        >
          White
        </button>
        <button
          class="btn btn-ghost btn-xs"
          :disabled="!state.originalUrl || state.targetFormat !== 'jpg'"
          @click="setBackground('#000000')"
        >
          Black
        </button>
        <button
          class="btn btn-ghost btn-xs"
          :disabled="!state.originalUrl || state.targetFormat !== 'jpg'"
          @click="setBackground('#f8fafc')"
        >
          Light
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-base-content/70">Convert To</span>
        <div class="join join-horizontal">
          <button
            class="btn btn-sm join-item"
            :class="state.targetFormat === 'jpg' ? 'btn-primary' : 'btn-outline'"
            :disabled="!state.originalUrl"
            @click="setTargetFormat('jpg')"
          >
            JPG
          </button>
          <button
            class="btn btn-sm join-item"
            :class="state.targetFormat === 'png' ? 'btn-primary' : 'btn-outline'"
            :disabled="!state.originalUrl"
            @click="setTargetFormat('png')"
          >
            PNG
          </button>
        </div>
      </div>
    </div>
    <div class="flex gap-3 flex-1 flex-wrap">
      <div
        class="rounded-[var(--radius-box)] flex-1 p-3 border border-dashed border-base-300 min-h-[260px] min-w-[260px] flex items-center justify-center bg-base-200/40"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <template v-if="state.originalUrl">
          <img
            :src="state.originalUrl"
            alt="Uploaded image preview"
            class="max-h-[360px] object-contain rounded-lg"
            loading="lazy"
            decoding="async"
          />
        </template>
        <div
          v-else
          class="text-center text-sm text-base-content/70 space-y-2 px-4"
        >
          <p>
            Drop an image here or click
            <span class="font-semibold">Upload Image</span>.
          </p>
          <p class="text-xs">
            Transparent pixels will be filled with your chosen background when saving as JPG.
          </p>
        </div>
      </div>
      <div
        class="rounded-[var(--radius-box)] flex-1 p-3 border border-dashed border-base-300 min-h-[260px] min-w-[260px] flex items-center justify-center bg-base-200/40"
      >
        <template v-if="state.converting">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </template>
        <template v-else-if="state.convertedUrl">
          <img
            :src="state.convertedUrl"
            :alt="`${state.targetFormat.toUpperCase()} preview`"
            class="max-h-[360px] object-contain rounded-lg"
            loading="lazy"
            decoding="async"
          />
        </template>
        <div
          v-else
          class="text-center text-sm text-base-content/70 space-y-2 px-4"
        >
          <p>Converted {{ state.targetFormat.toUpperCase() }} preview will appear here.</p>
          <p class="text-xs">Adjust quality (JPG) or switch format to PNG.</p>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3 text-xs text-base-content/70">
      <span v-if="state.fileName">File: {{ state.fileName }}.{{ state.targetFormat }}</span>
      <span v-if="state.convertedSize">Size: {{ state.convertedSize }}</span>
      <span
        v-if="state.error"
        class="text-error"
      >
        {{ state.error }}
      </span>
    </div>
  </article>
  <div
    class="bg-base-100 p-3 m-3 rounded-[var(--radius-box)] flex flex-col gap-3"
    itemprop="about"
  >
    <h2
      class="text-lg font-bold leading-tight"
      itemprop="name"
    >
      {{ seoTitle }}
    </h2>
    <p
      class="text-sm text-base-content/70"
      itemprop="description"
    >
      {{ seoDescription }}
    </p>
    <ul class="list-disc pl-4 text-xs text-base-content/70 space-y-1">
      <li>Browser-side conversion only - files never leave your device.</li>
      <li>Quality slider applies to JPG output; PNG keeps lossless detail.</li>
      <li>Drag-and-drop or click upload; PNG, JPG, WEBP and more are accepted.</li>
      <li>Switch between JPG and PNG with one click, then press Convert.</li>
      <li>Transparent backgrounds fill with the chosen color when exporting JPG.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const tool = flattenMenu(menu).find((item) => item.name === "png-to-jpg");
const {
  seoTitle = "",
  seoDescription = "",
  seoKeywords = [],
  path = "",
  iframeUrl = "",
} = tool || {};

const currentFile = ref<File | null>(null);
const state = reactive({
  originalUrl: "",
  convertedUrl: "",
  convertedSize: "",
  fileName: "converted-image",
  quality: 90,
  converting: false,
  error: "",
  targetFormat: "jpg" as "jpg" | "png",
  background: "#ffffff",
});

let originalObjectUrl: string | null = null;
let convertedObjectUrl: string | null = null;
let conversionToken = 0;
let qualityTimer: ReturnType<typeof setTimeout> | null = null;

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const [file] = Array.from(target.files || []);
  if (file) {
    await loadFile(file);
  }
  if (target) {
    target.value = "";
  }
};

const handleDrop = async (event: DragEvent) => {
  const [file] = Array.from(event.dataTransfer?.files || []);
  if (file) {
    await loadFile(file);
  }
};

const loadFile = async (file: File) => {
  state.error = "";
  if (!file.type.startsWith("image/")) {
    state.error = "Please choose an image file and try again.";
    return;
  }

  currentFile.value = file;
  state.fileName = file.name.replace(/\.[^/.]+$/, "") || "converted-image";
  revokeOriginalUrl();
  revokeConvertedUrl();

  originalObjectUrl = URL.createObjectURL(file);
  state.originalUrl = originalObjectUrl;

  await renderImage();
};

const renderImage = async () => {
  if (!currentFile.value || !originalObjectUrl) return;
  const token = ++conversionToken;
  state.converting = true;
  state.error = "";

  try {
    const img = await loadImage(originalObjectUrl);
    const canvas = document.createElement("canvas");
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error("Could not read image dimensions.");
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas is not supported in this browser.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (state.targetFormat === "jpg") {
      ctx.fillStyle = state.background || "#ffffff";
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = state.targetFormat === "jpg" ? "image/jpeg" : "image/png";
    const qualityOption = state.targetFormat === "jpg" ? state.quality / 100 : undefined;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) {
            resolve(value);
          } else {
            reject(new Error("Conversion failed, please try again."));
          }
        },
        mimeType,
        qualityOption,
      );
    });

    if (token !== conversionToken) {
      return;
    }

    revokeConvertedUrl();
    convertedObjectUrl = URL.createObjectURL(blob);
    state.convertedUrl = convertedObjectUrl;
    state.convertedSize = `${Math.max(1, Math.round(blob.size / 1024))} KB`;
  } catch (error: any) {
    if (token === conversionToken) {
      state.error = error?.message || "Conversion failed, please pick another image.";
    }
  } finally {
    if (token === conversionToken) {
      state.converting = false;
    }
  }
};

const loadImage = (src: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
};

const handleDownload = () => {
  if (!state.convertedUrl) return;

  const link = document.createElement("a");
  link.href = state.convertedUrl;
  link.download = `${state.fileName || "converted-image"}.${state.targetFormat}`;
  link.click();
};

const handleReset = () => {
  state.originalUrl = "";
  state.convertedUrl = "";
  state.convertedSize = "";
  state.error = "";
  state.fileName = "converted-image";
  state.targetFormat = "jpg";
  state.background = "#ffffff";
  currentFile.value = null;
  revokeOriginalUrl();
  revokeConvertedUrl();
};

const setBackground = (value: string) => {
  state.background = value;
};

const setTargetFormat = (format: "jpg" | "png") => {
  state.targetFormat = format;
  if (currentFile.value) {
    renderImage();
  }
};

const revokeOriginalUrl = () => {
  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = null;
  }
};

const revokeConvertedUrl = () => {
  if (convertedObjectUrl) {
    URL.revokeObjectURL(convertedObjectUrl);
    convertedObjectUrl = null;
  }
};

watch(
  () => state.quality,
  () => {
    if (qualityTimer) {
      clearTimeout(qualityTimer);
    }
    if (currentFile.value && state.targetFormat === "jpg") {
      qualityTimer = setTimeout(() => {
        renderImage();
      }, 200);
    }
  },
);

watch(
  () => state.background,
  () => {
    if (currentFile.value && state.targetFormat === "jpg") {
      renderImage();
    }
  },
);

watch(
  () => state.targetFormat,
  () => {
    if (currentFile.value) {
      renderImage();
    }
  },
);

onBeforeUnmount(() => {
  revokeOriginalUrl();
  revokeConvertedUrl();
});

usePageSeo({
  canonicalPath: path,
  title: seoTitle,
  seoDescription,
  keywords: seoKeywords,
});
</script>

<style scoped></style>

