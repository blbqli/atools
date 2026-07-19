import { flattenMenu, menu, countStringOccurrences } from "@/utils";

/** 获取每种分类的总和 */
export default defineEventHandler(async (event): Promise<LabelValue[]> => {
  const { tags = [] } = await readBody<{
    tags: string[];
  }>(event);
  const flatTags = flattenMenu(menu)
    .map((item) => item.tags || [])
    .flat();
  const count = countStringOccurrences(flatTags);
  const result = tags.map((item) => {
    const countItem = count.find((countItem) => countItem.label === item);
    return {
      label: item,
      value: countItem?.value || 0,
    };
  });
  return result;
});
