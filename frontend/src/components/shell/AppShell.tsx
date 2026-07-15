// 应用主壳层组件
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";
import { useSandpackStore } from "@/store/sandpackStore";
import { Eye, Code2, Settings, LogOut } from "lucide-react";
import type { LayoutMode, AppShellProps } from "@/types/components";

/**
 * AppShell
 *
 * 职责：
 * - 管理整体布局结构（两列 / 预览全屏）
 * - 分配 Chat / Preview 的空间
 *
 * 不负责：
 * - 不处理任何业务逻辑
 * - 不关心 prompt / sandpack / AI
 * - 不直接依赖 store（未来可由上层注入）
 */

export function AppShell({ children }: AppShellProps) {
  const { viewMode, setViewMode } = useSandpackStore();

  /**
   * 当前布局模式
   *
   * split         : Chat + Preview
   * preview-only  : Preview 全屏
   */
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split");

  /**
   * 布局控制方法
   * 注意：这里只是能力，不是业务触发
   */
  const showPreviewOnly = () => setLayoutMode("preview-only");
  const showSplit = () => setLayoutMode("split");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34rem),linear-gradient(135deg,#111318_0%,#171a21_45%,#20242c_100%)] text-slate-100">
      {/* 顶部 Header */}
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/70 px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Logo 和标题 */}
          <div className="flex items-center gap-2 font-semibold text-slate-100">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10 shadow-lg shadow-black/30">
              <Image
                src="/logo.ico?v=20260713"
                alt="Logo"
                fill
                priority
                unoptimized
                className="object-cover"
                sizes="32px"
              />
            </div>
            <span>AI-powered</span>
            <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-xs font-normal text-slate-400">
              Beta
            </span>
          </div>
        </div>

        {/* 中间 Toggle Controls */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 p-1 shadow-inner shadow-black/30 backdrop-blur">
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                viewMode === "preview"
                  ? "bg-slate-700/90 text-white shadow-sm shadow-black/30 ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Eye size={16} />
              预览
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                viewMode === "code"
                  ? "bg-slate-700/90 text-white shadow-sm shadow-black/30 ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Code2 size={16} />
              代码
            </button>
          </div>
        </div>

        {/* 右侧 User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full shadow-sm transition-all hover:shadow-md active:scale-95"
          >
            <Image
              src="/avatar.gif"
              alt="User Avatar"
              fill
              unoptimized
              className="object-cover"
              sizes="32px"
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 origin-top-right animate-in fade-in zoom-in-95 duration-200 rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl focus:outline-none z-50">
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
                onClick={() => {
                  console.log("Settings clicked");
                  setIsDropdownOpen(false);
                }}
              >
                <Settings size={16} className="text-slate-500" />
                设置
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                onClick={() => {
                  console.log("Logout clicked");
                  setIsDropdownOpen(false);
                }}
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 下方主体内容：包含 Chat 和 Preview */}
      <main className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* 左侧 Chat 面板 */}
        <div
          className={`flex flex-col shrink-0 transition-all duration-300 ease-out ${
            layoutMode === "preview-only"
              ? "w-0 opacity-0 pointer-events-none"
              : "w-[400px] opacity-100"
          }`}
        >
          <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/72 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
            <ChatPanel />
          </div>
        </div>

        {/* 右侧 Preview 面板 */}
        <div className="flex-1 relative transition-all duration-300 ease-out">
          <PreviewPanel
            layoutMode={layoutMode}
            onExitFullScreen={showSplit}
            onEnterFullScreen={showPreviewOnly}
          >
            {children}
          </PreviewPanel>
        </div>
      </main>
    </div>
  );
}
