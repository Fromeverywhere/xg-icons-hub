/* Icon preview modal. */
(function () {
    'use strict';

    let overlayEl = null;
    let modalEl = null;
    let previewEl = null;
    let previewToggle = null;
    let openInNewWindowLink = null;
    let previousButton = null;
    let nextButton = null;
    let imgEl = null;
    let nameEl = null;
    let formatEl = null;
    let catEl = null;
    let categoryBtn = null;
    let downloadLink = null;
    let appWindow = null;
    let lastFocus = null;
    let previewTheme = 'light';
    let currentIcons = [];
    let currentIndex = -1;
    let swipeStart = null;

    function build() {
        overlayEl = document.createElement('div');
        overlayEl.className = 'icon-modal-overlay';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.setAttribute('aria-labelledby', 'iconModalTitle');
        overlayEl.setAttribute('aria-hidden', 'true');
        overlayEl.inert = true;

        modalEl = document.createElement('div');
        modalEl.className = 'icon-modal';
        modalEl.setAttribute('tabindex', '-1');
        modalEl.innerHTML =
            '<div class="icon-modal-header">' +
            '<div class="icon-modal-heading">' +
            '<svg class="icon-modal-heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="m8 6 2-2"/><path d="m18 16 2-2"/><path d="m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>' +
            '<span id="iconModalTitle" class="icon-modal-heading-text"></span>' +
            '</div>' +
            '<button class="icon-modal-close" type="button" aria-label="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
            '</button>' +
            '</div>' +
            '<div class="icon-modal-icon" data-preview-theme="light">' +
            '<div class="icon-modal-meta">' +
            '<button class="icon-modal-category" type="button"><strong class="icon-modal-cat"></strong></button>' +
            '<span class="icon-modal-format"></span>' +
            '</div>' +
            '<a class="icon-modal-open-external" target="_blank" rel="noopener noreferrer" aria-label="在新窗口打开图标" title="在新窗口打开图标">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3h6v6"/><path d="m19 3-7 7"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>' +
            '</a>' +
            '<button class="icon-modal-preview-toggle" type="button" aria-label="切换为深色预览背景" title="切换预览背景">' +
            '<svg class="preview-toggle-icon preview-toggle-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>' +
            '<svg class="preview-toggle-icon preview-toggle-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>' +
            '</button>' +
            '<button class="icon-modal-nav icon-modal-nav-previous" type="button" aria-label="上一个图标" title="上一个图标">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
            '</button>' +
            '<button class="icon-modal-nav icon-modal-nav-next" type="button" aria-label="下一个图标" title="下一个图标">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>' +
            '</button>' +
            '<img alt="" fetchpriority="high" draggable="false" />' +
            '</div>' +
            '<div class="icon-modal-actions">' +
            '<a class="icon-modal-btn icon-modal-download" download>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' +
            '<span>下载图标</span></a>' +
            '</div>';

        overlayEl.appendChild(modalEl);
        document.body.appendChild(overlayEl);
        appWindow = document.querySelector('.app-window');

        previewEl = modalEl.querySelector('.icon-modal-icon');
        previewToggle = modalEl.querySelector('.icon-modal-preview-toggle');
        openInNewWindowLink = modalEl.querySelector('.icon-modal-open-external');
        previousButton = modalEl.querySelector('.icon-modal-nav-previous');
        nextButton = modalEl.querySelector('.icon-modal-nav-next');
        imgEl = modalEl.querySelector('.icon-modal-icon img');
        nameEl = modalEl.querySelector('.icon-modal-heading-text');
        formatEl = modalEl.querySelector('.icon-modal-format');
        catEl = modalEl.querySelector('.icon-modal-cat');
        categoryBtn = modalEl.querySelector('.icon-modal-category');
        downloadLink = modalEl.querySelector('.icon-modal-download');

        modalEl.querySelector('.icon-modal-close').addEventListener('click', close);
        overlayEl.addEventListener('click', function (event) {
            if (event.target === overlayEl) close();
        });
        document.addEventListener('keydown', onKeydown);
        previewToggle.addEventListener('click', togglePreviewTheme);
        categoryBtn.addEventListener('click', openCategory);
        previousButton.addEventListener('click', () => navigate(-1));
        nextButton.addEventListener('click', () => navigate(1));
        previewEl.addEventListener('pointerdown', onPreviewPointerDown);
        previewEl.addEventListener('pointerup', onPreviewPointerUp);
        previewEl.addEventListener('pointercancel', clearPreviewSwipe);
        imgEl.addEventListener('animationend', () => {
            imgEl.classList.remove('icon-preview-enter-from-left', 'icon-preview-enter-from-right');
        });

        imgEl.addEventListener('error', function () {
            imgEl.src = '/static/favicon.ico';
            imgEl.style.opacity = 0.5;
        });

        setPreviewTheme(previewTheme);
    }

    function onKeydown(event) {
        if (!overlayEl || !overlayEl.classList.contains('open')) return;

        if (event.key === 'Escape') {
            close();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            navigate(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            navigate(1);
        }
    }

    function setPreviewTheme(theme) {
        previewTheme = theme;
        previewEl.dataset.previewTheme = theme;
        const isDark = theme === 'dark';
        previewToggle.setAttribute('aria-pressed', String(isDark));
        previewToggle.setAttribute('aria-label', isDark ? '切换为浅色预览背景' : '切换为深色预览背景');
        previewToggle.setAttribute('title', isDark ? '切换为浅色预览背景' : '切换为深色预览背景');
    }

    function togglePreviewTheme() {
        setPreviewTheme(previewTheme === 'light' ? 'dark' : 'light');
    }

    function onPreviewPointerDown(event) {
        if (event.target.closest('button, a')) return;
        swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
        previewEl.classList.add('is-dragging');
        previewEl.setPointerCapture(event.pointerId);
    }

    function onPreviewPointerUp(event) {
        if (!swipeStart || swipeStart.id !== event.pointerId) return;

        const deltaX = event.clientX - swipeStart.x;
        const deltaY = event.clientY - swipeStart.y;
        previewEl.releasePointerCapture(event.pointerId);
        clearPreviewSwipe();

        if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        navigate(deltaX < 0 ? 1 : -1);
    }

    function clearPreviewSwipe() {
        swipeStart = null;
        if (previewEl) previewEl.classList.remove('is-dragging');
    }

    function openCategory() {
        const category = categoryBtn.dataset.category || '';
        const filename = categoryBtn.dataset.filename || '';
        if (category && window.__xgSelectCategory) {
            close(document.getElementById('currentViewTitle'));
            window.__xgSelectCategory(category, filename);
        }
    }

    function toast(message, type) {
        if (window.__xgToast) window.__xgToast(message, type);
    }

    function updateNavigationControls() {
        previousButton.setAttribute('aria-disabled', String(currentIndex <= 0));
        nextButton.setAttribute('aria-disabled', String(currentIndex < 0 || currentIndex >= currentIcons.length - 1));
    }

    function updateIcon(item, direction) {
        const { url, displayName, category, filename } = item;
        imgEl.classList.remove('icon-preview-enter-from-left', 'icon-preview-enter-from-right');
        if (direction) void imgEl.offsetWidth;

        imgEl.src = url;
        imgEl.alt = displayName;
        imgEl.style.opacity = '';
        nameEl.textContent = displayName;
        const formatMatch = (filename || '').match(/\.([^./]+)$/);
        const format = formatMatch ? formatMatch[1].toUpperCase() : '';
        formatEl.textContent = format;
        formatEl.dataset.format = format.toLowerCase();
        formatEl.classList.toggle('hidden', !format);
        catEl.textContent = '# ' + category;
        categoryBtn.dataset.category = category;
        categoryBtn.dataset.filename = filename || '';
        categoryBtn.setAttribute('aria-label', `跳转到 ${category} 分类`);
        downloadLink.href = url;
        downloadLink.setAttribute('download', filename || displayName);
        openInNewWindowLink.href = url;
        openInNewWindowLink.setAttribute('aria-label', `在新窗口打开 ${displayName}`);
        openInNewWindowLink.setAttribute('title', `在新窗口打开 ${displayName}`);
        updateNavigationControls();

        if (direction) {
            imgEl.classList.add(direction > 0 ? 'icon-preview-enter-from-right' : 'icon-preview-enter-from-left');
        }
    }

    function navigate(direction) {
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0) {
            toast('前面没有图标了！', 'warning');
            return;
        }
        if (nextIndex >= currentIcons.length) {
            toast('后面没有图标了！', 'warning');
            return;
        }

        currentIndex = nextIndex;
        updateIcon(currentIcons[currentIndex], direction);
    }

    function open(item, icons, index) {
        if (!overlayEl) build();

        currentIcons = Array.isArray(icons) && icons.length ? icons : [item];
        currentIndex = Number.isInteger(index) && currentIcons[index] === item ? index : currentIcons.indexOf(item);
        if (currentIndex < 0) {
            currentIcons = [item];
            currentIndex = 0;
        }

        updateIcon(currentIcons[currentIndex]);
        setPreviewTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        lastFocus = document.activeElement;
        overlayEl.inert = false;
        overlayEl.setAttribute('aria-hidden', 'false');
        if (appWindow) appWindow.inert = true;
        overlayEl.classList.add('open');
        document.body.classList.add('modal-open');
        modalEl.focus({ preventScroll: true });
    }

    function close(focusTarget) {
        if (!overlayEl || !overlayEl.classList.contains('open')) return;
        overlayEl.classList.remove('open');
        document.body.classList.remove('modal-open');
        overlayEl.setAttribute('aria-hidden', 'true');
        overlayEl.inert = true;
        if (appWindow) appWindow.inert = false;

        const target = focusTarget || (lastFocus && lastFocus.isConnected ? lastFocus : document.getElementById('currentViewTitle'));
        if (target && target.focus) target.focus({ preventScroll: true });
    }

    window.__xgOpenModal = open;
    window.__xgCloseModal = close;
})();
