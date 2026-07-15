import express, { Request, Response } from "express";
import { buildAgent } from "../agents/graphs/main.graph.js";
import { resolveRouteAdapter } from "../agents/adapters/routeRegistry.js";
import {
  DEFAULT_MOCK_PRESET,
  resolveMockConfig,
  MockConfig,
} from "../config/mock.js";
import { NODE_HANDLERS } from "../config/chat.js";

const router = express.Router();

// 预构建两种 Agent（编译一次，复用多次）
const traditionalAgent = buildAgent("traditional");
const figmaAgent = buildAgent("figma");

router.post("/", async (req: Request, res: Response) => {
  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform"); // no-transform 防止压缩
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 禁用 Nginx 等代理缓冲

  // 立即发送头部
  res.flushHeaders();

  try {
    const { messages, mockConfig: userMockConfig, projectId } = req.body;
    console.log("Received messages count:", messages?.length);

    // 解析 Mock 配置 (仅 Traditional 流程使用)
    const mockConfigInput: MockConfig = userMockConfig || DEFAULT_MOCK_PRESET;
    const mockConfig = resolveMockConfig(mockConfigInput);

    // ========== 路由适配层：统一分流输入 ==========
    const routeResult = await resolveRouteAdapter({ messages, mockConfig });
    const isFigmaFlow = routeResult.flow === "figma";

    if (isFigmaFlow) {
      console.log(`🎨 [Route] 使用 Figma 直连流程`);
      if (routeResult.meta?.figmaUrl) {
        console.log(`   URL: ${routeResult.meta.figmaUrl}`);
      }
    } else {
      console.log(`📝 [Route] 使用 Traditional 流程`);
      console.log("Using mockConfig:", JSON.stringify(mockConfig));
    }

    // 发送初始为了建立连接的注释包（某些浏览器/代理需要先收到数据才认为连接成功）
    res.write(": keep-alive\n\n");

    // 使用 projectId 作为 thread_id 实现项目隔离
    const threadId =
      projectId ||
      `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log("Using thread_id (projectId):", threadId);

    const config = {
      configurable: { thread_id: threadId },
      streamMode: "updates" as const,
    };

    // ========== 选择 Agent 并构造输入 ==========
    const agent = isFigmaFlow ? figmaAgent : traditionalAgent;
    const input = routeResult.input;

    // 使用 stream 而不是 invoke
    // streamMode: "updates" 会返回并通过 yield 输出每个节点的更新
    const stream = await agent.stream(input, config);

    for await (const chunk of stream) {
      console.log("Chunk received keys:", Object.keys(chunk));

      // LangGraph 的 stream 块通常是 { [nodeName]: nodeOutput }
      const nodeName = Object.keys(chunk)[0];
      const output = (chunk as any)[nodeName];

      if (!output) {
        console.log("Empty output for node:", nodeName);
        continue;
      }

      console.log("Processing node:", nodeName);
      console.log("\n");

      // 使用策略表处理节点输出
      const handler = NODE_HANDLERS[nodeName];

      if (!handler) {
        console.log(`Unknown node update: ${nodeName}`);
        continue;
      }

      const eventType = handler.type;
      const payload = output[handler.key];

      // 构造 SSE 消息
      // 格式: data: {JSON}\n\n
      const sseMessage = JSON.stringify({
        type: eventType,
        data: payload,
      });
      res.write(`data: ${sseMessage}\n\n`);

      // 立即刷新缓冲区 (如果环境支持 flush)
      if ((res as any).flush) {
        (res as any).flush();
      }
    }

    // 发送结束信号
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error processing chat:", error);
    // 发送错误信号
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      })}\n\n`,
    );
    res.end();
  }
});

export default router;
