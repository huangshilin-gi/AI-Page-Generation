/**
 * Step -1: 设计稿图片视觉分析节点
 *
 * 职责：
 * 1. 从用户消息中提取图片附件 URL
 * 2. 调用 Qwen-VL 视觉大模型进行 UI 结构化分析
 * 3. 将分析结果写入 state.imageAnalysis，供后续节点作为「视觉约束」
 *
 * 流程位置: START → imageAnalysisNode → analysisNode → ...
 * 上游: 用户上传的图片（OSS URL）
 * 下游: analysisNode, intentNode, uiNode, styleGenNode 等
 *
 * 注意：本节点仅在用户上传了图片时才会被调度（由 traditional.graph 条件边控制）
 */

import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ImageAnalysisSchema } from "../schemas/imageAnalysisSchema.js";
import {
  IMAGE_ANALYSIS_SYSTEM_PROMPT,
  buildImageAnalysisHumanPrompt,
} from "../prompts/imageAnalysisPrompts.js";
import { getVisionStructuredModel } from "../../../../utils/model.js";
import { tryExecuteMock } from "../../../../utils/mock.js";
import { withRetry } from "../../../../utils/retry.js";
import {
  extractImageUrlsFromMessages,
  hasImageInput,
} from "../../../../shared/utils/imageHelpers.js";

export const imageAnalysisNode = async (state: any) => {
  // ========== 1. 检查是否有图片输入 ==========
  const imageUrls = extractImageUrlsFromMessages(state.messages || []);

  if (!hasImageInput(state.messages || [])) {
    console.log("[ImageAnalysisNode] 无图片附件，跳过视觉分析");
    return {};
  }

  console.log("\n" + "=".repeat(60));
  console.log(`🖼️  [ImageAnalysisNode] 开始视觉分析，共 ${imageUrls.length} 张图片`);
  console.log("=".repeat(60));

  // ========== 2. Mock 模式 ==========
  const mockResult = await tryExecuteMock(
    state,
    "imageAnalysisNode",
    "imageAnalysisResult.json",
    "imageAnalysis",
  );
  if (mockResult) return mockResult;

  // ========== 3. 准备多模态消息 ==========
  // 提取用户附带的文字说明（如有）
  const lastMsg = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMsg?.content === "string" ? lastMsg.content.trim() : "";

  const humanText = buildImageAnalysisHumanPrompt({
    imageCount: imageUrls.length,
    userText: userText || undefined,
  });

  // LangChain 多模态消息格式：text + image_url
  const multimodalContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: humanText }];

  for (const url of imageUrls) {
    multimodalContent.push({
      type: "image_url",
      image_url: { url },
    });
  }

  const messages = [
    new SystemMessage(IMAGE_ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage({ content: multimodalContent }),
  ];

  // ========== 4. 调用 Qwen-VL 视觉模型 ==========
  const visionModel = getVisionStructuredModel(ImageAnalysisSchema);

  console.log("--- Image Vision Analysis Start ---");

  const result = await withRetry(visionModel, messages, {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      console.warn(
        `[ImageAnalysisNode] Retry attempt ${attempt} due to:`,
        error.message,
      );
    },
    formatErrorFeedback: (error) =>
      `⚠️ 视觉分析 JSON 解析失败：${error.message}\n请确保输出严格合法的 JSON，且所有 section.role / section.layout 使用规定的枚举值。`,
  });

  console.log("--- Image Vision Analysis End ---");
  console.log(
    `📊 [ImageAnalysisNode] 识别到 ${result.pages?.length || 0} 个页面，` +
      `${result.detectedTexts?.length || 0} 条文字`,
  );

  return {
    imageAnalysis: result,
  };
};
