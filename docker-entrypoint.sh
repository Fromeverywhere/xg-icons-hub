#!/bin/sh
set -eu

images_dir="/app/images"
default_images_dir="/app/default-images"
icon_pattern='\.(png|jpe?g|gif|svg|webp|avif)$'

if ! mkdir -p "$images_dir"; then
    echo "Error: unable to create $images_dir; check that the mount is writable." >&2
    exit 1
fi

if ! find "$images_dir" -type f | grep -Eiq "$icon_pattern"; then
    if [ ! -d "$default_images_dir" ]; then
        echo "Error: bundled icons directory $default_images_dir is missing." >&2
        exit 1
    fi

    echo "No icons found in $images_dir; initializing bundled icons."
    if ! cp -R "$default_images_dir/." "$images_dir/"; then
        echo "Error: unable to initialize $images_dir; check that the mount is writable." >&2
        exit 1
    fi
fi

# 全量扫库由服务进程启动后异步执行（server/index.js -> thumbnailer.start()）：
# 补齐缺失、重建变更、删除孤儿，且不阻塞网站开放访问。
# 扫库期间 /thumbs 会自动回源到 /images 原图，不会出现破图。
# 手动重扫：docker exec <container> node /app/server/thumbnail-cli.js
if [ "${THUMB_ENABLED:-true}" != "false" ]; then
    echo "Thumbnail sync will run in the background after startup."
fi

# Drop privileges when possible. The initialisation above (creating /app/images,
# copying the bundled icons) needs root, but the web server itself does not.
# If the mounted image directory is not readable by the unprivileged `node`
# user (e.g. a bind mount owned by root with 0700), fall back to running as
# root so existing deployments keep working instead of serving an empty site.
if [ "$(id -u)" = "0" ] && command -v su-exec >/dev/null 2>&1; then
    # /app/thumbs may come from a volume that was created while an earlier
    # release still ran as root. Take it over so thumbnail writes keep working
    # after the switch to the unprivileged user.
    if [ -d /app/thumbs ]; then
        chown -R node:node /app/thumbs 2>/dev/null || true
    fi
    if su-exec node sh -c 'test -r /app/images && test -x /app/images && test -w /app/thumbs' 2>/dev/null; then
        exec su-exec node "$@"
    fi
    echo "Warning: /app/images or /app/thumbs is not writable by the 'node' user; running as root. Adjust the mount permissions to enable the non-root user." >&2
fi

exec "$@"
