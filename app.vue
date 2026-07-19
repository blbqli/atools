<template>
  <div class="w-full h-dvh flex flex-col">
    <MHeader />
    <main
      class="flex-1 w-full flex flex-col overflow-auto bg-base-200"
      id="app-top"
    >
      <NuxtPage />
    </main>
    <MFooter class="mt-auto" />
    <MBackTop />
  </div>
</template>

<script setup lang="ts"></script>

<style></style>

