const path = require('path');

/**
 * Normalizes asset paths (logo, favicon).
 * @param {string} val - The path or URL from config.
 * @param {string} defaultName - The default filename (e.g., 'favicon.ico').
 * @returns {string} Normalized path.
 */
function normalizeAsset(val, defaultName = 'favicon.ico') {
    let asset = val || defaultName;
    // If it's an absolute URL, return as is
    if (/^https?:\/\//.test(asset)) {
        return asset;
    }
    // Special case for default 'favicon.ico' -> map to /static/favicon.ico
    if (asset === defaultName) {
        return '/static/favicon.ico';
    }
    // Ensure it starts with /
    return asset.startsWith('/') ? asset : `/${asset}`;
}

function normalizeUmamiUrl(val) {
    const url = (val || '').trim().replace(/\/+$/, '');
    if (!url) return '';

    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
    } catch {
        return '';
    }
}

function escapeHtmlAttribute(val) {
    return String(val).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

/** Escape a value for an HTML text node (title, footer text, ...). */
function escapeHtmlText(val) {
    return String(val).replace(/[&<>]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    })[char]);
}

/**
 * Injects configuration values into the HTML template.
 *
 * All values that come from the environment are escaped according to the
 * context they are placed in (attribute vs. text). COPYRIGHT is intentionally
 * treated as trusted HTML (documented behaviour: "页脚版权信息（HTML 文本）").
 *
 * Function replacers are used everywhere so characters like `$&` in a config
 * value can never be interpreted as String.replace substitution patterns.
 *
 * @param {string} html - The raw HTML template.
 * @param {object} config - The configuration object containing SITE_NAME, LOGO_IMG, etc.
 * @returns {string} The processed HTML.
 */
function applyHtml(html, config) {
    const name = escapeHtmlText((config.SITE_NAME || 'XG-icons').trim());

    const logo = normalizeAsset(config.LOGO_IMG, 'favicon.ico');
    const favicon = normalizeAsset(config.FAVICON, 'favicon.ico');

    let out = html;

    // Replace Title
    out = out.replace(/<title>.*?<\/title>/i, () => `<title>${name}</title>`);
    out = out.replace(/<h1 id="siteTitle">.*?<\/h1>/i, () => `<h1 id="siteTitle">${name}</h1>`);

    // Replace Logo
    out = out.replace(/(<img id="siteLogo"[^>]*\bsrc=")[^"]*"/i, (match, prefix) => `${prefix}${escapeHtmlAttribute(logo)}"`);

    // Replace Favicon
    out = out.replace(/(<link id="faviconLink"[^>]*\bhref=")[^"]*"/i, (match, prefix) => `${prefix}${escapeHtmlAttribute(favicon)}"`);

    // Replace Meta Description
    const seoDesc = escapeHtmlAttribute(config.SEO_DESC || '又一个图标托管项目~ 让你的 Docker 、导航站更 Nice！');
    if (/name="description"/i.test(out)) {
        out = out.replace(/<meta name="description"[^>]*content="[^"]*"[^>]*>/i, () => `<meta name="description" content="${seoDesc}">`);
    } else {
        // Insert after </title> if not found
        out = out.replace(/<\/title>/i, () => `</title>\n    <meta name="description" content="${seoDesc}">`);
    }

    // Inject Umami analytics when both settings are configured
    const umamiUrl = normalizeUmamiUrl(config.UMAMI_URL);
    const umamiSiteId = (config.UMAMI_SITE_ID || '').trim();
    if (umamiUrl && umamiSiteId) {
        const scriptUrl = escapeHtmlAttribute(`${umamiUrl}/script.js`);
        const siteId = escapeHtmlAttribute(umamiSiteId);
        out = out.replace(/<\/head>/i, () => `    <script defer src="${scriptUrl}" data-website-id="${siteId}"></script>\n</head>`);
    }

    // 缩略图开关直接内联进 HTML，首屏渲染不必等 /api/config.json 返回。
    // 静态构建（Cloudflare / EdgeOne Pages）传入 false，因此不会去请求不存在的 /thumbs。
    if (config.THUMB_ENABLED) {
        const nonceAttr = config.CSP_NONCE ? ` nonce="${escapeHtmlAttribute(config.CSP_NONCE)}"` : '';
        out = out.replace(/<\/head>/i, () => `    <script${nonceAttr}>window.__XG_THUMBS__=true;</script>\n</head>`);
    }

    // Replace Footer. COPYRIGHT stays raw HTML by design; ICP is plain text and
    // must be escaped (it is also escaped client-side in static/script.js).
    const icp = config.ICP
        ? `<br><a id="icpLink" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer nofollow">${escapeHtmlText(config.ICP)}</a>`
        : '';
    const footerContent = (config.COPYRIGHT || '') + icp;

    out = out.replace(/(<footer id="siteFooter"[^>]*>)[\s\S]*?(<\/footer>)/i, (match, open, close) => `${open}${footerContent}${close}`);
    out = out.replace(/(<footer id="mobileFooter"[^>]*>)[\s\S]*?(<\/footer>)/i, (match, open, close) => `${open}${footerContent}${close}`);

    return out;
}

module.exports = { applyHtml };
