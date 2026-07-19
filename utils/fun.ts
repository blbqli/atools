import path from "path";
import fs from "fs/promises";

/**
 * 读取 .output/public 下的所有一级文件夹，自动遍历其二级/三级目录，返回 URL 数组
 * @returns 静态资源 URL 数组（如 ['/', '/cate/sub1', '/tag/sub3', '/aboutus']）
 */
export const readPublicSubFolders = async (): Promise<string[]> => {
  const publicDir = path.resolve(process.cwd(), ".output/public");
  const urlList: string[] = [];

  try {
    // 读取 public 目录下的所有一级条目（文件/文件夹）
    const publicEntries = await fs.readdir(publicDir, { withFileTypes: true });
    // 筛选出所有一级文件夹（排除文件和隐藏目录，可选）
    const level1Folders = publicEntries
      .filter((entry) => entry.isDirectory())
      .filter((folder) => !folder.name.startsWith(".")); // 可选：排除隐藏目录（如 .git）

    if (level1Folders.length === 0) {
      console.warn(`.output/public 目录下无一级文件夹`);
      return ["/"]; // 仅返回根路径
    }

    // 遍历所有一级文件夹（原 targetFolders 的逻辑）
    for (const level1Folder of level1Folders) {
      const level1Path = path.join(publicDir, level1Folder.name);

      // 读取一级目录下的所有二级条目
      const level1Entries = await fs.readdir(level1Path, { withFileTypes: true });
      const level2Folders = level1Entries.filter((entry) => entry.isDirectory());

      if (level2Folders.length === 0) {
        // 无二级目录 → 保留一级目录 URL
        urlList.push(`/${level1Folder.name}`);
      } else {
        // 遍历所有二级目录
        for (const level2Folder of level2Folders) {
          const level2Path = path.join(level1Path, level2Folder.name);

          // 读取二级目录下的所有三级条目
          const level2Entries = await fs.readdir(level2Path, { withFileTypes: true });
          const level3Folders = level2Entries.filter((entry) => entry.isDirectory());

          if (level3Folders.length === 0) {
            // 无三级目录 → 保留二级目录 URL
            urlList.push(`/${level1Folder.name}/${level2Folder.name}`);
          } else {
            // 有三级目录 → 只保留三级目录 URL（不保留二级）
            for (const level3Folder of level3Folders) {
              urlList.push(`/${level1Folder.name}/${level2Folder.name}/${level3Folder.name}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`读取 .output/public 目录失败：`, error);
    return ["/"]; // 异常时仅返回根路径
  }

  // 拼接根路径并返回（去重处理，避免重复 URL）
  const backUrlList = Array.from(new Set(["/", ...urlList]));
  return backUrlList;
};

/**
 * 扁平数组
 * @param menu
 * @returns
 */
export const flattenMenu = (menu: Menu[]): Menu[] => {
  return menu.reduce((result, item) => {
    const { children, ...flatItem } = item;
    return [
      ...result,
      children ? undefined : flatItem,
      ...(children ? flattenMenu(children) : []),
    ].filter((item) => !!item);
  }, [] as Menu[]);
};

/**
 * 查找工具详情
 * @param toolName 工具 name
 * @returns
 */
export const getToolDetail = (toolName: string) => {
  const flatMenu = flattenMenu(menu);
  const toolDetail = flatMenu.find((item) => String(item.name) == toolName);
  return toolDetail;
};

/**
 * 获取对应的分类数据
 * @param category
 * @returns
 */
export const getToolsByCategory = (category: string) => {
  const tools = menu.find((item) => String(item.name) == category);
  return tools;
};

/**
 * 从数组中随机选择指定数量的元素
 * @param {Array<T>} arr - 源数组
 * @param {number} count - 需要随机选择的元素数量
 * @returns {Array<T>} - 随机选择的元素组成的新数组
 */
export const getRandomElements = <T>(arr: T[], count: number): T[] => {
  // 处理边界情况
  if (!Array.isArray(arr) || arr.length === 0 || count <= 0) {
    return [];
  }

  // 如果源数组长度小于等于需要选择的数量，直接返回源数组的副本
  if (arr.length <= count) {
    return [...arr];
  }

  // 使用Fisher-Yates洗牌算法随机排序数组的前count个元素
  const shuffled = [...arr];
  for (let i = 0; i < count; i++) {
    const randomIndex = i + Math.floor(Math.random() * (shuffled.length - i));
    // 交换当前元素与随机选择的元素
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  // 返回前count个元素
  return shuffled.slice(0, count);
};

/**
 * 计算字符串数组中每个元素的出现次数，并返回 label-value 格式数组
 * @param arr - 输入的字符串数组
 * @returns label-value 格式的统计结果数组
 * @throws {TypeError} 当输入不是数组时抛出错误
 */
export const countStringOccurrences = (arr: string[]): LabelValue[] => {
  // 输入类型校验（运行时校验，因为 TypeScript 编译后类型信息丢失）
  if (!Array.isArray(arr)) {
    throw new TypeError("输入必须是一个数组，且数组元素需为字符串类型");
  }

  // 统计次数的临时对象，键为字符串，值为数字
  const countRecord: Record<string, number> = {};

  // 遍历数组统计次数
  for (const str of arr) {
    // 运行时校验元素类型（可选，根据业务需求决定是否保留）
    if (typeof str !== "string") {
      console.warn(`元素 ${str} 不是字符串类型，已跳过统计`);
      continue;
    }
    // 累加计数，不存在则初始化为 0 后 +1
    countRecord[str] = (countRecord[str] || 0) + 1;
  }

  // 转换为 label-value 格式数组
  const result: LabelValue[] = Object.entries(countRecord).map(([label, value]) => ({
    label,
    value,
  }));

  return result;
};

/**
 * 单词首写字符大写
 * @param str
 * @returns
 */
export const filterStrUpperCase = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
