import { AnalysisSchema } from "../schemas/analysisSchema.js";
import { ANALYSIS_SYSTEM_PROMPT } from "../prompts/analysisPrompts.js";
import { getStructuredModel } from "../../../../utils/model.js";
import { tryExecuteMock } from "../../../../utils/mock.js";
import { withRetry } from "../../../../utils/retry.js";
import { formatImageAnalysisSummary } from "../../../../shared/utils/imageHelpers.js";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";

/**
 * 将前端消息格式转换为 LangChain 消息对象
 *
 * 注意：
 * - 图片内容已由上游 imageAnalysisNode（Qwen-VL）完成结构化分析
 * - 本节点只处理文字部分，视觉信息通过 state.imageAnalysis 注入
 */
async function convertToLangChainMessages(
  rawMessages: any[],
): Promise<BaseMessage[]> {
  return rawMessages.map((msg) => {
    const textContent =
      typeof msg.content === "string" && msg.content.trim()
        ? msg.content
        : "用户上传了设计稿图片";

    if (msg.role === "user") {
      return new HumanMessage(textContent);
    } else {
      return new AIMessage(textContent);
    }
  });
}

export const analysisNode = async (state: any) => {
  const structuredModel = getStructuredModel(AnalysisSchema);

  let messages: BaseMessage[] = [];

  // 提取用户文字消息
  if (state.messages && Array.isArray(state.messages)) {
    const lastMsg = state.messages[state.messages.length - 1];
    messages = await convertToLangChainMessages([lastMsg]);
  }

  // 如果上游已完成视觉分析，将摘要注入 System Prompt 上下文
  const imageAnalysisContext = state.imageAnalysis
    ? `\n\n【上游视觉分析结果（已由 Qwen-VL 完成，请直接引用）】\n${formatImageAnalysisSummary(state.imageAnalysis)}`
    : "";

  const prompt = [
    new SystemMessage(ANALYSIS_SYSTEM_PROMPT + imageAnalysisContext),
    ...messages,
  ];

  console.log("\n📋 [AnalysisNode] 开始意图分析");
  if (state.imageAnalysis) {
    console.log("   ↳ 已接收上游视觉分析结果，将融合到 designAnalysis 字段");
  }

  // MOCK MODE Handling
  const mockResult = await tryExecuteMock(
    state,
    "analysisNode",
    "analysisResult.json",
    (data) => {
      // Mock 模式下，如果有视觉分析结果，补充 designAnalysis
      if (state.imageAnalysis && !data.designAnalysis) {
        return {
          analysis: {
            ...data,
            designAnalysis: formatImageAnalysisSummary(state.imageAnalysis),
          },
        };
      }
      return { analysis: data };
    },
  );
  if (mockResult) {
    return {
      ...mockResult,
      skipGeneration:
        mockResult.analysis?.type === "QA" ||
        mockResult.analysis?.type === "CHIT_CHAT",
    };
  }

  console.log("--- User Message Analysis Start ---");

  const result = await withRetry(structuredModel, prompt, {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      console.warn(
        `[AnalysisNode] Retry attempt ${attempt} due to:`,
        error.message,
      );
    },
  });

  // 兜底：如果模型未填充 designAnalysis 但上游有视觉分析，自动补充
  if (state.imageAnalysis && !result.designAnalysis) {
    result.designAnalysis = formatImageAnalysisSummary(state.imageAnalysis);
  }

  console.log("--- User Message Analysis End ---");
  console.log("📊 [AnalysisNode] 用户意图:", result.type);

  return {
    analysis: result,
    skipGeneration: result.type === "QA" || result.type === "CHIT_CHAT",
  };
};
