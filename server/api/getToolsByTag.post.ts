import { flattenMenu, menu, type Menu } from "@/utils";

/** 根据传入的tags找到对应的tools */
export default defineEventHandler(async (event): Promise<Menu[]> => {
  const { tags = [] } = await readBody<{
    tags: string[];
  }>(event);
  const flatTags = flattenMenu(menu);
  const result = (
    flatTags.filter((menuItem) => {
      return !!tags.find((item) => menuItem.tags?.includes(item));
    }) || []
  ).filter((item) => !!item);
  return result;
});
