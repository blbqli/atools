import type { Menu } from "./type";
import robot from "../articles/robot.json";
import ai from "../articles/ai.json";
import json from "../articles/json.json";
import harmonyos from "../articles/harmonyos.json";
import harmonyosEn from "../articles/harmonyos-en.json";
import tools from "../articles/tools.json";

export const articles: Menu[] = [
  {
    name: "Articles",
    children: [tools, json, robot, ai, harmonyos, harmonyosEn],
    icon: "📚",
  },
];

