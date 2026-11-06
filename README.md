# xg-icons-hub
🎉又一个图标托管项目~ 让你的 Docker 、导航站更 Nice！

博主提供了自行重置的部分高清图标，可以直接食用，当然亦可私有自行部署。

![demo](demo.webp)

## 快速部署

Fork 本仓库到你的 GitHub 账号，图标路径 `/images` 下可替换为自己的图标，格式为：`/images/目录名/图标文件` 

### Cloudflare Pages
- 默认即可部署（安装阶段执行 `postinstall` 生成 `dist` 并发布）。
- 可选参数（如需手动设置）：
  - 构建命令：`npm ci` 或 `npm run build`（默认即可）
  - 输出目录：`dist`
- `UMAMI_URL`、`UMAMI_SITE_ID` 等环境变量需要配置为构建环境变量；修改后需重新部署。

### EdgeOne Pages
- 必须在「构建设置」里将 输出目录 设置为：`dist`
- 其他参数（默认即可）：
  - 框架设置：Other
  - 根目录：./
  - 安装命令：`npm ci`
  - 构建命令：留空 或 `npm run build`

## 本地开发
- 构建：`npm run build`
- 预览（可选，本地 Node 服务器）：`npm start`（默认端口 `5000`）

## Docker 部署

宿主机图标路径：`./images` 、映射端口 `28080` 均可按需改动。

- Docker Hub 镜像：

```yaml
services:
  xg-icons-hub:
    image: verky/xg-icons-hub:latest
    container_name: xg-icons-hub
    ports:
      - "28080:5000"
    volumes:
      - ./images:/app/images
    environment:
      - SITE_NAME=xg-icons-hub
      # 可选变量（按需打开）：
      # - LOGO_IMG=images/website/GitHub.png
      # - FAVICON=/static/favicon.ico
      # - COPYRIGHT=版权所有 © 2026
      # - ICP=粤ICP备12345678号-1
      # - SEO_DESC=站点描述
      # - UMAMI_URL=https://cloud.umami.is
      # - UMAMI_SITE_ID=网站 ID
    restart: unless-stopped
```

- ghcr 镜像版，可改为 `ghcr.io/verkyer/xg-icons-hub:latest`

## 缩略图与目录监控（Docker）

默认开启。图标列表只加载轻量的 WebP 缩略图，**点开弹窗才请求原图**；复制链接、下载图标、新窗口打开、弹窗预览全部仍指向 `/images/...` 原图，对外链接与改造前完全兼容。

### 工作方式

| 阶段 | 行为 |
| --- | --- |
| 容器启动 | 服务进程启动后立即**异步**全量扫库：补齐缺失、重建变更、删除孤儿。不阻塞访问，扫库未完成的缩略图会自动回源原图 |
| 运行中（增量） | `fs.watch` 递归监控 `/app/images`，防抖后增量对账，新增/删除图标即时生效 |
| 运行中（兜底） | 每 `THUMB_SCAN_INTERVAL` 秒再全量对账一次，防止文件系统事件丢失 |
| 缩略图缺失或生成失败 | `/thumbs/...` 自动回源到 `/images/...` 原图；前端还有两级 `onerror` 兜底，不会出现破图 |

- 缩略图放在**容器内** `/app/thumbs`，不写进宿主机挂载的 `./images`，也不会被挂载覆盖，原图标库零污染。
- 命名：`images/ai/ChatGPT.png` → `thumbs/ai/ChatGPT.png.webp`（保留原扩展名，避免 `a.png` 与 `a.webp` 撞名）。
- 统一输出 WebP 并保留透明通道，最大边长默认 128px（卡片实际只显示 52px，足够 2x 屏）；PNG/JPG/GIF/SVG/WebP/AVIF 均可处理，GIF 取首帧，弹窗里仍是完整原图。
- `.manifest.json` 记录每个原图生成时的 size/mtime：未变化的文件不会重复编码；改动 `THUMB_SIZE` / `THUMB_QUALITY` 会自动全量重建。
- 原图被删后，对应缩略图在下一轮扫库时一并删除，并清理空目录与残留临时文件，占用不会持续膨胀。
- 生成采用有限并发（默认 4）+ 原子写入（临时文件 + rename），启动扫库不会打满 CPU，也不会读到半成品。
- 缩略图带 1 小时浏览器缓存（同时输出 ETag / Last-Modified）。替换同名原图后缩略图会重新生成，强制刷新或等缓存过期即可看到新图。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `THUMB_ENABLED` | `true` | 缩略图总开关，设为 `false` 完全回退原图 |
| `THUMB_WATCH` | `true` | 目录监控开关 |
| `THUMB_SCAN_INTERVAL` | `300` | 定时全量扫库间隔（秒），`0` = 关闭 |
| `THUMB_DIR` | `/app/thumbs` | 缩略图目录，务必与 `/app/images` 分开 |
| `THUMB_SIZE` | `128` | 缩略图最大边长 px（32–1024） |
| `THUMB_QUALITY` | `75` | WebP 质量（10–100） |
| `THUMB_CONCURRENCY` | `4` | 启动扫库并发数 |
| `THUMB_WATCH_DEBOUNCE` | `1200` | 目录监控防抖（毫秒） |

