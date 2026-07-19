<template>
  <footer
    class="text-center text-[12px]! p-3 flex flex-col items-center gap-2"
    style="zoom: 0.8"
  >
    <div class="flex flex-wrap items-center justify-center gap-1">
      <span>© {{ COPYRIGHT_YEAR }}</span>
      <MA class="font-bold">{{ h1Title }}</MA>
      <span>. All rights reserved.</span>
    </div>
    <nav
      aria-label="Legal and support links"
      class="flex flex-wrap items-center justify-center gap-2"
    >
      <MA
        v-for="({ name, path }, index) in footerMenu"
        :key="index"
        :href="path"
        class="link link-hover"
      >
        {{ name }}
      </MA>
      <button
        class="link link-hover"
        type="button"
        @click="openPreferences"
      >
        Cookie Settings
      </button>
    </nav>
    <MA
      :href="REWARD_URL"
      class="font-bold link link-hover"
      :title="REWARD_TEXT"
    >
      {{ REWARD_TEXT }}
    </MA>
  </footer>
</template>

<script lang="ts" setup>
import { REWARD_TEXT, REWARD_URL } from "~/utils/reward";
import { footerMenu } from "~/utils/menu";
import { COPYRIGHT_YEAR } from "~/utils/legal";

const { h1Title } = useAppConfig();
const { openPreferences } = useCookieConsent();
</script>

<style scoped></style>
