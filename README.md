<div align="center">

```
████████╗██╗   ██╗██████╗ ██╗███╗   ██╗ ██████╗
╚══██╔══╝╚██╗ ██╔╝██╔══██╗██║████╗  ██║██╔════╝
   ██║    ╚████╔╝ ██████╔╝██║██╔██╗ ██║██║  ███╗
   ██║     ╚██╔╝  ██╔═══╝ ██║██║╚██╗██║██║   ██║
   ██║      ██║   ██║     ██║██║ ╚████║╚██████╔╝
   ╚═╝      ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝

███╗   ███╗ ██████╗ ███╗   ██╗██╗  ██╗███████╗██╗   ██╗
████╗ ████║██╔═══██╗████╗  ██║██║ ██╔╝██╔════╝╚██╗ ██╔╝
██╔████╔██║██║   ██║██╔██╗ ██║█████╔╝ █████╗   ╚████╔╝
██║╚██╔╝██║██║   ██║██║╚██╗██║██╔═██╗ ██╔══╝    ╚██╔╝
██║ ╚═╝ ██║╚██████╔╝██║ ╚████║██║  ██╗███████╗   ██║
╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝   ╚═╝
```

<img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
<img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
<img src="https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma" alt="Prisma" />
<img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis" alt="Redis" />
<img src="https://img.shields.io/badge/S3-Compatible-569A31?logo=amazon-s3" alt="S3" />

> A local-first document import, parse & reading tool.
>
> 本地优先的文档导入、解析与阅读工具。

</div>

## What It Does

```console
$ typingmonkey import research.pdf
  Parsing... done.
  Sections: 5  |  Blocks: 142  |  Resources: 8

$ typingmonkey import ./papers/ --batch
  Scanning 23 files... done.
  Queued: 15  |  Skipped (unsupported): 6  |  Failed: 2

$ typingmonkey open --section 3
  Resuming from block 89/132 (progress 67%)
```

<!-- TODO: Record import-demo.gif and uncomment below -->
<p align="center">
  <img src="docs/assets/import-demo.gif" width="600" alt="Import demo" />
</p>

### Supported Formats

```console
$ typingmonkey --formats

  FORMAT     EXTENSIONS            BATCH
  ─────────  ────────────────────  ──────
  PDF        .pdf                  -
  Word       .docx                 -
  Slides     .pptx / .ppt(*)       -
  Markdown   .md                   -
  Text       .txt                  -
  Archive    .zip / .7z / .rar     ✓

  (*) .ppt requires LibreOffice for conversion to .pptx
```

## Architecture

