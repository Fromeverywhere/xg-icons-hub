require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getIcons } = require('./services/iconScanner');
const { applyHtml } = require('./services/htmlTemplate');
const thumbnailer = require('./services/thumbnailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Config Defaults
const CONFIG = {
    SITE_NAME: process.env.SITE_NAME || 'XG-icons',
    LOGO_IMG: process.env.LOGO_IMG || 'favicon.ico',
    COPYRIGHT: process.env.COPYRIGHT || 'By <a href="https://github.com/verkyer/xg-icons-hub" target="_blank">xg-icons-hub</a>. @<a href="https://www.xiaoge.org" target="_blank">XiaoGe</a>.',
    SEO_DESC: process.env.SEO_DESC || '又一个图标托管项目~ 让你的 Docker 、导航站更 Nice！',
    FAVICON: process.env.FAVICON || 'favicon.ico',
    ICP: process.env.ICP || '',
    UMAMI_URL: process.env.UMAMI_URL || '',
    UMAMI_SITE_ID: process.env.UMAMI_SITE_ID || '',
    // sharp 未装好或 THUMB_ENABLED=false 时自动退回原图，站点不会因此打不开
    THUMB_ENABLED: thumbnailer.isAvailable()
};

// Origin of the optional Umami instance, so the CSP can allow exactly that
// host instead of a blanket https: source.
const UMAMI_ORIGIN = (() => {
    try {
        const parsed = new URL(CONFIG.UMAMI_URL);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
    } catch {
        return '';
    }
})();

// Middleware
app.disable('x-powered-by');

// Security headers. Inline scripts are allowed only through a per-request
// nonce (the bootstrap snippet), so script-src does not need 'unsafe-inline'.
// Inline *styles* remain allowed because the UI sets element.style at runtime.
app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    const scriptSrc = ["'self'", `'nonce-${nonce}'`];
    const connectSrc = ["'self'"];
    if (UMAMI_ORIGIN) {
        scriptSrc.push(UMAMI_ORIGIN);
        connectSrc.push(UMAMI_ORIGIN);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline'",
        `script-src ${scriptSrc.join(' ')}`,
        `connect-src ${connectSrc.join(' ')}`,
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
        "form-action 'self'"
    ].join('; '));
    next();
});

// The API is read-only; only GET/HEAD are meaningful and no credentials are sent.
app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

// Static Files - Core Requirement: /images path must remain stable
// ---------------------------------------------------------------- 防盗链
// 目标：不让第三方站点把本站图片当图床内嵌，同时不影响正常使用。
// 放行：本站页面引用（<img>/弹窗/下载按钮/新窗口）、地址栏直开、右键另存为、白名单域名。
// 拦截：外部 Referer 的内嵌请求；浏览器标记 cross-site 且非顶层导航的请求
//       （可挡住 referrerpolicy="no-referrer" 这类绕过）。
function envFlag(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || String(raw).trim() === '') return fallback;
    return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

const HOTLINK = {
    enabled: envFlag('HOTLINK_PROTECTION', true),
    // 允许"没有 Referer"的请求（地址栏直开 / 另存为 / curl 下载）。
    // 设为 false 可更严格，但会让直接粘贴图片地址打开、从新标签页另存为失效。
    allowEmptyReferer: envFlag('HOTLINK_ALLOW_EMPTY_REFERER', true),
    // 额外放行的来源域名，逗号分隔，例如 img.example.com,blog.example.com
    allowedHosts: new Set(
        String(process.env.HOTLINK_ALLOWED_HOSTS || '')
            .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    )
};

let hotlinkBlockCount = 0;

function hostOf(value) {
    try { return new URL(value).host.toLowerCase(); } catch { return ''; }
}

