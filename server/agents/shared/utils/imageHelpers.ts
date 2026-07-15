/**
 * 图片输入相关的共享工具函数
 *
 * 职责：
 * 1. 从聊天消息中提取图片附件 URL
 * 2. 将 Vision 模型的结构化分析结果格式化为下游节点可消费的文本摘要
 */

/** 前端消息中图片附件的标准结构 */
export interface ImageAttachment {
  type: "image";
  url: string;
}

/**
 * 从消息列表的最后一条用户消息中提取图片 URL
 *
 * @param messages 聊天历史（前端原始格式）
 * @returns 图片 URL 数组（最多 3 张，与前端上传限制一致）
 */
export function extractImageUrlsFromMessages(messages: any[]): string[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const lastMsg = messages[messages.length - 1];
  const attachments = Array.isArray(lastMsg?.attachments)
    ? lastMsg.attachments
    : [];

  return attachments
    .filter((att: any) => att?.type === "image" && typeof att.url === "string")
    .map((att: any) => att.url as string)
    .slice(0, 3);
}

/**
 * 判断当前请求是否包含 UI 图片输入
 */
export function hasImageInput(messages: any[]): boolean {
  return extractImageUrlsFromMessages(messages).length > 0;
}

/**
 * 将 imageAnalysis 结构化结果压缩为自然语言摘要
 * 供 analysisNode / intentNode 等纯文本模型节点使用
 */
export function formatImageAnalysisSummary(imageAnalysis: any): string {
  if (!imageAnalysis) return "";

  const pages = imageAnalysis.pages || [];
  const pageSummaries = pages
    .map((page: any, index: number) => {
      const sectionCount = page.sections?.length || 0;
      const componentCount =
        page.sections?.reduce(
          (sum: number, s: any) => sum + (s.components?.length || 0),
          0,
        ) || 0;
      return `页面${index + 1}(${page.pageType || "unknown"}): ${page.description || "无描述"}，含 ${sectionCount} 个区块、${componentCount} 个组件`;
    })
    .join("；");

  const palette = imageAnalysis.colorPalette;
  const colorInfo = palette
    ? `主色 ${palette.primary}，背景 ${palette.background}`
    : "配色未识别";

  return [
    `【设计稿视觉分析】`,
    `页面概览: ${pageSummaries || "未识别到明确页面结构"}`,
    `配色: ${colorInfo}`,
    `主题策略: ${imageAnalysis.themeStrategy || "未指定"}`,
    `识别文本: ${(imageAnalysis.detectedTexts || []).slice(0, 8).join("、") || "无"}`,
    `推断交互: ${(imageAnalysis.inferredBehaviors || []).join("、") || "无"}`,
    `还原要点: ${imageAnalysis.fidelityNotes || "无"}`,
  ].join("\n");
}
