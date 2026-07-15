/**
 * 图片请求路由适配器
 *
 * 当用户上传 UI 截图时匹配此路由，进入 Traditional 流程。
 * Traditional 图会通过条件边自动调度 imageAnalysisNode（Qwen-VL 视觉分析）。
 */

import type { RouteInputAdapter } from "./routeTypes.js";
import { hasImageAttachment } from "./routeHelpers.js";

export const imageRouteAdapter: RouteInputAdapter = {
  name: "image-route",
  priority: 80,
  canHandle: ({ messages }) => hasImageAttachment(messages),
  adapt: async ({ messages, mockConfig }) => {
    console.log("[RouteAdapter] Matched: image-route → Traditional + Vision");
    return {
      flow: "traditional",
      input: { messages, mockConfig },
      meta: { routeType: "image" },
    };
  },
};
