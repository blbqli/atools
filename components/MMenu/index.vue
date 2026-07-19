<template>
  <ul class="menu flex-nowrap! menu-md bg-base-200 rounded-none p-3! capitalize">
    <li
      v-for="({ name, path, icon }, index) in headerMenu"
      :key="index"
    >
      <MA
        :href="getHref({ path, name })"
        class="font-bold gap-3"
      >
        {{ icon }} {{ name }}
      </MA>
    </li>
    <li
      v-for="({ icon: icon1, name: name1, path: path1, children: children1 }, index1) in [
        ...articles,
        ...menu,
      ]"
      :key="index1"
    >
      <MA
        v-if="!children1"
        :href="getHref({ path: path1, name: name1 })"
        target="_blank"
      >
        {{ name1 }}
      </MA>
      <details
        open
        v-else
      >
        <summary>
          <div class="flex items-center justify-start gap-3">
            <div class="font-bold flex items-center gap-3 line-clamp-1 break-all">
              {{ icon1 }} {{ name1 }}
            </div>
            <div class="badge badge-secondary badge-outline">{{ children1.length || 0 }}</div>
          </div>
        </summary>
        <ul>
          <li
            v-for="({ name: name2, path: path2, icon: icon2 }, index2) in children1"
            :key="index2"
          >
            <MA
              :href="getHref({ path: path2, name: name2 })"
              target="_blank"
            >
              <div class="line-clamp-1 break-all">{{ icon2 }} {{ name2 }}</div>
            </MA>
          </li>
        </ul>
      </details>
    </li>
    <li
      v-for="({ name, path, icon }, index) in footerMenu"
      :key="index"
    >
      <MA
        target="_blank"
        :href="getHref({ path, name })"
        class="font-bold gap-3 flex items-center line-clamp-1 break-all"
      >
        {{ icon }} {{ name }}
      </MA>
    </li>
  </ul>
</template>

<script lang="ts" setup>
const getHref = (value: Menu) => {
  const { name, path } = value;
  if (path) {
    return path;
  }
  if (name) {
    return `/detail/${name}`;
  }
  return "/";
};
</script>

<style scoped></style>
