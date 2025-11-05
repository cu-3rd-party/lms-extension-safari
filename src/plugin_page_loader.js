// plugin_page_loader.js
'use strict';

// --- КОНСТАНТЫ ---
const OVERLAY_ID = 'cu-plugin-overlay-container';
const CONTENT_WRAPPER_ID = 'cu-plugin-content-wrapper';
const PLUGIN_BUTTON_ID = 'cu-plugin-main-button';
const GIST_PANEL_ID = 'cu-plugin-gist-right-panel';
const GIST_STYLE_ID = 'cu-gist-dark-theme-injected-style';
let leftIframe = null;

/**
 * Скрывает оверлей.
 */
function cleanupPluginState() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// --- БЛОК ОДНОРАЗОВОЙ ИНИЦИАЛИЗАЦИИ ---
if (typeof window.isPluginPageLoaderInitialized === 'undefined') {
    window.isPluginPageLoaderInitialized = true;
    window.isGistContentLoaded = false;

    /**
     * Применяет тему (светлую/тёмную) к контейнеру плагина.
     */
    function applyContainerTheme(isEnabled) {
        const contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);
        const rightPanel = document.getElementById(GIST_PANEL_ID);
        if (!contentWrapper || !rightPanel) return;

        if (isEnabled) {
            contentWrapper.style.background = '#2c2c2e';
            rightPanel.style.color = '#e0e0e0';
        } else {
            contentWrapper.style.background = '#ffffff';
            rightPanel.style.color = '#333333';
        }
    }

    /**
     * Открывает меню плагина.
     */
    async function openPluginMenu() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;

        const themeData = await browser.storage.sync.get('themeEnabled');
        applyContainerTheme(!!themeData.themeEnabled);

        overlay.style.display = 'flex';

        if (!window.isGistContentLoaded) {
            fetchGistContent();
        }
    }

    /**
     * Закрывает меню и отправляет запрос на изменения iframe.
     */
    function closePluginMenu() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || !leftIframe) return;

        overlay.style.display = 'none';
        leftIframe.contentWindow.postMessage({ action: 'getPendingChanges' }, '*');
    }

    /**
     * Обработчик кнопки плагина.
     */
    function handlePluginToggle() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        const isVisible = overlay.style.display === 'flex';

        if (isVisible) {
            closePluginMenu();
        } else {
            openPluginMenu();
        }
    }

    /**
     * Создаёт структуру DOM плагина.
     */
    function createPluginStructure() {
        if (document.getElementById(OVERLAY_ID)) return;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: none;
            justify-content: center;
            align-items: center;
            padding: 40px;
            box-sizing: border-box;
        `;

        const contentWrapper = document.createElement('div');
        contentWrapper.id = CONTENT_WRAPPER_ID;
        contentWrapper.style.cssText = `
            display: flex; gap: 15px;
            width: 100%; max-width: 1400px; height: 100%;
            border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            overflow: hidden; transition: background-color 0.3s;
        `;

        leftIframe = document.createElement('iframe');
        leftIframe.src = chrome.runtime.getURL('popup.html');
        leftIframe.style.cssText = `flex: 0 0 380px; border: none;`;

        const rightPanel = document.createElement('div');
        rightPanel.id = GIST_PANEL_ID;
        rightPanel.style.cssText = `
            flex-grow: 1; height: 100%; overflow: auto;
            padding: 20px; box-sizing: border-box;
            transition: color 0.3s;
        `;
        rightPanel.textContent = 'Загрузка...';

        contentWrapper.appendChild(leftIframe);
        contentWrapper.appendChild(rightPanel);
        overlay.appendChild(contentWrapper);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePluginMenu();
        });
    }

    /**
     * Добавляет кнопку плагина.
     */
    function setupPersistentButtonInjector() {
        const observer = new MutationObserver(() => {
            const userActionsList = document.querySelector('ul.user-actions');
            if (userActionsList && !document.getElementById(PLUGIN_BUTTON_ID)) {
                const pluginListItem = document.createElement('li');
                pluginListItem.innerHTML = `
                    <button id="${PLUGIN_BUTTON_ID}" tuiappearance="" tuiicons="" tuibutton=""
                        type="button" size="m" class="user-actions__action-button"
                        data-appearance="tertiary" data-icon-start="svg" data-size="m"
                        style="--t-icon-start: url(${chrome.runtime.getURL('icons/plugin.svg')});">
                        <div class="user-actions__action-title">Плагин</div>
                    </button>
                `;
                pluginListItem.querySelector(`#${PLUGIN_BUTTON_ID}`).addEventListener('click', handlePluginToggle);
                userActionsList.appendChild(pluginListItem);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Включает/выключает CSS для Gist-темы.
     */
    async function applyGistTheme(isEnabled) {
        const existingStyle = document.getElementById(GIST_STYLE_ID);
        if (isEnabled && !existingStyle) {
            try {
                const response = await fetch(chrome.runtime.getURL('gist_dark.css'));
                const css = await response.text();
                const style = document.createElement('style');
                style.id = GIST_STYLE_ID;
                style.textContent = css;
                document.head.appendChild(style);
            } catch (e) {
                console.error("Не удалось загрузить gist_dark.css:", e);
            }
        } else if (!isEnabled && existingStyle) {
            existingStyle.remove();
        }
    }

    /**
     * Простой markdown → HTML рендер без внешних библиотек (улучшенный + автоформат ссылок)
     */
    function renderMarkdown(md) {
        if (!md) return '';
        md = md.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Заголовки, форматирование
        md = md
            .replace(/^### (.*)$/gim, '<h3>$1</h3>')
            .replace(/^## (.*)$/gim, '<h2>$1</h2>')
            .replace(/^# (.*)$/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*?)\*/gim, '<i>$1</i>')
            .replace(/^\s*[-*]\s+(.*)$/gim, '<ul><li>$1</li></ul>');

        // [текст](url)
        md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Сырые ссылки — github-format-aware
        md = md.replace(/(https?:\/\/[^\s<>()]+)/gim, (match) => {
            try {
                const url = new URL(match);
                // Специальное форматирование для GitHub PR/Issue
                if (url.hostname === 'github.com') {
                    const parts = url.pathname.split('/').filter(Boolean);
                    if (parts.length >= 4 && ['pull', 'issues'].includes(parts[2])) {
                        return `<a href="${match}" target="_blank" rel="noopener noreferrer">${parts[0]}/${parts[1]}#${parts[3]}</a>`;
                    }
                }
                // Иначе просто домен + последний сегмент
                const pathParts = url.pathname.split('/').filter(Boolean);
                const short = pathParts.length ? `${url.hostname}/${pathParts.slice(-1)}` : url.hostname;
                return `<a href="${match}" target="_blank" rel="noopener noreferrer">${short}</a>`;
            } catch {
                return match;
            }
        });

        return md
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    /**
     * Загружает и отображает Gist.
     */
    async function fetchGistContent() {
        const GIST_ID = '76aaac0351cfaf6f099d67eaf79b00b7';
        const FILENAME_IN_GIST = 'README.md';
        const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
        const rightPanel = document.getElementById(GIST_PANEL_ID);
        if (!rightPanel) return;

        rightPanel.textContent = 'Загрузка Gist...';
        const themeData = await browser.storage.sync.get('themeEnabled');
        applyGistTheme(!!themeData.themeEnabled);

        try {
            const response = await fetch(GIST_API_URL, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);

            const data = await response.json();
            if (!data.files || !data.files[FILENAME_IN_GIST]) {
                throw new Error(`Файл '${FILENAME_IN_GIST}' не найден в Gist'e.`);
            }

            const mdContent = data.files[FILENAME_IN_GIST].content;
            const rendered = renderMarkdown(mdContent);

            rightPanel.innerHTML = `
                <div style="font-family: system-ui, sans-serif; line-height: 0.9;">
                    ${rendered}
                </div>
            `;

            // Стилизация ссылок
            rightPanel.querySelectorAll('a').forEach(link => {
                link.style.color = '#4da3ff';
                link.style.textDecoration = 'underline';
                link.style.cursor = 'pointer';
            });

            window.isGistContentLoaded = true;
        } catch (error) {
            console.error("[Plugin Loader] Ошибка загрузки Gist через API:", error);
            window.isGistContentLoaded = false;

            rightPanel.innerHTML = `
                <div style="text-align: center; padding-top: 20px; font-family: sans-serif;">
                    <p>Ошибка загрузки: ${error.message}</p>
                    <button id="cu-plugin-retry-gist-btn"
                        style="padding: 8px 16px; border: 1px solid #ccc;
                        border-radius: 4px; cursor: pointer; font-size: 14px;
                        background-color: #f0f0f0;">
                        Попробовать снова
                    </button>
                </div>
            `;
            document.getElementById('cu-plugin-retry-gist-btn').addEventListener('click', fetchGistContent);
        }
    }

    // --- СЛУШАТЕЛИ ---
    window.addEventListener('message', async (event) => {
        if (event.source !== leftIframe.contentWindow) return;
        if (event.data && event.data.action === 'receivePendingChanges') {
            const changes = event.data.payload;
            if (Object.keys(changes).length > 0) {
                await browser.storage.sync.set(changes);
                location.reload();
            }
        }
    });

    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && 'themeEnabled' in changes) {
            applyContainerTheme(!!changes.themeEnabled.newValue);
            applyGistTheme(!!changes.themeEnabled.newValue);
        }
    });

    // --- ЗАПУСК ОДНОРАЗОВОЙ ЛОГИКИ ---
    createPluginStructure();
    setupPersistentButtonInjector();
}

// --- КОД, ВЫПОЛНЯЕМЫЙ ПРИ КАЖДОЙ НАВИГАЦИИ ---
cleanupPluginState();
