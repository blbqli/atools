<template>
  <footer
    class="text-center text-[12px]! p-3 flex flex-col items-center gap-2"
    style="zoom: 0.8"
  >
    <div class="flex items-center justify-center gap-1">
      <span>© 2025</span>
      <MA class="font-bold">{{ h1Title }}</MA>
      <span>. All rights reserved.</span>
    </div>
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

const { h1Title } = useAppConfig();
</script>

<style scoped></style>
