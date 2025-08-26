# Wedding Greet

A tiny site to collect friends’ blessings (images/videos) for a wedding.
Frontend: **Vite + TypeScript**.
Backend: **Cloudflare Workers + R2** (private bucket + signed token).

一个收集婚礼祝福（图片/视频）的小站。
前端 **Vite + TS**，后端 **Cloudflare Workers + R2**（私有桶 + 口令登录签名 Token）。

---

## 0) Requirements / 环境要求

* **Node.js ≥ 20**
* **npm** (或 pnpm/yarn，自行替换命令)
* **Cloudflare account** with:

  * **Workers** enabled
  * **R2** bucket (建议名：`blessings`)

---

## 1) Project Structure / 目录结构

```
.
├─ edge/                # Cloudflare Worker（API）
│  ├─ src/index.ts      # Worker 路由与签名、鉴权、R2 访问
│  └─ wrangler.toml     # Worker & R2 绑定配置
├─ src/                 # 前端源码（Vite）
│  ├─ main.ts           # UI 逻辑与 API 调用
│  └─ style.css, index.html
├─ .env.local           # 前端本地环境变量（可选）
├─ .env.production      # CI 构建时注入（可选）
└─ package.json
```

---

## 2) Frontend env / 前端环境变量

前端只需要 **一个**变量，告诉页面你的 API 地址：

```env
# .env.local（本地开发） or 在 GitHub Pages 环境变量里设置
VITE_API_BASE=https://<your-worker-subdomain>.workers.dev
# 本地联调 Worker 时也可用：http://127.0.0.1:8787
```

> GitHub Pages 部署时，请在 Repository → **Settings → Environments → github-pages**
> 添加 **Environment variable** `VITE_API_BASE`，值为你线上 Worker 地址。

---

## 3) Worker config / Worker 环境与密钥

### 3.1 R2 绑定（`edge/wrangler.toml`）

```toml
name = "xiangrou-api"            # Worker 名称（小写-连字符）
main = "src/index.ts"
compatibility_date = "2024-05-01"

[[r2_buckets]]
binding = "R2"
bucket_name = "blessings"        # 你的 R2 桶名
```

### 3.2 本地调试变量（`.dev.vars`，放在 `edge/` 目录）

```env
# 口令的 SHA256 明文（见下节），不要写明文口令
VIEWER_SHA256=xxxxxxxxxxxxxxxx
ADMIN_SHA256=yyyyyyyyyyyyyyyy
SIGNING_SECRET=dev-any-random-string-32-bytes
TOKEN_TTL=3600
# 允许的 Origin（逗号分隔，按需添加）
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173,https://hoovichen.github.io
```

> **SHA256 的生成**（举例）：
>
> * macOS/Linux:
>
>   ```bash
>   echo -n 'viewers' | shasum -a 256 | awk '{print $1}'
>   echo -n 'admin'   | shasum -a 256 | awk '{print $1}'
>   ```
> * Windows PowerShell:
>
>   ```powershell
>   "viewers" | % { $_.ToCharArray() } | Format-Hex -Encoding Byte | Out-String
>   # 也可使用 openssl： echo -n viewers | openssl dgst -sha256
>   ```

### 3.3 线上密钥

部署后在 Cloudflare Dashboard：

* Worker → **Settings → Variables**：添加 **Text** 类型变量

  * `VIEWER_SHA256`
  * `ADMIN_SHA256`
  * `SIGNING_SECRET`
  * `TOKEN_TTL`（可选，默认 3600 秒）
  * `CORS_ORIGIN`（逗号分隔，包含 Pages 域名）
* R2：创建 bucket（如 `blessings`），**不要**开启 Public Access。

---

## 4) Run locally / 本地启动

### 4.1 启动 Worker（在 `edge/` 目录）

```bash
cd edge
npm i
# 本地运行，端口默认 8787
npx wrangler dev
```