```
  Browser ──→ Next.js API ──→ Prisma (SQLite)
                    │                │
                    ▼                ▼
              BullMQ Worker    S3 Object Storage
              (PDF/DOCX/...)
```

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Redis** — job queue backend
- **S3 compatible storage** — e.g. [MinIO](https://min.io)
- **LibreOffice** — for `.ppt` to `.pptx` conversion
- **7-Zip** — for `.7z` / `.rar` archives

### Install & Run

```console
$ git clone https://github.com/your-org/TypingMonkey.git
$ cd TypingMonkey
$ npm install
$ npm run prisma:generate
$ npm run prisma:migrate
$ npm run dev       # start web server (port 3000)
$ npm run worker    # start background worker
```

Windows users can use the bundled batch script:

```bat
start-typingmonkey.bat --migrate
```

### Environment Variables

| Variable              | Description                          | Example                                |
| --------------------- | ------------------------------------ | -------------------------------------- |
| `DATABASE_URL`        | SQLite connection string             | `file:./dev.db`                        |
| `REDIS_URL`           | Redis connection URL                 | `redis://localhost:6379`               |
| `S3_ENDPOINT`         | S3-compatible endpoint              | `http://localhost:9000`                |
| `S3_BUCKET`           | Storage bucket name                  | `typingmonkey`                         |
| `S3_ACCESS_KEY_ID`    | S3 access key                        | `minioadmin`                           |
| `S3_SECRET_ACCESS_KEY`| S3 secret key                        | `minioadmin`                           |
| `LIBREOFFICE_PATH`    | Path to LibreOffice binary           | `/usr/bin/libreoffice`                 |
| `SEVEN_ZIP_PATH`      | Path to 7-Zip binary                 | `/usr/bin/7z`                          |

## Notes

- Scanned PDFs without a text layer will return `NO_TEXT_LAYER` — OCR is not included.
- External image URLs are preserved as-is; no fetching or proxying is performed.
- Batch imports use a partial-success strategy: a single file failure does not block the rest of the batch.
- No Docker configuration is provided; the project is designed for direct local execution.

---

<details>
<summary><strong>中文文档</strong></summary>

## 功能介绍

TypingMonkey 是一个本地优先的文档导入、解析与阅读工具。它将多种格式的文档统一转换为结构化数据，并提供阅读进度保存、文档搜索和结构化阅读能力。

**核心功能：**

- 单机免登录模式，自动创建本地用户
- 单文件导入：支持 `md`、`txt`、`pdf`、`docx`、`pptx`、`ppt`
- 批量导入：支持文件夹、`zip`、`7z`、`rar`
- 统一落库为结构化文档块与资源文件
- Markdown 相对路径图片解析
- 阅读进度保存、文档搜索和结构化阅读

**支持格式：**

| 格式     | 扩展名                  | 说明                           |
| -------- | ----------------------- | ------------------------------ |
| PDF      | `.pdf`                  | 基于 pdf-parse                 |
| Word     | `.docx`                 | 基于 mammoth                   |
| 幻灯片   | `.pptx` / `.ppt`        | `.ppt` 需要 LibreOffice 转换   |
| Markdown | `.md` / `.markdown`     | 基于 unified/remark            |
| 纯文本   | `.txt`                  | 原始读取                       |
| 压缩包   | `.zip` / `.7z` / `.rar` | 递归导入其中支持的文件         |

## 技术栈

- **前端：** Next.js 16 + React 19
- **数据库：** Prisma + SQLite
- **任务队列：** BullMQ + Redis
- **对象存储：** S3 兼容存储（如 MinIO）

## 快速开始

### 依赖

- **Node.js** 20+
- **Redis** — 任务队列后端
- **S3 兼容存储** — 例如 [MinIO](https://min.io)
- **LibreOffice** — 用于 `.ppt` 转 `.pptx`
- **7-Zip** — 用于 `.7z` / `.rar` 压缩包

### 安装与启动

```bash
git clone https://github.com/your-org/TypingMonkey.git
cd TypingMonkey
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev       # 启动 Web 服务（端口 3000）
npm run worker    # 启动后台解析 Worker
```

Windows 用户可直接使用：

```bat
start-typingmonkey.bat --migrate
```

### 环境变量

| 变量                   | 说明                  | 示例                     |
| ---------------------- | --------------------- | ------------------------ |
| `DATABASE_URL`         | SQLite 连接字符串      | `file:./dev.db`          |
| `REDIS_URL`            | Redis 连接地址         | `redis://localhost:6379` |
| `S3_ENDPOINT`          | S3 兼容存储端点        | `http://localhost:9000`  |
| `S3_BUCKET`            | 存储桶名称             | `typingmonkey`           |
| `S3_ACCESS_KEY_ID`     | S3 访问密钥            | `minioadmin`             |
| `S3_SECRET_ACCESS_KEY` | S3 密钥               | `minioadmin`             |
| `LIBREOFFICE_PATH`     | LibreOffice 可执行路径 | `/usr/bin/libreoffice`   |
| `SEVEN_ZIP_PATH`       | 7-Zip 可执行路径       | `/usr/bin/7z`            |

## 注意事项

- 扫描版 PDF 若没有文本层，会返回 `NO_TEXT_LAYER`（不包含 OCR 功能）
- 外部图片链接不会被抓取，仅保留原始 URL
- 批量导入采用部分成功策略，单个文件失败不会阻断整批任务
- 当前仓库不包含 Docker 配置，按本机环境直接运行

## 目录说明

| 目录          | 说明                           |
| ------------- | ------------------------------ |
| `src/app`     | 页面与 API 路由                |
| `src/lib`     | 核心业务逻辑、解析器、存储与队列 |
| `src/worker`  | 异步解析 worker                |
| `prisma`      | 数据模型与迁移                 |
| `scripts`     | 辅助脚本                       |

</details>