完整示例见 [docker-compose.yaml](./docker-compose.yaml)，也可直接 `docker run -e THUMB_WATCH=false -e THUMB_SCAN_INTERVAL=0 ...`。

> **Docker Desktop（Windows / macOS）注意**：bind mount 通常不会把宿主机的文件事件转发进容器，`fs.watch` 可能收不到变更。请保留定时扫库，并把 `THUMB_SCAN_INTERVAL` 调小（如 `60`）。只有 Linux 宿主机才建议设 `THUMB_SCAN_INTERVAL=0` 只依赖监控。
>
> 随时手动重扫：`docker exec xg-icons-hub-dev node /app/server/thumbnail-cli.js`

### 关闭与降级

`THUMB_ENABLED=false` 时前端直接请求原图，行为与改造前一致。若镜像里 `sharp` 没装好（例如多架构构建缺少对应预编译二进制），服务会自动检测并关闭缩略图，站点不会报错，只是退回原图。

> Cloudflare Pages / EdgeOne Pages 等静态部署不运行 Node 服务，`dist` 中 `THUMB_ENABLED=false`，列表继续用原图，行为不变。

## 环境变量（站点）

> 缩略图相关的 Docker 变量见上一节；以下为站点显示类变量。

- `SITE_NAME`：站点名称（浏览器标签标题、页面大标题）
- `LOGO_IMG`：页面内 Logo 图（支持完整 `http(s)` 链接或相对路径，如 `images/website/GitHub.png`）
- `FAVICON`：浏览器标签图标（支持完整链接或相对路径；未设置时默认使用 `/static/favicon.ico`）
- `COPYRIGHT`：页脚版权信息（HTML 文本）
- `ICP`：备案号文本；设置后显示在版权信息下方，未设置则不显示
- `SEO_DESC`：页面 `<meta name="description">` 文本
- `UMAMI_URL`：Umami 服务根地址；官方托管填写 `https://cloud.umami.is`，自托管填写自己的 Umami 地址
- `UMAMI_SITE_ID`：Umami 后台的网站 ID；与 `UMAMI_URL` 同时设置后，跟踪代码会自动注入页面 `<head>`

> `UMAMI_URL`、`UMAMI_SITE_ID` 需要同时设置才会启用统计

生成与使用流程：
- 安装或构建时，[build.js](./build.js) 会把环境变量写入 `dist/api/config.json`
- 构建与服务端渲染会在首页 HTML 中直接注入标题/Logo/描述/页脚（含 ICP）及 Umami 跟踪代码，避免首次加载闪烁
- 服务端（Docker）会按 `THUMB_ENABLED` 内联 `window.__XG_THUMBS__`，决定列表请求 `/thumbs` 还是 `/images`；静态构建固定为关闭
- 前端运行时由 [static/script.js](./static/script.js) 读取并同步页面状态（与后端注入一致）

## Docker 极速部署

```yaml
services:
  xg-icons-hub:
    image: verky/xg-icons-hub:latest
    container_name: xg-icons-hub
    ports:
      - "28080:5000"
    restart: unless-stopped
```

> 适用于仅需要「项目自带图标」，无自行图标托管需求的场景

## 说明
- 构建脚本：[build.js](./build.js) 使用 Node.js 内置模块，将图标数据生成为静态 JSON（`/api/icons.json`、`/api/config.json`），以及复制资源至 `dist`。
- 前端通过静态接口加载数据：[static/script.js](./static/script.js)，弹窗交互见 [static/modal.js](./static/modal.js)。
- 缩略图服务（仅 Docker 运行时）：[server/services/thumbnailer.js](./server/services/thumbnailer.js) 负责对账/监控/清理，[server/thumbnail-cli.js](./server/thumbnail-cli.js) 供手动重扫。
