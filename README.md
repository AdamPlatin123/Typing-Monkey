# TypingMonkey

TypingMonkey 是一个本地优先的文档导入、解析与阅读工具，当前实现围绕单机部署、结构化解析和统一阅读体验展开。

## 当前能力

- 单机免登录模式，自动创建本地用户
- 支持单文件导入：`md`、`txt`、`pdf`、`docx`、`pptx`、`ppt`
- 支持批量导入：文件夹、`zip`、`7z`、`rar`
- 统一落库为结构化文档块与资源文件
- 支持 Markdown 相对路径图片解析
- 支持阅读进度保存、文档搜索和结构化阅读

## 技术栈

- Next.js 16
- React 19
- Prisma
- SQLite
- BullMQ + Redis
- S3 兼容对象存储

## 目录说明

- `src/app`：页面与 API 路由
- `src/lib`：核心业务逻辑、解析器、存储与队列
- `src/worker`：异步解析 worker
- `prisma`：数据模型与迁移
- `scripts`：辅助脚本

## 本地运行

### 依赖

- Node.js 20+
- Redis
- S3 兼容对象存储，例如 MinIO
- LibreOffice：用于 `.ppt -> .pptx`
- 7-Zip：用于 `.7z/.rar`

### 环境变量

复制 `G:\_Projects\TypingMonkey\.env.example` 为 `G:\_Projects\TypingMonkey\.env`，按本机环境调整以下值：

- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `LIBREOFFICE_PATH`
- `SEVEN_ZIP_PATH`

### 启动

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
npm run worker
```

Windows 下可直接使用：

```bat
start-typingmonkey.bat --migrate
```

## 重要说明

- 扫描版 PDF 若没有文本层，会返回 `NO_TEXT_LAYER`
- 外部图片链接不会被抓取，仅保留 URL
- 批量导入采用部分成功策略，单个文件失败不会阻断整批任务
- 当前仓库不包含 Docker 配置，按本机环境直接运行

## GitHub 发布建议

建议推送前确认以下文件不会入库：

- `G:\_Projects\TypingMonkey\.env`
- `G:\_Projects\TypingMonkey\node_modules`
- `G:\_Projects\TypingMonkey\.next`
- `G:\_Projects\TypingMonkey\coverage`
- `G:\_Projects\TypingMonkey\prisma\dev.db`
