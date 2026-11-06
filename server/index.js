require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// Middleware
app.use(cors());

// Static Files - Core Requirement: /images path must remain stable
// 原图路径与 URL 一律保持原样：外链、复制、下载、弹窗预览都走这里
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

app.get('/api/icons.json', (req, res) => {
    try {
        const data = getIcons();
        res.json(data);
    } catch (error) {
        console.error('Error scanning icons:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    const html = applyHtml(fs.readFileSync(path.join(__dirname, '../views/index.html'), 'utf-8'), CONFIG);
    res.type('html').send(html);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Icons:  http://localhost:${PORT}/images`);
    console.log(`- Thumbs: http://localhost:${PORT}/thumbs`);
    console.log(`- API:    http://localhost:${PORT}/api/icons.json`);
    thumbnailer.start();
});