看到日志 `Ready on http://127.0.0.1:8787` 即成功。

### 4.2 启动前端（在项目根目录）

```bash
npm i
npm run dev
# Vite dev server: http://127.0.0.1:5173
```

> 开发时，`.env.local` 里的 `VITE_API_BASE` 可以写 `http://127.0.0.1:8787` 与本地 Worker 联调。

---

## 5) Deploy / 部署

### 5.1 部署 Worker

```bash
cd edge
# 首次：确保 wrangler.toml 正确、变量在 Cloudflare Dashboard 已设置
npx wrangler deploy
```

部署完成会得到一个线上域名：
`https://<your-worker-subdomain>.workers.dev`

### 5.2 部署 GitHub Pages

仓库已有 GitHub Actions（`gh-pages.yml`），会在 push 到 `main` 时自动构建并发布到 Pages。
务必在 **github-pages 环境** 中设置环境变量：

* `VITE_API_BASE=https://<your-worker-subdomain>.workers.dev`

> 如果你改了分支或工作流，请同步修改 Actions 的触发条件。

---

## 6) Admin/Viewer 登录口令 / Login codes

* **viewer**：可查看画廊
* **admin**：可查看 + 上传 + 删除

前端弹窗输入明文口令（如 `viewers` / `admin`），Worker 端会校验其 **SHA256** 是否与环境变量匹配。校验通过后返回一个 **JWT-like** 的签名 token（HMAC-SHA256），前端会：

* 对普通 API（列表、删除、上传）通过 `Authorization: Bearer <token>` 访问；
* 对 `<video>`/`<img>` 文件，使用 `?t=<token>` 作为查询参数访问（因为媒体标签不会带 Header）。

---

## 7) Useful npm scripts / 常用脚本

```bash
# 前端开发（Vite）
npm run dev

# 前端本地构建（产物在 /dist）
npm run build

# （在 edge/ 目录）
# Worker 本地启动
npx wrangler dev

# Worker 部署
npx wrangler deploy
```

> 你也可以在 `package.json` 里加上便捷脚本，比如：
>
> ```json
> {
>   "scripts": {
>     "api:dev": "cd edge && wrangler dev",
>     "api:deploy": "cd edge && wrangler deploy"
>   }
> }
> ```

---

## 8) Troubleshooting / 常见问题

* **401 Unauthorized when playing video**

  * `<video>` 请求不会带 Authorization；本项目已通过 `?t=<token>` 携带。
  * 若仍 401，请检查 Worker 端 `/file` 路由是否用 **`pickToken(req,url)`** 读取 URL 参数并 `verify`。
* **CORS blocked**

  * 确保 `CORS_ORIGIN` 包含你的来源：本地 `http://127.0.0.1:5173`、`http://localhost:5173` 和线上 `https://<user>.github.io`。
* **Token 过期**

  * 默认 `TOKEN_TTL=3600` 秒。过期会 401，重新输入口令。
* **Cannot read properties of null (reading 'content')**

  * 这是前端在渲染空画廊时没有找到模板的报错。确保 `index.html` 里包含：

    ```html
    <template id="card-empty"> ... </template>
    <template id="card-skeleton"> ... </template>
    ```
* **GitHub Pages 页面空白**

  * 没有设置 `VITE_API_BASE` 到你的 Worker 域名；或 Worker 还未部署成功。

---

## 9) API (for reference) / API 说明（简要）

* `POST /login` `{ role: 'viewer'|'admin', code: string }` → `{ token, role, ttl }`
* `GET  /list`   (Authorization) → `{ items: [{key,type,size,uploaded}], truncated }`
* `GET  /file/<key>?t=<token>`   （用于 `<video>`/`<img>`，支持 Range）
* `POST /upload` （Authorization + formData: file）
* `DELETE /file/<key>` （Authorization, admin only）

---
## 10) License

MIT License

Copyright (c) 2025 HineocVC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.




