<template>
  <MGrid class="gap-3 p-3">
    <div
      :key="index"
      class="card card-sm bg-base-100 image-full hover:scale-98 transition-all"
      v-for="({ name, description, backgroundColor, fontColor }, index) in themes"
    >
      <figure>
        <div
          :style="{ backgroundColor: backgroundColor }"
          class="w-full h-full"
        ></div>
      </figure>
      <div class="card-body">
        <h2
          class="card-title capitalize"
          :style="{ color: fontColor }"
        >
          {{ name }}
        </h2>
        <p
          :style="{ color: fontColor }"
          class="capitalize"
        >
          {{ description }}
        </p>
        <div class="card-actions justify-end">
          <button
            class="btn btn-primary btn-soft btn-sm"
            @click="handleChangeTheme(name)"
          >
            use
          </button>
        </div>
      </div>
    </div>
  </MGrid>
</template>

<script setup lang="ts">
import { themes } from "@/utils";

usePageSeo({
  canonicalPath: "/theme/",
  title: `Tools Theme Gallery: 35 Ready-to-Use Color Palettes - DaisyUI Themes`,
  seoDescription: `Preview 35 Ready-To-Use Color Palettes And DaisyUI Themes, Then Apply Them Instantly To Customize Your Tool Experience Across Our Platform.`,
  keywords: [
    "theme switcher",
    "daisyui themes",
    "color palettes for tools",
    "ready-to-use themes",
    "tool UI customization",
  ],
});

/**
 * 设置主题
 * @param theme 主题名字
 */
const handleChangeTheme = async (theme: string) => {
  localStorage.setItem("theme", theme);
  useHead({
    htmlAttrs: {
      "data-theme": theme,
    },
  });
};
</script>

<style></style>
