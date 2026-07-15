/**
 * App.tsx 路由修复工具
 *
 * 问题背景：
 * Sandpack 预览默认打开 #/（即 path='/'），
 * 但 LLM 有时会把仪表盘页面路由写成 /dashboard，
 * 导致首页直接命中 404 兜底路由（「页面不存在，返回首页」）。
 *
 * 本工具在 App.tsx 生成后自动补全首页路由。
 */

interface PageCodeItem {
  path: string;
}

/**
 * 从页面文件路径提取组件名
 * 例: /pages/Dashboard.tsx -> Dashboard
 */
function extractPageComponentName(pagePath: string): string | null {
  const match = pagePath.match(/\/pages\/([^.]+)\.tsx$/);
  return match ? match[1] : null;
}

/**
 * 检测 App.tsx 是否已配置 path='/' 的路由
 */
function hasRootRoute(appContent: string): boolean {
  return /path=['"]\/['"]/.test(appContent);
}

/**
 * 在 App.tsx 中查找某页面组件已被绑定的路由路径
 */
function findRouteForComponent(
  appContent: string,
  componentName: string,
): string | null {
  const pattern = new RegExp(
    `path=['"]([^'"]+)['"]\\s+element=\\{<${componentName}\\s*/>\\}`,
  );
  const match = appContent.match(pattern);
  return match ? match[1] : null;
}

/**
 * 为 App.tsx 补全首页路由（path='/'）
 *
 * 策略：
 * 1. 若已有 path='/'，不处理
 * 2. 找到第一个页面组件在 App.tsx 中对应的路由
 * 3. 若该路由不是 '/'，在其前面插入一条 path='/' 指向同一组件的路由
 *
 * @param appContent App.tsx 源码
 * @param pagesCode 已生成的页面文件列表
 * @returns 修复后的 App.tsx 源码
 */
export function ensureHomeRouteInApp(
  appContent: string,
  pagesCode: PageCodeItem[] = [],
): string {
  if (!appContent || hasRootRoute(appContent)) {
    return appContent;
  }

  // 取第一个页面作为主页面（通常就是仪表盘/首页）
  const primaryPage = pagesCode[0];
  if (!primaryPage) return appContent;

  const componentName = extractPageComponentName(primaryPage.path);
  if (!componentName) return appContent;

  const existingRoute = findRouteForComponent(appContent, componentName);
  if (!existingRoute || existingRoute === "/") {
    return appContent;
  }

  console.log(
    `[AppRouteFixer] 补全首页路由: / -> <${componentName} /> (原路由: ${existingRoute})`,
  );

  const homeRouteLine = `<Route path='/' element={<${componentName} />} />`;

  // 在已有路由声明前插入首页路由
  const existingRoutePattern = new RegExp(
    `(\\s*)<Route path=['"]${existingRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"] element=\\{<${componentName}\\s*/>\\} />`,
  );

  return appContent.replace(
    existingRoutePattern,
    `$1${homeRouteLine}\n$1<Route path='${existingRoute}' element={<${componentName} />} />`,
  );
}