function blockHotlink(req, res, source) {
    if (hotlinkBlockCount < 20) {
        hotlinkBlockCount += 1;
        console.warn(`[hotlink] blocked ${req.method} ${req.originalUrl} <- ${source}`);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(403).type('text/plain; charset=utf-8')
        .send('Hotlink protection: please view this image on the original site.');
}

function hotlinkGuard(req, res, next) {
    if (!HOTLINK.enabled) return next();

    // 响应取决于 Referer，避免共享缓存把 403 或 200 串味
    res.setHeader('Vary', 'Referer');

    const ownHost = String(req.headers.host || '').toLowerCase();
    const referer = req.get('referer') || '';
    const refererHost = referer ? hostOf(referer) : '';
    const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();

    // 1. 本站或白名单来源：放行
    if (refererHost && (refererHost === ownHost || HOTLINK.allowedHosts.has(refererHost))) return next();

    // 2. 顶层导航（用户点链接直接打开图片，或地址栏访问）：放行，属人工查看
    if (fetchDest === 'document') return next();

    // 3. 外部 Referer 的内嵌请求：拦截
    if (refererHost) return blockHotlink(req, res, refererHost);

    // 4. 带了 Referer 却解析不出主机名（畸形值）：不放行，避免靠畸形头绕过
    if (referer && !refererHost) return blockHotlink(req, res, 'malformed-referer');

    // 5. 无 Referer 但浏览器明确标记 cross-site（含 no-referrer 外链）：拦截
    if (fetchSite === 'cross-site') return blockHotlink(req, res, 'cross-site');

    // 6. 无 Referer 且非内嵌：地址栏直开 / 另存为 / 客户端下载
    if (HOTLINK.allowEmptyReferer) return next();
    return blockHotlink(req, res, 'empty-referer');
}

// 原图与缩略图都受保护；/static 的 js/css 不受影响
app.use(['/images', '/thumbs'], hotlinkGuard);

// 原图路径与 URL 一律保持原样：下载、另存为、新窗口打开、弹窗预览都走这里
app.use('/images', express.static(path.join(__dirname, '../images')));

// 列表缩略图：只在容器内部生成，不落进 /app/images（不会污染宿主机图标库）
app.use('/thumbs', express.static(thumbnailer.config.dir, {
    maxAge: '1h',
    index: false,
    dotfiles: 'ignore',
    fallthrough: true
}));

// 缩略图尚未生成 / 生成失败 / 刚新增图标时，直接回源到原图，保证永远不出现破图
app.get('/thumbs/*', (req, res) => {
    const original = thumbnailer.resolveOriginal(req.params[0]);
    if (!original) return res.status(404).end();

    res.sendFile(original, (sendError) => {
        if (sendError && !res.headersSent) res.status(404).end();
    });
});

app.use('/static', express.static(path.join(__dirname, '../static')));

// API Routes
app.get('/api/config.json', (req, res) => {
    res.json(CONFIG);
});

// A very short cache prevents a burst of requests from re-walking the image
// directory on every hit (cheap DoS mitigation) while staying near-real-time.
const ICONS_CACHE_MS = 2000;
let iconsCache = { at: 0, data: null };
app.get('/api/icons.json', (req, res) => {
    try {
        const now = Date.now();
        if (!iconsCache.data || now - iconsCache.at > ICONS_CACHE_MS) {
            iconsCache = { at: now, data: getIcons() };
        }
        res.json(iconsCache.data);
    } catch (error) {
        console.error('Error scanning icons:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Read the template once instead of hitting the filesystem on every request.
let indexTemplate = null;
app.get('/', (req, res) => {
    if (!indexTemplate) {
        indexTemplate = fs.readFileSync(path.join(__dirname, '../views/index.html'), 'utf-8');
    }
    res.type('html').send(applyHtml(indexTemplate, Object.assign({}, CONFIG, {
        CSP_NONCE: res.locals.cspNonce
    })));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Icons:  http://localhost:${PORT}/images`);
    console.log(`- Thumbs: http://localhost:${PORT}/thumbs`);
    console.log(`- API:    http://localhost:${PORT}/api/icons.json`);
    console.log(HOTLINK.enabled
        ? `- Hotlink protection: ON (empty referer: ${HOTLINK.allowEmptyReferer ? 'allow' : 'block'}` +
          `${HOTLINK.allowedHosts.size ? `, allowed: ${[...HOTLINK.allowedHosts].join(',')}` : ''})`
        : '- Hotlink protection: OFF');
    thumbnailer.start();
});
