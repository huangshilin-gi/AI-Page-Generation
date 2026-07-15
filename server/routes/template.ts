import express, { Request, Response } from "express";
import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/* GET react template files. */
router.get("/react-ts", async (req: Request, res: Response) => {
  try {
    // 使用 process.cwd() 确保路径基于项目根目录（server 目录）
    const templateDir = path.join(process.cwd(), "templates/react-ts");

    // 使用 fast-glob 读取所有文件
    // dot: true 允许匹配以点开头的文件（如 .gitignore, .eslintrc）
    const files = await fg("**/*", {
      cwd: templateDir,
      dot: true,
      ignore: ["node_modules/**", "dist/**", ".DS_Store"],
    });

    if (files.length === 0) {
      return res
        .status(404)
        .json({ error: "No files found in template directory" });
    }

    const result: Record<string, { code: string }> = {};

    // 并行读取所有文件内容
    await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(
          path.join(templateDir, file),
          "utf-8"
        );
        // 构造 Sandpack 需要的格式：Key 为 "/" 开头的路径
        result[`/${file}`] = { code: content };
      })
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Template read error:", error);
    res.status(500).json({ error: "Failed to load template files" });
  }
});

export default router;
