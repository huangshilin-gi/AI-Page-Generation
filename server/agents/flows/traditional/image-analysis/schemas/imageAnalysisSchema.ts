/**
 * Step -1: 设计稿图片视觉分析 Schema
 *
 * 由 Qwen-VL 视觉模型输出，作为后续 Traditional 流程的「视觉约束层」。
 * 字段设计刻意与 uiSchema / capabilitySchema 对齐，方便下游节点直接消费。
 */
import { z } from "zod";

/** 视觉分析中识别到的单个 UI 组件 */
const ImageComponentSchema = z.object({
  id: z.string().describe("组件 ID，PascalCase，如 SearchBar、UserTable"),
  type: z
    .string()
    .describe(
      "组件类型，尽量使用 Shadcn/Radix 体系：Button, Input, Table, Card, Navbar, Sidebar, Tabs, Form, Chart, Badge, Avatar 等",
    ),
  label: z
    .string()
    .optional()
    .default("未命名组件")
    .describe("组件在界面上的可见文字或功能标签（中文）"),
  visualStyle: z
    .object({
      bgColor: z.string().nullable().describe("背景色，如 #1E40AF 或 blue-600"),
      textColor: z.string().nullable().describe("文字颜色"),
      borderRadius: z
        .string()
        .nullable()
        .describe("圆角风格，如 rounded-lg、rounded-full"),
    })
    .optional()
    .describe("从设计稿中观察到的视觉样式特征"),
});

/** 页面内的一个功能区块（Section） */
const ImageSectionSchema = z.object({
  sectionId: z
    .string()
    .optional()
    .default("section")
    .describe("区块 ID，如 header、sidebar、main-content、stats-row"),
  role: z
    .enum([
      "navigation",
      "filter",
      "list",
      "detail",
      "editor",
      "dashboard",
      "form",
    ])
    .catch("detail")
    .describe("区块功能角色，与 uiSchema 的 role 枚举保持一致"),
  layout: z
    .enum(["flex-row", "flex-col", "grid", "single"])
    .catch("single")
    .describe("区块内部布局方向"),
  title: z
    .string()
    .optional()
    .default("未命名区块")
    .describe("区块标题或功能描述（中文）"),
  components: z
    .array(ImageComponentSchema)
    .optional()
    .default([])
    .describe("该区块内识别到的 UI 组件列表"),
});

/** 从单张或多张设计稿中识别出的页面结构 */
const ImagePageSchema = z.object({
  pageIndex: z
    .number()
    .optional()
    .default(0)
    .describe("页面序号，从 0 开始；多张图片时每张图对应一个页面"),
  pageType: z
    .enum([
      "landing",
      "dashboard",
      "list",
      "detail",
      "form",
      "workspace",
      "settings",
      "profile",
      "other",
    ])
    .catch("other")
    .describe("页面类型，与 capabilitySchema 的 pageType 对齐"),
  layoutShell: z
    .enum(["default", "dashboard-shell", "blank", "editor-shell"])
    .catch("default")
    .describe("页面整体布局骨架，与 uiSchema 的 layout 枚举对齐"),
  description: z
    .string()
    .optional()
    .default("根据上传图片识别出的页面")
    .describe("该页面的视觉/功能描述（中文）"),
  sections: z
    .array(ImageSectionSchema)
    .optional()
    .default([])
    .describe("页面内识别到的功能区块"),
});

export const ImageAnalysisSchema = z.object({
  sourceImageCount: z
    .number()
    .optional()
    .default(1)
    .describe("分析的图片数量"),

  pages: z
    .preprocess((value) => {
      if (Array.isArray(value) || value === undefined) return value;

      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Treat free-form page text as a single page description.
        }

        return [
          {
            pageIndex: 0,
            pageType: "other",
            layoutShell: "default",
            description: value,
            sections: [],
          },
        ];
      }

      if (value && typeof value === "object") return [value];
      return [];
    }, z.array(ImagePageSchema))
    .optional()
    .default([])
    .describe("从设计稿中识别出的页面结构列表，单图通常为 1 个页面"),

  colorPalette: z
    .object({
      primary: z.string().default("#3B82F6").describe("主色调，如 #3B82F6 或 blue-500"),
      secondary: z.string().default("#64748B").describe("辅助色"),
      background: z.string().default("#FFFFFF").describe("页面背景色"),
      text: z.string().default("#111827").describe("主要文字颜色"),
      accent: z.string().nullable().default(null).describe("强调色，可为 null"),
    })
    .optional()
    .default({
      primary: "#3B82F6",
      secondary: "#64748B",
      background: "#FFFFFF",
      text: "#111827",
      accent: null,
    }),

  typography: z
    .object({
      headingStyle: z
        .string()
        .default("粗体无衬线标题")
        .describe("标题字体风格描述，如 粗体无衬线 24px"),
      bodyStyle: z
        .string()
        .default("常规无衬线正文")
        .describe("正文字体风格描述，如 常规 14px"),
    })
    .optional()
    .default({
      headingStyle: "粗体无衬线标题",
      bodyStyle: "常规无衬线正文",
    }),

  detectedTexts: z
    .array(z.string())
    .optional()
    .default([])
    .describe("从图片中 OCR 识别到的可见文字列表"),

  inferredBehaviors: z
    .array(z.string())
    .optional()
    .default([])
    .describe("从 UI 元素推断的交互行为，如 点击搜索、筛选列表、提交表单"),

  themeStrategy: z
    .string()
    .optional()
    .default("根据截图视觉风格还原界面主题")
    .describe("主题风格策略建议，如 现代暗色科技风、简约蓝白企业风"),

  fidelityNotes: z
    .string()
    .optional()
    .default("优先保持截图中的布局层级、间距、配色和主要可见元素")
    .describe("代码还原时的注意事项，如 保持左侧固定导航宽度、统计卡片三列等宽"),
});

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
