import { UISchema } from "../schemas/uiSchema.js";
import { UI_SYSTEM_PROMPT } from "../prompts/uiPrompts.js";
import { getStructuredModel } from "../../../../utils/model.js";
import { tryExecuteMock } from "../../../../utils/mock.js";
import { withRetry } from "../../../../utils/retry.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function uiNode(state: any) {
  // 1. 获取模型
  const structuredModel = getStructuredModel(UISchema);

  // 2. 准备上下文
  // 核心依赖：Capabilities (逻辑骨架)
  const capabilities = state.capabilities;

  if (!capabilities) {
    console.warn("UINode: No capability data found, skipping.");
    return { ui: null };
  }

  // 辅助依赖：Intent (产品目标) 和 Analysis (视觉偏好)
  const intentContext = state.intent
    ? JSON.stringify(state.intent, null, 2)
    : "未提供";
  const analysisContext = state.analysis
    ? JSON.stringify(state.analysis, null, 2)
    : "未提供";

  const capabilityContext = JSON.stringify(capabilities, null, 2);

  // 视觉分析结果：有图片输入时，UI 架构必须优先遵循设计稿结构
  const imageAnalysisContext = state.imageAnalysis
    ? `
【设计稿视觉分析（Qwen-VL 输出，最高优先级 - 必须遵循）】
${JSON.stringify(state.imageAnalysis, null, 2)}

⚠️ 重要：如果上方视觉分析与 Capability 规划有冲突，以视觉分析为准。
必须继承视觉分析中的：页面类型、layoutShell、sections 顺序、主要组件、主色、背景色、文字密度、fidelityNotes。
禁止把截图风格改写成通用模板风格；只能在截图未覆盖的细节上合理补全。
`
    : "";

  // 3. 构建 Prompt
  const humanPrompt = `
请基于以下信息生成 UI 架构设计：

【Intent (产品意图)】
${intentContext}

【Capabilities (技术能力规划)】
${capabilityContext}

【Analysis (视觉/设计分析)】
${analysisContext}
${imageAnalysisContext}
`;

  const messages = [
    new SystemMessage(UI_SYSTEM_PROMPT),
    new HumanMessage(humanPrompt),
  ];

  // 4. 调用模型
  // MOCK MODE Handling
  const mockResult = await tryExecuteMock(
    state,
    "uiNode",
    "uiResult.json",
    "ui",
  );
  if (mockResult) return mockResult;

  console.log("--- UI Architecture Analysis Head Start ---");

  // 使用带错误反馈的重试机制（自定义错误提示以强调 role 枚举值）
  const result = await withRetry(structuredModel, messages, {
    maxRetries: 3,
    onRetry: (attempt, error) => {
      console.warn(`[UINode] Retry attempt ${attempt} due to:`, error.message);
    },
    formatErrorFeedback: (error) =>
      `⚠️ 上一次生成失败，错误信息：\n${error.message}\n\n请仔细检查并修正以下问题：\n1. 确保所有 section 的 role 字段只使用合法枚举值：navigation, filter, list, detail, editor, dashboard, form\n2. 确保所有组件的 type 字段只使用 Schema 定义的组件类型\n3. 确保 JSON 格式正确，没有遗漏必填字段\n\n请重新生成正确的 JSON：`,
  });

  console.log("--- UI Architecture Analysis End ---");

  return {
    ui: result,
  };
}
