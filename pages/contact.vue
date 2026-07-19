<template>
  <div
    v-html="content"
    class="container p-3"
  ></div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const { shortTitle } = useAppConfig();
const content = ref<string>(`<h2><strong>Contact Us for ${useAppConfig().shortTitle}</strong></h2>

<p>Last Updated: November 29, 2025</p>

<h2>1. Contact Us</h2>

<p>If you have any questions, please contact us at:</p>

<p><strong>Email:</strong> ${shortTitle}@${shortTitle}.com</p>`);

usePageSeo({
  canonicalPath: "/contact/",
  title: `Contact Tools`,
  seoDescription: `Reach the Tools Team For Submissions, Partnership Requests, Or Updates To Our Curated Tool Listings.`,
  keywords: ["contact", "support"],
});
</script>

<style scoped>
.container * {
  all: revert;
}
</style>

