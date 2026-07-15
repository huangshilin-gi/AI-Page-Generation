import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableLambda } from "@langchain/core/runnables";
import { ZodType } from "zod";

/**
 * 多模型架构：
 * - DeepSeek: 主模型选项1（用于大部分节点，支持 Function Calling）
 * - GLM: 主模型选项2（智谱 AI，支持 Function Calling）
 * - Qwen-VL: Vision 模型（仅用于图片分析）
 *
 * 通过环境变量 MAIN_MODEL_PROVIDER 切换主模型：deepseek | glm
 */

let deepseekInstance: ChatOpenAI | null = null;
let glmInstance: ChatOpenAI | null = null;
let qwenVisionInstance: ChatOpenAI | null = null;

/**
 * 获取 DeepSeek 主模型实例（用于大部分节点）
 * 支持 Function Calling，结构化输出能力强
 */
export function getDeepSeekModel() {
  if (!deepseekInstance) {
    deepseekInstance = new ChatOpenAI({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
      temperature: 0,
      modelKwargs: {
        thinking: {
          type: "disabled",
        },
      },
      configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      },
    });
  }
  return deepseekInstance;
}

/**
 * 获取 GLM 主模型实例（智谱 AI）
 * 支持 Function Calling，结构化输出能力强
 */
export function getGLMModel() {
  if (!glmInstance) {
    glmInstance = new ChatOpenAI({
      model: process.env.GLM_MODEL || "glm-4-flash",
      apiKey: process.env.GLM_API_KEY,
      temperature: 0,
      configuration: {
        baseURL:
          process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
      },
    });
  }
  return glmInstance;
}

/**
 * 获取 Qwen-VL Vision 模型实例（仅用于图片分析）
 * 支持图片输入和分析
 */
export function getQwenVisionModel() {
  if (!qwenVisionInstance) {
    qwenVisionInstance = new ChatOpenAI({
      model: process.env.QWEN_MODEL || "qwen3-vl-plus",
      apiKey: process.env.QWEN_API_KEY,
      temperature: 0,
      configuration: {
        baseURL: process.env.QWEN_BASE_URL || "",
      },
    });
  }
  return qwenVisionInstance;
}

/**
 * 获取当前配置的主模型
 * 根据环境变量 MAIN_MODEL_PROVIDER 切换：deepseek | glm
 */
export function getMainModel() {
  const provider = process.env.MAIN_MODEL_PROVIDER || "deepseek";

  switch (provider.toLowerCase()) {
    case "glm":
      console.log("[Model] Using GLM as main model");
      return getGLMModel();
    case "deepseek":
    default:
      console.log("[Model] Using DeepSeek as main model");
      return getDeepSeekModel();
  }
}

/**
 * 获取默认模型（向后兼容）
 * 使用当前配置的主模型
 */
export function getModel() {
  return getMainModel();
}

/**
 * 获取支持结构化输出的模型实例
 * 使用当前配置的主模型，支持 Function Calling
 */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Some OpenAI-compatible providers append extra characters after the JSON.
  }

  const start = trimmed.search(/[\[{]/);
  if (start === -1) {
    throw new Error("模型未返回 JSON 内容");
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack.at(-1) !== expected) {
        continue;
      }

      stack.pop();
      if (stack.length === 0) {
        const jsonCandidate = trimmed.slice(start, i + 1);
        return JSON.parse(jsonCandidate);
      }
    }
  }

  throw new Error("模型返回的 JSON 不完整或格式错误");
}

function getMessageTextContent(message: any): string {
  const content = message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("\n");
  }

  return "";
}

function parseStructuredRawResponse<T extends ZodType<any>>(
  schema: T,
  raw: any,
): any {
  const toolCall =
    raw?.tool_calls?.[0] ?? raw?.additional_kwargs?.tool_calls?.[0];
  const args = toolCall?.args ?? toolCall?.function?.arguments;

  if (args !== undefined) {
    const parsedArgs =
      typeof args === "string" ? extractJsonObject(args) : args;
    return schema.parse(parsedArgs);
  }

  const content = getMessageTextContent(raw);
  if (!content) {
    throw new Error("模型未返回可解析的结构化内容");
  }

  return schema.parse(extractJsonObject(content));
}

/**
 * 获取 Vision 模型的结构化输出封装
 *
 * 使用 Qwen-VL 视觉模型（支持图片输入）。优先使用 Function Calling 获取结构化结果；
 * 如果提供商没有返回 parsed/tool_calls，则回退到文本 JSON 解析。
 */
export function getVisionStructuredModel<T extends ZodType<any>>(schema: T) {
  const model = getQwenVisionModel();
  const structuredModel = model.withStructuredOutput(schema, {
    method: "functionCalling",
    includeRaw: true,
  });

  return RunnableLambda.from(async (messages: any[]) => {
    const result = await structuredModel.invoke(messages);

    if (result?.parsed) {
      return result.parsed;
    }

    return parseStructuredRawResponse(schema, result?.raw);
  });
}

/**
 * 获取支持结构化输出的模型实例
 * 使用当前配置的主模型，支持 Function Calling
 */
export function getStructuredModel<T extends ZodType<any>>(schema: T) {
  const model = getMainModel();
  const structuredModel = model.withStructuredOutput(schema, {
    method: "functionCalling",
    includeRaw: true,
  });

  // 国产大模型会出现输出非法JSON问题（即便已经微调prompt），手动加一层兜底
  return RunnableLambda.from(async (messages: any[]) => {
    const result = await structuredModel.invoke(messages);

    if (result?.parsed) {
      return result.parsed;
    }

    return parseStructuredRawResponse(schema, result?.raw);
  });
}

/**
 * 获取当前主模型提供商名称
 */
export function getMainModelProvider(): string {
  return process.env.MAIN_MODEL_PROVIDER || "deepseek";
}
