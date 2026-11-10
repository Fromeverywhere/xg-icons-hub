# xg-icons-hub
🎉又一个图标托管项目~ 让你的 Docker 、导航站更 Nice！

博主提供了自行重置的部分高清图标，可以直接食用，当然亦可私有自行部署。

![demo](demo.webp)

> 本仓库 Fork 自 [verkyer/xg-icons-hub](https://github.com/verkyer/xg-icons-hub)：修复了宽屏首屏只渲染一批、无滚动条的问题，并同时发布到 **Docker Hub** 与 **ghcr** 两个镜像源（见 [Docker 部署](#docker-部署)）。

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

镜像同时发布在 **Docker Hub** 与 **GitHub Container Registry (ghcr)**，两者内容一致，二选一即可：

| 源 | 镜像地址 |
| --- | --- |
| Docker Hub | `fromeverywhere/xg-icons-hub:0.8.7` |
| GitHub Container Registry | `ghcr.io/fromeverywhere/xg-icons-hub:0.8.7` |

> 拉 Docker Hub 慢或不通时，把镜像换成 ghcr 那一行即可。两个源都同时提供 `0.8.7`（固定版本）与 `latest`（跟随最新发布）两个标签。宿主机图标路径 `./images`、映射端口 `28080` 均可按需改动；图标放在 `images/<分类>/<图标文件>`。

### docker compose（推荐）

仓库自带 [`docker-compose.yaml`](./docker-compose.yaml)，**所有环境变量都列在里面**（默认值已注释，取消注释即可改）。最小可用版：

```yaml
services:
  xg-icons-hub:
    image: fromeverywhere/xg-icons-hub:0.8.7   # 或 ghcr.io/fromeverywhere/xg-icons-hub:0.8.7
    container_name: xg-icons-hub
    ports:
      - "28080:5000"                 # 左侧宿主机端口可按需改
    volumes:
      - ./images:/app/images         # 宿主机图标目录
      - xg-thumbs:/app/thumbs        # 缩略图持久化（别挂到 /app/images 下）
    # environment:                   # 全部有默认值，按需取消注释：
    #   - SITE_NAME=我的图标库
    #   - THUMB_SCAN_INTERVAL=60
    restart: unless-stopped

volumes:
  xg-thumbs:
```

### docker run（不想用 compose）

```bash
docker run -d --name xg-icons-hub \
  -p 28080:5000 \
  -v "$PWD/images:/app/images" \
  -v xg-thumbs:/app/thumbs \
  -e SITE_NAME="我的图标库" \
  --restart unless-stopped \
  fromeverywhere/xg-icons-hub:0.8.7
# 或改用 ghcr 源： ghcr.io/fromeverywhere/xg-icons-hub:0.8.7
```

## 缩略图与目录监控（Docker）

默认开启。图标列表只加载轻量的 WebP 缩略图，**点开弹窗才请求原图**；下载按钮、新窗口打开、弹窗预览全部仍指向 `/images/...` 原图，对外链接与改造前完全兼容。

### 工作方式

| 阶段 | 行为 |
| --- | --- |
| 容器启动 | 服务进程启动后立即**异步**全量扫库：补齐缺失、重建变更、删除孤儿。不阻塞访问，扫库未完成的缩略图会自动回源原图 |
| 运行中（增量） | `fs.watch` 递归监控 `/app/images`，防抖后增量对账，新增/删除图标即时生效 |
| 运行中（兜底） | 每 `THUMB_SCAN_INTERVAL` 秒再全量对账一次，防止文件系统事件丢失 |
| 缩略图缺失或生成失败 | `/thumbs/...` 自动回源到 `/images/...` 原图；前端还有两级 `onerror` 兜底，不会出现破图 |

- 缩略图放在**容器内** `/app/thumbs`，不写进宿主机挂载的 `./images`，也不会被挂载覆盖，原图标库零污染。
- 默认每次重建容器会重新生成缩略图（几百张只需几秒）。要跨重建保留，按上面的 compose 示例挂一个 named volume 到 `/app/thumbs`；**不要**把它挂到 `/app/images` 下面，否则会污染原图目录。
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
| `THUMB_SCAN_INTERVAL` | `60` | 定时全量扫库间隔（秒），`0` = 关闭；多个 bind mount 下 inotify 事件可能不全，靠它兜底 |
| `THUMB_DIR` | `/app/thumbs` | 缩略图目录，务必与 `/app/images` 分开 |
| `THUMB_SIZE` | `128` | 缩略图最大边长 px（32–1024） |
| `THUMB_QUALITY` | `75` | WebP 质量（10–100） |
| `THUMB_CONCURRENCY` | `4` | 启动扫库并发数 |
| `THUMB_WATCH_DEBOUNCE` | `1200` | 目录监控防抖（毫秒） |

完整示例见 [docker-compose.yaml](./docker-compose.yaml)，也可直接 `docker run -e THUMB_WATCH=false -e THUMB_SCAN_INTERVAL=0 ...`。

> **多个 bind mount / Docker Desktop（Windows、macOS）注意**：目录按分类分别挂载时，跨挂载点的 inotify 事件不保证完整；Docker Desktop 的 bind mount 更是通常不转发宿主机文件事件。默认 `60` 秒的定时全量对账就是为此兜底（一次对账几十到几百毫秒）。只有「Linux 宿主机 + 单一挂载 + 已验证 `fs.watch` 生效」时才建议设 `THUMB_SCAN_INTERVAL=0` 纯靠监控。
>
> 随时手动重扫：`docker exec xg-icons-hub-dev node /app/server/thumbnail-cli.js`

### 关闭与降级

`THUMB_ENABLED=false` 时前端直接请求原图，行为与改造前一致。若镜像里 `sharp` 没装好（例如多架构构建缺少对应预编译二进制），服务会自动检测并关闭缩略图，站点不会报错，只是退回原图。

> Cloudflare Pages / EdgeOne Pages 等静态部署不运行 Node 服务，`dist` 中 `THUMB_ENABLED=false`，列表继续用原图，行为不变。

## 防盗链

默认开启，用于阻止第三方站点把本站图片当图床直接内嵌（`<img>`、CSS 背景图、iframe 等）。只作用于 `/images`（原图）与 `/thumbs`（缩略图），不影响 `/static` 的 JS/CSS。

| 场景 | 结果 |
| --- | --- |
| 本站页面显示图标（列表 / 弹窗 / 下载按钮 / 新窗口打开） | ✅ 放行 |
| 地址栏直接打开图片地址、右键「另存为」 | ✅ 放行（默认） |
| 其他站点页面里 `<img src="你的域名/images/...">` | ⛔ 403 |
| 其他站点用 `referrerpolicy="no-referrer"` 绕过 Referer | ⛔ 403（依据 `Sec-Fetch-Site: cross-site`） |
| 从别的站点点链接跳到图片本身（顶层导航） | ✅ 放行（属人工查看，不是内嵌） |

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HOTLINK_PROTECTION` | `true` | 总开关，设为 `false` 完全关闭 |
| `HOTLINK_ALLOW_EMPTY_REFERER` | `true` | 是否放行不带 `Referer` 的请求。设为 `false` 更严格，但会挡住「粘贴图片地址直接打开」和部分另存为场景 |
| `HOTLINK_ALLOWED_HOSTS` | （空） | 额外放行的来源域名，逗号分隔，如 `img.example.com,blog.example.com`。自己有站点要引用本站图片时用 |

触发拦截时返回 `403` 与一行纯文本，并在容器日志里输出前 20 条 `[hotlink] blocked ...` 方便排查（不会无上限刷日志）。

> 说明：防盗链基于 `Referer` / `Sec-Fetch-*` 判定，属于「防普通滥用」而非强安全边界。直接用 `curl` 或不带任何请求头的客户端仍可下载单张图片——这是为了保证「另存为 / 直接打开」可用的必然取舍。若要更严，可把 `HOTLINK_ALLOW_EMPTY_REFERER=false`，或在前置反向代理（Nginx / Cloudflare）层再加一层规则。

## 环境变量（站点）

> 缩略图相关的 Docker 变量见上一节；以下为站点显示类变量。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SITE_NAME` | `XG-icons` | 站点名称（浏览器标题、页面大标题） |
| `LOGO_IMG` | `favicon.ico` | 页面内 Logo，支持完整 `http(s)` 链接或相对路径（如 `images/website/GitHub.png`） |
| `FAVICON` | `favicon.ico` | 浏览器标签图标，支持完整链接或相对路径 |
| `COPYRIGHT` | 项目版权声明 | 页脚版权信息（HTML 文本） |
| `ICP` | （空） | 备案号文本，设置后显示在版权信息下方 |
| `SEO_DESC` | 项目简介 | 页面 `<meta name="description">` 文本 |
| `UMAMI_URL` | （空） | Umami 服务根地址；官方托管填 `https://cloud.umami.is`，自托管填自己的地址 |
| `UMAMI_SITE_ID` | （空） | Umami 后台网站 ID；与 `UMAMI_URL` 同时设置后注入跟踪代码 |

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
    image: fromeverywhere/xg-icons-hub:0.8.7   # 或 ghcr.io/fromeverywhere/xg-icons-hub:0.8.7
    container_name: xg-icons-hub
    ports:
      - "28080:5000"
    restart: unless-stopped
```

> 适用于仅需要「项目自带图标」，无自行图标托管需求的场景

## 自动构建与发布

镜像由 GitHub Actions 构建，**一次构建同时推两个仓库**，因此 Docker Hub 与 ghcr 上的同名标签永远是同一个镜像（同一 manifest digest）。工作流：[`.github/workflows/docker-publish.yaml`](./.github/workflows/docker-publish.yaml)。

### 发版

在 GitHub 上发布一个 Release（tag 形如 `v0.8.7`）即可，自动完成：

```
Release v0.8.7
   ↓
解析版本号（去掉前导 v）→ 0.8.7
   ↓
构建 linux/amd64 + linux/arm64
   ↓
推 ghcr.io/…:0.8.7、ghcr.io/…:latest
   docker.io/…:0.8.7、docker.io/…:latest
   ↓
逐个标签校验，必须全部指向同一 manifest，否则任务失败
```

版本号优先级：Release tag → 手动运行时的 `version` 输入 → commit 短 sha。

### 手动运行

Actions 页面选 `Build and push images` → Run workflow，可填：

| 输入 | 默认 | 说明 |
| --- | --- | --- |
| `version` | 空（用 commit 短 sha） | 镜像标签，如 `0.8.7`；不要带 `v` |
| `push_latest` | `true` | 是否同时移动 `latest`；补历史版本时填 `false` |
| `platforms` | `linux/amd64,linux/arm64` | 多架构构建列表；只想快速验证可只留 `linux/amd64` |
| `targets` | `both` | `both` / `hub` / `ghcr`，只推其中一个仓库时用 |

> 只推 ghcr 或只推 hub 时，最后的「digest 一致」校验会自动跳过。

### 需要的仓库配置

- Secrets：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`（Docker Hub 的 Access Token，非登录密码）。
- GHCR 默认用内置 `GITHUB_TOKEN`，无需额外配置。**注意**：如果镜像包最初是手工用 PAT 推上去的，需在包的 Settings → *Manage Actions access* 里把本仓库加为 `Write`，否则会报 `permission_denied: write_package`。也可以用有 `write:packages` 的 PAT 存成 secret `GHCR_PAT`，工作流会优先使用它。

### 本地自己构建

```bash
npm ci && npm run build          # 产出 dist
docker build -t xg-icons-hub:dev .
```

### 删除误推的标签

Actions 页面选 `Delete image tags` → Run workflow，填标签名与 `both`/`hub`/`ghcr`。它拒绝删除 `latest` 与版本号标签，避免误伤正式发布。

> 两端删除机制不同：ghcr 走 GitHub Packages API（registry API 不支持删 manifest，会返回 405）；Docker Hub 先用 `auth.docker.io` 换 registry token 按 digest 删 manifest，该操作需要 `delete` 动作（**Read, Write, Delete** 级 token）。若返回 `401 Action: delete`，工作流会自动回退到 `hub.docker.com` 的 tag API 按标签删除 —— **Read & Write** 级 token 就够（实测 PAT + `Authorization: JWT` → 204）。只有两条路都失败时才需要到仓库页 Tags 里手删。
>
> 删除是「按 manifest digest」生效的：若 `latest` 等标签与目标标签指向同一个 digest，会一起消失。工作流在两端都会先检查是否有兄弟标签，发现即拒绝执行；GHCR 侧同理会检查该 package version 是否还挂着其它 tag。

## 安全

- **输出转义**：所有来自环境变量的展示文本按上下文转义——标题/页脚文字做 HTML 文本转义，Logo / Favicon / SEO 描述做属性转义；`COPYRIGHT` 按设计仍按 HTML 渲染（如需纯文本请自行转义）。
- **安全响应头**：默认返回 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy`、`Permissions-Policy` 与 CSP。内联启动脚本使用**每请求 nonce**，`script-src` 不含 `unsafe-inline`，并仅额外放行 Umami 实际来源。
- **路径穿越**：`/thumbs/*` 回源与 `/images` 静态服务都做了目录边界校验，无法越出图标目录。
- **非 root 运行**：入口脚本先以 root 完成初始化（创建 `/app/images`、拷贝内置图标），随后若 `node` 用户可读 `/app/images` 就自动降权；若挂载目录权限过严（如 `root:root 0700`）则回退 root 并打印警告。想启用非 root，确保宿主机 `./images` 对 UID 1000 可读（如 `chmod -R a+rX ./images`）。
- **依赖**：`npm audit` 当前 0 漏洞（`sharp` ≥ 0.35.5）；建议部署前定期复查。

## 说明
- 构建脚本：[build.js](./build.js) 使用 Node.js 内置模块，将图标数据生成为静态 JSON（`/api/icons.json`、`/api/config.json`），以及复制资源至 `dist`。
- 前端通过静态接口加载数据：[static/script.js](./static/script.js)，弹窗交互见 [static/modal.js](./static/modal.js)。
- 缩略图服务（仅 Docker 运行时）：[server/services/thumbnailer.js](./server/services/thumbnailer.js) 负责对账/监控/清理，[server/thumbnail-cli.js](./server/thumbnail-cli.js) 供手动重扫。
