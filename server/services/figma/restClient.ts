import { getModel } from "../../agents/utils/model.js";

interface FigmaUrlInfo {
  fileKey: string;
  nodeId?: string;
}

interface FigmaRestOptions {
  accessToken?: string;
}

const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

function extractText(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function safeName(name: unknown, fallback: string): string {
  if (typeof name !== "string" || !name.trim()) return fallback;
  return name.trim().replace(/[<>]/g, "");
}

function simplifyFigmaNode(node: any, depth = 0): any {
  if (!node || depth > 4) return undefined;

  const simplified: Record<string, any> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (node.characters) simplified.text = node.characters;
  if (node.absoluteBoundingBox) simplified.bounds = node.absoluteBoundingBox;
  if (node.layoutMode) simplified.layoutMode = node.layoutMode;
  if (node.primaryAxisAlignItems) {
    simplified.primaryAxisAlignItems = node.primaryAxisAlignItems;
  }
  if (node.counterAxisAlignItems) {
    simplified.counterAxisAlignItems = node.counterAxisAlignItems;
  }
  if (node.fills) simplified.fills = node.fills;
  if (node.strokes) simplified.strokes = node.strokes;
  if (node.cornerRadius) simplified.cornerRadius = node.cornerRadius;
  if (node.style) simplified.style = node.style;

  const children = Array.isArray(node.children) ? node.children.slice(0, 20) : [];
  if (children.length > 0) {
    simplified.children = children
      .map((child: any) => simplifyFigmaNode(child, depth + 1))
      .filter(Boolean);
  }

  return simplified;
}

function findFirstRenderableNode(node: any): any {
  if (!node) return undefined;

  if (["FRAME", "COMPONENT", "INSTANCE", "GROUP", "SECTION"].includes(node.type)) {
    return node;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const result = findFirstRenderableNode(child);
    if (result) return result;
  }

  return node;
}

export function parseFigmaUrl(figmaUrl: string): FigmaUrlInfo | null {
  try {
    const url = new URL(figmaUrl);

    if (!url.hostname.includes("figma.com")) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const fileTypeIndex = segments.findIndex((segment) =>
      ["file", "design", "proto"].includes(segment),
    );

    if (fileTypeIndex === -1 || !segments[fileTypeIndex + 1]) {
      return null;
    }

    const nodeId = url.searchParams.get("node-id")?.replace("-", ":");

    return {
      fileKey: segments[fileTypeIndex + 1],
      nodeId,
    };
  } catch {
    return null;
  }
}

export class FigmaRestClient {
  private accessToken: string;

  constructor(options: FigmaRestOptions = {}) {
    this.accessToken = options.accessToken || process.env.FIGMA_ACCESS_TOKEN || "";
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken);
  }

  async getGeneratedCode(figmaUrl: string): Promise<string> {
    const urlInfo = parseFigmaUrl(figmaUrl);
    if (!urlInfo) {
      throw new Error("无法解析 Figma 链接，请使用 figma.com 的 file/design/proto 链接");
    }

    if (!this.isConfigured()) {
      throw new Error(
        "缺少 FIGMA_ACCESS_TOKEN，无法通过 Figma REST API 读取网页链接",
      );
    }

    console.log("🌐 [FigmaREST] 正在通过 Figma REST API 获取设计数据...");
    console.log(`   fileKey: ${urlInfo.fileKey}`);
    console.log(`   nodeId: ${urlInfo.nodeId || "未指定，使用文件内首个可渲染节点"}`);

    const designNode = await this.fetchDesignNode(urlInfo);
    const simplifiedNode = simplifyFigmaNode(designNode);
    const model = getModel();

    const prompt = `你是一个资深前端工程师。请根据下面的 Figma 节点 JSON 生成一个可直接运行的 React + TypeScript + Tailwind 单文件组件。

要求：
1. 只输出代码，不要 Markdown 代码块，不要解释。
2. 使用 export default function App()。
3. 尽量还原布局、颜色、圆角、字号、间距和文案。
4. 不要依赖外部图片资源；如果遇到图片区域，用渐变、色块或占位 UI 表达。
5. 使用 Tailwind className 编写样式，必要时可使用内联 style 精确表达颜色和尺寸。
6. 代码必须包含 import React from "react";。

Figma 节点 JSON：
${JSON.stringify(simplifiedNode, null, 2)}`;

    const response = await model.invoke(prompt);
    const rawCode = extractText(response.content);

    if (!rawCode.trim()) {
      throw new Error("模型未能基于 Figma REST 数据生成代码");
    }

    const cleanedCode = rawCode
      .replace(/^```(?:tsx|typescript|jsx|javascript)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    console.log(
      `✅ [FigmaREST] 代码生成成功: ${cleanedCode.length.toLocaleString()} 字符, ${cleanedCode.split("\n").length} 行`,
    );

    return cleanedCode;
  }

  private async fetchDesignNode(urlInfo: FigmaUrlInfo): Promise<any> {
    if (urlInfo.nodeId) {
      const data = await this.request(
        `/files/${urlInfo.fileKey}/nodes?ids=${encodeURIComponent(urlInfo.nodeId)}`,
      );
      const nodeWrapper = data.nodes?.[urlInfo.nodeId];
      const document = nodeWrapper?.document;

      if (!document) {
        throw new Error(`Figma 文件中未找到 node-id: ${urlInfo.nodeId}`);
      }

      return document;
    }

    const data = await this.request(`/files/${urlInfo.fileKey}`);
    const document = data.document;
    const firstNode = findFirstRenderableNode(document);

    if (!firstNode) {
      throw new Error("Figma 文件中未找到可生成的设计节点");
    }

    return {
      ...firstNode,
      name: safeName(firstNode.name, data.name || "Figma Design"),
    };
  }

  private async request(path: string): Promise<any> {
    const response = await fetch(`${FIGMA_API_BASE_URL}${path}`, {
      headers: {
        "X-Figma-Token": this.accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Figma REST API 请求失败 (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    return response.json();
  }
}

export function getFigmaRestClient(): FigmaRestClient {
  return new FigmaRestClient();
}
