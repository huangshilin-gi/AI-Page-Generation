import { T_Graph } from "../../../../shared/schemas/graphSchema.js";
import {
  scanDependencies,
  buildPackageJson,
} from "../../../../utils/dependencyBuilder.js";
import * as fs from "fs/promises";
import * as path from "path";
import { normalizeCodeContent } from "../../../../utils/codeNormalizer.js";

/**
 * Step 16: 文件组装节点
 *
 * 将所有生成的代码产物组装成 Sandpack 可渲染的 files 对象。
 * 这是一个纯 TypeScript 节点，不调用 LLM。
 */
export async function assembleNode(state: T_Graph) {
  console.log(`--- AssembleNode HEAD Start ---`);

  const files: Record<string, string> = {};
  const categories: Record<string, number> = {};

  /**
   * 路径规范化函数
   * Sandpack 不使用 src/ 目录，需要移除 /src/ 前缀
   */
  const normalizePath = (filePath: string): string => {
    let normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
    // 移除 /src/ 前缀 (如 /src/pages/Home.tsx -> /pages/Home.tsx)
    if (normalized.startsWith("/src/")) {
      normalized = normalized.replace("/src/", "/");
    }
    return normalized;
  };

  // 辅助函数：添加文件并统计
  const addFile = (filePath: string, content: string, category: string) => {
    const normalizedPath = normalizePath(filePath);
    const shouldNormalizeCode = /\.(tsx?|jsx?)$/.test(normalizedPath);
    files[normalizedPath] = shouldNormalizeCode
      ? normalizeCodeContent(content)
      : content;
    categories[category] = (categories[category] || 0) + 1;
  };

  // 辅助函数：添加数组文件
  const addFiles = (
    items: Array<{ path: string; content: string }> | undefined,
    category: string,
  ) => {
    if (!items) return;
    items.forEach((item) => addFile(item.path, item.content, category));
  };

  // ========================================
  // 1. 模板文件 (固定不变)
  // ========================================

  // 1.1 index.tsx - 从模板读取
  try {
    const indexPath = path.resolve(
      process.cwd(),
      "templates/react-ts/index.tsx",
    );
    const indexContent = await fs.readFile(indexPath, "utf-8");
    addFile("/index.tsx", indexContent, "entry");
  } catch (error) {
    console.warn("AssembleNode: Failed to read index.tsx template", error);
    // 降级：使用硬编码的默认内容
    addFile(
      "/index.tsx",
      `// @ts-nocheck
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      "entry",
    );
  }

  // 1.2 package.json - 先跳过，等所有文件收集完后再扫描 imports
  // （见步骤 3.5）

  // ========================================
  // 2. 单文件产物
  // ========================================

  // Step 8: 工具函数 (utils 返回 { files: [...] } 格式)
  if (state.utils?.files) {
    state.utils.files.forEach((file) => {
      if (file.path && file.code) {
        addFile(file.path, file.code, "utils");
      }
    });
  }

  // Step 14: 全局样式
  if (state.styles?.path && state.styles?.content) {
    addFile(state.styles.path, state.styles.content, "styles");
  }

  // Step 15: App.tsx
  if (state.app?.path && state.app?.content) {
    addFile(state.app.path, state.app.content, "entry");
  }

  // ========================================
  // 3. 数组产物
  // ========================================

  // Step 7: 类型定义 (files 数组，字段是 code)
  if (state.types?.files) {
    state.types.files.forEach((file) => {
      addFile(file.path, file.code, "types");
    });
  }

  // Step 9: Mock 数据
  // 注意: mockData 实际结构是 { files: [...] }，不是数组
  if (state.mockData?.files) {
    state.mockData.files.forEach((file: { path: string; content: string }) => {
      addFile(file.path, file.content, "mockData");
    });
  }

  // Step 10: 服务层 (files 数组)
  if (state.service?.files) {
    state.service.files.forEach((file) => {
      addFile(file.path, file.content, "service");
    });
  }

  // Step 11: Hooks 层 (files 数组)
  if (state.hooks?.files) {
    state.hooks.files.forEach((file) => {
      addFile(file.path, file.content, "hooks");
    });
  }

  // Step 12: 组件代码
  console.log(
    `[AssembleNode] componentsCode count: ${state.componentsCode?.length || 0}`,
  );
  if (state.componentsCode?.length) {
    console.log(
      `[AssembleNode] componentsCode paths:`,
      state.componentsCode.map((c) => c.path),
    );
  }
  addFiles(state.componentsCode, "components");

  // Step 13: 页面代码
  console.log(
    `[AssembleNode] pagesCode count: ${state.pagesCode?.length || 0}`,
  );
  if (state.pagesCode?.length) {
    console.log(
      `[AssembleNode] pagesCode paths:`,
      state.pagesCode.map((p) => p.path),
    );
  }
  addFiles(state.pagesCode, "pages");

  // Step 14: Layout 组件代码
  const layoutsCode = state.layouts?.layoutsCode || [];
  console.log(`[AssembleNode] layoutsCode count: ${layoutsCode.length}`);
  if (layoutsCode.length) {
    console.log(
      `[AssembleNode] layoutsCode paths:`,
      layoutsCode.map((l) => l.path),
    );
  }
  addFiles(layoutsCode, "layouts");

  // ========================================
  // 3.5 本地 import 校验与修复
  // ========================================
  const resolveLocalImport = (fromPath: string, specifier: string) => {
    if (!specifier.startsWith(".")) return null;

    const fromDir = path.posix.dirname(fromPath);
    const normalized = path.posix.normalize(path.posix.join(fromDir, specifier));
    const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const candidates = [
      absolute,
      `${absolute}.ts`,
      `${absolute}.tsx`,
      `${absolute}.js`,
      `${absolute}.jsx`,
      `${absolute}/index.ts`,
      `${absolute}/index.tsx`,
      `${absolute}/index.js`,
      `${absolute}/index.jsx`,
    ];

    return candidates.find((candidate) => files[candidate] !== undefined) || null;
  };

  const toRelativeImport = (fromPath: string, targetPath: string) => {
    const fromDir = path.posix.dirname(fromPath);
    const targetWithoutExt = targetPath.replace(/\.(tsx?|jsx?)$/, "");
    let relative = path.posix.relative(fromDir, targetWithoutExt);
    if (!relative.startsWith(".")) relative = `./${relative}`;
    return relative;
  };

  const findComponentFileByName = (name: string) => {
    const candidates = [
      `/components/${name}.tsx`,
      `/components/${name}.ts`,
      `/components/${name}.jsx`,
      `/components/${name}.js`,
    ];
    return candidates.find((candidate) => files[candidate] !== undefined) || null;
  };

  const hasDefaultExport = (content: string) =>
    /export\s+default\s+(?:function|class|const|\w+)/.test(content);

  const hasNamedExport = (content: string, name: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `export\\s+(?:function|class|const|let|var|interface|type)\\s+${escapedName}\\b|export\\s*\\{[^}]*\\b${escapedName}\\b[^}]*\\}`,
    ).test(content);
  };

  const extractJsxComponentNames = (content: string) => {
    const names = new Set<string>();
    const jsxRegex = /<([A-Z][A-Za-z0-9_]*)\b/g;
    let match: RegExpExecArray | null;
    while ((match = jsxRegex.exec(content))) {
      names.add(match[1]);
    }
    return names;
  };

  const importRegex =
    /^\s*import(?:\s+type)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$|^\s*import\s+['"]([^'"]+)['"];?\s*$/gm;

  const namedImportRegex =
    /^\s*import\s+\{\s*([A-Z][A-Za-z0-9_]*)\s*\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm;

  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;

    const fixedNamedImports = content.replace(
      namedImportRegex,
      (statement, importName, specifier) => {
        if (!specifier?.startsWith(".")) return statement;

        const resolvedPath = resolveLocalImport(filePath, specifier);
        if (!resolvedPath) return statement;

        const targetContent = files[resolvedPath];
        if (!targetContent) return statement;

        if (hasNamedExport(targetContent, importName)) return statement;
        if (!hasDefaultExport(targetContent)) return statement;

        console.warn(
          `[AssembleNode] Fixed named/default import mismatch in ${filePath}: ${importName} from ${specifier}`,
        );
        return `import ${importName} from '${specifier}';`;
      },
    );

    const missingImports: string[] = [];
    const addedImports: string[] = [];
    const usedComponentNames = extractJsxComponentNames(fixedNamedImports);
    const fixedContent = fixedNamedImports.replace(importRegex, (statement, fromImport, sideEffectImport) => {
      const specifier = fromImport || sideEffectImport;
      if (!specifier?.startsWith(".")) return statement;
      if (resolveLocalImport(filePath, specifier)) return statement;

      missingImports.push(specifier);

      if (specifier.replace(/\/$/, "").endsWith("/components")) {
        const replacementImports = Array.from(usedComponentNames)
          .map((name) => {
            const componentFile = findComponentFileByName(name);
            if (!componentFile) return null;
            const relativePath = toRelativeImport(filePath, componentFile);
            return `import ${name} from '${relativePath}';`;
          })
          .filter((line): line is string => Boolean(line));

        if (replacementImports.length > 0) {
          addedImports.push(...replacementImports);
          return replacementImports.join("\n");
        }
      }

      return "";
    });

    if (fixedContent !== content || missingImports.length > 0) {
      files[filePath] = fixedContent.replace(/\n{3,}/g, "\n\n").trimStart();
      if (missingImports.length > 0) {
        console.warn(
          `[AssembleNode] Fixed missing local imports in ${filePath}: ${missingImports.join(", ")}` +
            (addedImports.length > 0 ? ` -> ${addedImports.join(" ")}` : ""),
        );
      }
    }
  }

  // ========================================
  // 3.6 程序化依赖分析 + package.json
  // ========================================
  // 所有代码文件已收集到 files 对象中，现在扫描 import 语句
  if (state.dependency?.packageJson) {
    const codeFiles = Object.entries(files)
      .filter(
        ([p]) =>
          p.endsWith(".ts") ||
          p.endsWith(".tsx") ||
          p.endsWith(".js") ||
          p.endsWith(".jsx"),
      )
      .map(([p, content]) => ({ path: p, code: content }));

    console.log(
      `[AssembleNode] Scanning imports from ${codeFiles.length} code files...`,
    );

    const scannedDeps = scanDependencies(codeFiles);
    const scannedCount = Object.keys(scannedDeps).length;
    console.log(
      `[AssembleNode] Found ${scannedCount} third-party packages from imports`,
    );

    const { packageJson: finalPkg, dependencies: addedDeps } = buildPackageJson(
      scannedDeps,
      state.dependency.packageJson,
    );

    const addedCount = Object.keys(addedDeps).length;
    if (addedCount > 0) {
      console.log(
        `[AssembleNode] Added ${addedCount} new dependencies:`,
        Object.keys(addedDeps).join(", "),
      );
    }

    addFile("/package.json", JSON.stringify(finalPkg, null, 2), "config");
  }

  // ========================================
  // 4. 统计与日志
  // ========================================

  const totalFiles = Object.keys(files).length;

  console.log(`--- AssembleNode Complete ---`);
  console.log(`Total files: ${totalFiles}`);
  console.log(`Categories:`, JSON.stringify(categories, null, 2));
  console.log(`File paths:`, Object.keys(files).join(", "));

  return {
    files: {
      files,
      stats: {
        totalFiles,
        categories,
      },
    },
  };
}
