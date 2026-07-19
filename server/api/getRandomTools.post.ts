import { getRandomElements } from "@/utils";

/** 随机选择一些工具 */
export default defineEventHandler(async (event): Promise<Menu[]> => {
  const { menu = [], count = 12 } = await readBody<{
    menu: Menu[];
    count: number;
  }>(event);
  const randomTools = getRandomElements(menu, count);
  return randomTools || [];
});
