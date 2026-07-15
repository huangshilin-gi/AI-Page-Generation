/**
 * Figma 请求路由适配器
 */

import type { RouteInputAdapter } from "./routeTypes.js";
import { extractFigmaUrl } from "../shared/utils/figmaUrl.js";

export const figmaRouteAdapter: RouteInputAdapter = {
  name: "figma-route",
  priority: 100,
  canHandle: ({ messages }) => !!extractFigmaUrl(messages),
  adapt: async ({ messages }) => {
    const figmaUrl = extractFigmaUrl(messages)!;
    console.log(`[RouteAdapter] Matched: figma-route, url=${figmaUrl}`);
    return {
      flow: "figma",
      input: { messages, figmaUrl },
      meta: { figmaUrl },
    };
  },
};
