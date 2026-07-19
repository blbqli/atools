<template>
  <MLegalPage :content="legalContent.contact" />
</template>

<script setup lang="ts">
import { createLegalContent, LEGAL_PAGE_SEO } from "~/utils/legal";

const { h1Title } = useAppConfig();
const legalContent = createLegalContent(h1Title);

usePageSeo(LEGAL_PAGE_SEO.contact);
</script>
