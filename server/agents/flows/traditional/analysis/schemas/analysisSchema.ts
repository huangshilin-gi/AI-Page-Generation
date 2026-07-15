// step0: 基础分析
import { z } from "zod";

export const AnalysisSchema = z.object({
  type: z
    .enum(["CREATE", "MODIFY", "QA", "CHIT_CHAT"])
    .describe("用户的意图类型：创建新应用、修改现有应用、提问或闲聊"),
  summary: z.string().describe("针对用户需求的简要总结"),
  tags: z.array(z.string()).describe("相关的技术标签或关键词"),
  complexity: z
    .enum(["SIMPLE", "MEDIUM", "COMPLEX"])
    .describe("评估任务的复杂度"),
  designAnalysis: z
    .string()
    .nullable()
    .describe(
      "视觉/设计分析摘要。若上游 imageAnalysisNode 已提供视觉分析结果，请将其精炼总结填入此字段；若用户仅有文字描述的设计需求（如'现代暗色风格'），也可填入；纯文本无设计需求时为 null。",
    ),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;
