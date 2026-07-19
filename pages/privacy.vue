<template>
  <MLegalPage :content="legalContent.privacy" />
</template>

<script setup lang="ts">
import { createLegalContent, LEGAL_PAGE_SEO } from "~/utils/legal";

const { h1Title } = useAppConfig();
const legalContent = createLegalContent(h1Title);

usePageSeo(LEGAL_PAGE_SEO.privacy);
</script>
