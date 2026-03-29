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

> ```json
> { "is_typing": true, "is_happy": true }
> ```
>
> **Infinite monkey theorem, but no waiting.**
> Smash your keyboard. Out comes a real document. That's it. That's the app.
>
> 无限猴子定理，但不用等。乱敲键盘，出来的是一篇真文档。就这么简单。

</div>

## The Vibe

Don't read. **Type.**

Your fingers go brrrr on the keyboard — `asdfjkl;` — and somehow a research paper appears on screen. You didn't write it. But it looks like you did.

That's the whole trick. Import a document, then type through it. Every keystroke reveals the next chunk. You feel like a genius. The monkey feels like a genius. Everyone wins.

```console
$ typingmonkey open research.pdf

  your fingers ══> asdfghjkl qwertyuiop
  on screen   ══> Introduction to Quantum Computing
                   The field of quantum computing has...

  your fingers ══> zxcvbnm poiuytrewq lol
  on screen   ══> Chapter 2 · Fundamentals
                   A qubit, unlike a classical bit...

  your fingers ══> pewpewpew fjdkslagh
  on screen   ══> Chapter 3 · Architecture
                   Quantum circuits are composed of...
```

The monkey types. The monkey is happy. The monkey wrote a paper. <sub>infinite typing moment</sub>

<!-- TODO: Record typing-demo.gif and uncomment below -->
<p align="center">
  <img src="docs/assets/typing-demo.gif" width="600" alt="Typing demo" />
</p>

### Feed the Monkey

Drop in your files first, then go wild:

```console
$ typingmonkey import research.pdf
  nom nom · 142 blocks · 12,847 words · 8 images

$ typingmonkey import ./papers/ --batch
  nom nom · 15 queued · 14 ok · 1 skipped (no text layer)
```

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

## 调性

别读。**打字。**

手指在键盘上乱飞——`asdfjkl;`——屏幕上居然出现了一篇论文。你没写过。但看起来就像你写的。

就这么回事。导入文档，然后一路敲下去。每按一个键，就多显示一点内容。你觉得自己是天才。猴子也觉得自己是天才。双赢。

```console
$ typingmonkey open research.pdf

  你的手指 ══> asdfghjkl qwertyuiop
  屏幕显示 ══> 量子计算导论
               量子计算领域近年来...

  你的手指 ══> zxcvbnm 随便打打 poiuy
  屏幕显示 ══> 第二章 · 基础概念
               与经典比特不同，量子比特...

  你的手指 ══> biubiubiu fjdkslagh
  屏幕显示 ══> 第三章 · 架构
               量子电路由一系列量子门组成...
```

猴子在打字。猴子很开心。猴子写出了一篇论文。 <sub>无限打字时刻</sub>

**核心功能：**

- 乱敲键盘 → 输出真实文档内容
- 单文件导入：`md` `txt` `pdf` `docx` `pptx` `ppt`
- 批量导入：文件夹、`zip` `7z` `rar`
- 阅读进度保存、文档搜索、结构化阅读

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
