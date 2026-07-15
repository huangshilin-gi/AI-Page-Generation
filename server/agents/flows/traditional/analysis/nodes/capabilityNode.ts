import { CapabilitySchema } from "../schemas/capabilitySchema.js";
import { CAPABILITY_SYSTEM_PROMPT } from "../prompts/capabilityPrompts.js";
import { getStructuredModel } from "../../../../utils/model.js";
import { tryExecuteMock } from "../../../../utils/mock.js";
import { withRetry } from "../../../../utils/retry.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function capabilityNode(state: any) {
  // 1. 获取单例模型
  const structuredModel = getStructuredModel(CapabilitySchema);

  // 2. 准备上下文
  // 能力分析强依赖于 Intent 意图分析的结果
  const intentData = state.intent;

  if (!intentData) {
    console.warn("CapabilityNode: No intent data found, skipping.");
    return { capabilities: null };
  }

  const intentContext = JSON.stringify(intentData, null, 2);

  // 如果有视觉分析结果，作为能力规划的参考
  const imageContext = state.imageAnalysis
    ? `\n\n【设计稿视觉分析（请据此推断 pages / behaviors / dataModels）】\n${JSON.stringify(state.imageAnalysis, null, 2)}`
    : "";

  // 3. 构建消息
  const messages = [
    new SystemMessage(CAPABILITY_SYSTEM_PROMPT),
    new HumanMessage(
      `请基于以下产品意图进行能力分析：\n${intentContext}${imageContext}`,
    ),
  ];

  // 4. 调用模型
  // MOCK MODE Handling
  const mockResult = await tryExecuteMock(
    state,
    "capabilityNode",
    "capabilityResult.json",
    "capabilities",
  );
  if (mockResult) return mockResult;

  console.log("--- Capability Analysis Head Start ---");

  // 使用重试机制调用模型
  const result = await withRetry(structuredModel, messages, {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      console.warn(
        `[CapabilityNode] Retry attempt ${attempt} due to:`,
        error.message,
      );
    },
  });

  // console.log("Capability Result:", JSON.stringify(result, null, 2));
  console.log("--- Capability Analysis End ---");

  // 5. 返回更新后的状态
  return {
    capabilities: result,
  };
}
