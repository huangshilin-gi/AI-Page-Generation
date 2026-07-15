// 预览工具栏组件
"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useSandpackStore } from "@/store/sandpackStore";
import { downloadGeneratedCode } from "@/lib/downloadCode";
import { toast } from "sonner";
import type { PreviewToolbarProps } from "@/types/components";

/**
 * PreviewToolbar
 *
 * 职责：
 * - 提供 Preview 区域的布局控制（全屏 / 退出全屏）
 * - 提供代码下载功能
 *
 * 不负责：
 * - 不管理状态
 * - 不知道 Sandpack / Chat
 */
export function PreviewToolbar({
  isFullScreen,
  onEnterFullScreen,
  onExitFullScreen,
}: PreviewToolbarProps) {
  const { generatedFiles, viewMode } = useSandpackStore();
  const [isDownloading, setIsDownloading] = useState(false);

  // 从全局获取 templateFiles（由 SandpackView 设置）
  const templateFiles =
    typeof window !== "undefined" ? window.__templateFiles || {} : {};
  const hasDownloadableFiles =
    generatedFiles || Object.keys(templateFiles).length > 0;

  const handleDownload = async () => {
    if (!hasDownloadableFiles) {
      toast.error("暂无可下载的代码");
      return;
    }

    setIsDownloading(true);
    try {
      // 如果没有生成代码，就只下载模板代码
      const filesToDownload = generatedFiles || templateFiles;
      await downloadGeneratedCode(filesToDownload, templateFiles);
      toast.success("代码下载成功");
    } catch (error) {
      console.error("下载失败:", error);
      toast.error("下载失败，请重试");
    } finally {
      setIsDownloading(false);
    }
  };

  const isDownloadDisabled = !hasDownloadableFiles || isDownloading;

  return (
    <div className="flex items-center gap-2">
      {/* 下载代码按钮 - 只在代码视图显示 */}
      {viewMode === "code" && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloadDisabled}
          className="cursor-pointer flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg shadow-black/20 backdrop-blur hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900/85"
          title={!hasDownloadableFiles ? "正在加载模板..." : "下载代码"}
        >
          <Download className="h-3.5 w-3.5" />
          {isDownloading ? "下载中..." : "下载代码"}
        </button>
      )}

      {!isFullScreen && (
        <button
          type="button"
          onClick={onEnterFullScreen}
          className="cursor-pointer rounded-md border border-white/10 bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg shadow-black/20 backdrop-blur hover:bg-slate-800 hover:text-white"
        >
          全屏
        </button>
      )}

      {isFullScreen && (
        <button
          type="button"
          onClick={onExitFullScreen}
          className="cursor-pointer rounded-md border border-white/10 bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg shadow-black/20 backdrop-blur hover:bg-slate-800 hover:text-white"
        >
          退出全屏
        </button>
      )}
    </div>
  );
}
