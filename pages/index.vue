<template>
  <div class="flex flex-row w-full h-full">
    <ul
      class="menu w-56 flex-nowrap overflow-auto hidden md:block"
      title="menu"
    >
      <li
        v-for="({ name = '', icon }, index) in menu"
        :key="index"
        :title="name"
        @click="handleActiveMenu(name)"
      >
        <div
          :title="name"
          :class="[activeMenuName === name ? 'menu-active' : '', name]"
        >
          <div class="line-clamp-1 break-all">{{ icon }} {{ name }}</div>
        </div>
      </li>
    </ul>
    <div
      class="flex flex-col gap-3 p-3 flex-1 overflow-auto scroll-smooth"
      id="home-top"
    >
      <div
        class="flex flex-col gap-3"
        v-for="({ name, icon, children = [] }, index) in menu"
        :key="index"
      >
        <MTools
          v-if="name === 'tools'"
          :id="name"
          class="scroll-mt-3"
          :tools="children"
        />
        <div
          v-else
          class="flex flex-col gap-3"
        >
          <div class="flex items-center justify-between gap-3 w-full">
            <MA
              class="scroll-mt-3"
              :href="`/category/${name}`"
              :id="name"
              :title="name"
            >
              <button
                class="btn btn-primary btn-soft"
                :title="name"
              >
                <div class="line-clamp-1 break-all">{{ icon }} {{ name }}</div>
              </button>
            </MA>
            <MA
              target="_blank"
              :href="`/category/${name}`"
              class="flex justify-between items-center"
            >
              <MFromIcon />
            </MA>
          </div>
          <MGrid>
            <MCard :data="children.slice(0, 8)" />
          </MGrid>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const activeMenuName = ref<string>(menu[0].name || "");

const handleActiveMenu = (name: string) => {
  activeMenuName.value = name;
  const leftMenu = document.getElementsByClassName(activeMenuName.value)?.[0] as any;
  leftMenu?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  const targetEl = document.getElementById(activeMenuName.value);
  targetEl?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

usePageSeo({
  canonicalPath: "/",
  title: `Tools Curated Resource Hub: 290+ AI & Productivity Tools`,
  seoDescription: `Discover 290+ Reliable Tools Across 37 Categories On Tools. Updated Daily With Trusted AI, Productivity, And Utility Resources.`,
  keywords: ["online tools", "ai tools", "productivity resources", "utility directory"],
});
</script>

<style scoped></style>

