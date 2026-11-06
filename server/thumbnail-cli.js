'use strict';

/**
 * Docker 启动阶段的一次性全量扫库（由 docker-entrypoint.sh 调用）。
 * 与服务进程内的 sync/watch 完全幂等，重复执行只会做 stat 比对，不会重复编码。
 * 单独留出 CLI 的好处：启动时先把缩略图补齐再开放访问，且进度直接出现在 docker logs 里。
 */

require('dotenv').config();
const thumbnailer = require('./services/thumbnailer');

(async () => {
    if (!thumbnailer.isAvailable()) {
        console.log('[thumbs] startup scan skipped: ' + (thumbnailer.getUnavailableReason() || 'disabled'));
        return;
    }

    try {
        const stats = await thumbnailer.sync();
        if (stats.failed > 0) {
            console.warn(`[thumbs] ${stats.failed} icon(s) could not be converted; the site will fall back to the originals.`);
        }
    } catch (error) {
        // 不阻断容器启动：服务自身还会再对账一次，且 /thumbs 有原图兜底
        console.error('[thumbs] startup scan failed:', error);
        process.exitCode = 1;
    } finally {
        thumbnailer.stop();
    }
})();
