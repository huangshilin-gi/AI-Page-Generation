"use client";

import { RotateCcw } from "lucide-react";
import type { VersionCardProps } from "@/types/components";

export function VersionCard({
  version,
  projectName,
  onRollback,
}: VersionCardProps) {
  return (
    <div className="mt-3 w-full rounded-xl border border-white/10 bg-linear-to-br from-slate-800/90 to-slate-900/90 p-5 shadow-lg shadow-black/20 transition-all duration-200 hover:border-white/20 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 text-base truncate">
              {projectName}
            </h3>
            {version.operation && (
              <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300 shrink-0">
                {version.operation === "create" ? "创建" : "编辑"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Version {version.versionNumber}
          </p>

          {version.fileCount > 0 && (
            <div className="mt-3 text-sm text-slate-300 font-medium">
              Worked with {version.fileCount} files
            </div>
          )}

          {version.changes && (
            <div className="mt-2 flex items-center gap-3 text-xs font-medium">
              {version.changes.added.length > 0 && (
                <span className="text-green-400">
                  +{version.changes.added.length}
                </span>
              )}
              {version.changes.deleted.length > 0 && (
                <span className="text-red-400">
                  -{version.changes.deleted.length}
                </span>
              )}
            </div>
          )}
        </div>

        {onRollback && (
          <button
            onClick={onRollback}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/12 hover:border-white/20 hover:text-white active:scale-95 shadow-sm shrink-0"
            title="回滚到此版本"
          >
            <RotateCcw size={14} />
            回滚
          </button>
        )}
      </div>
    </div>
  );
}
