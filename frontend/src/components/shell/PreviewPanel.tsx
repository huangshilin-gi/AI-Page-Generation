// 右侧预览面板
"use client";

import { PreviewToolbar } from "@/components/preview/PreviewToolbar";
import type { PreviewPanelProps } from "@/types/components";

/**
 * PreviewPanel
 *
 * 职责：
 * - 作为 Preview 区域的结构容器
 * - 承载 PreviewToolbar
 * - 将真正的预览内容（Sandpack）包裹进来
 *
 * 不负责：
 * - 不生成内容
 * - 不管理 Sandpack 状态
 * - 不直接控制布局（只能通过回调请求）
 */
export function PreviewPanel({
  children,
  layoutMode,
  onEnterFullScreen,
  onExitFullScreen,
}: PreviewPanelProps) {
  const isFullScreen = layoutMode === "preview-only";

  return (
    <section className="relative h-full w-full overflow-hidden">
      {/* Preview content */}
      <div className="h-full w-full">
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/72 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
          <div className="absolute top-1.5 right-3 z-10">
            <PreviewToolbar
              isFullScreen={isFullScreen}
              onEnterFullScreen={onEnterFullScreen}
              onExitFullScreen={onExitFullScreen}
            />
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
