// Полифил для совместимости Chrome (chrome.*) и Firefox (browser.*)
const browser = self.browser || self.chrome;

console.log("[VersionCheck] Скрипт расширения успешно загружен.");

(function() {
    // --- НАСТРОЙКА ---
    const CURRENT_PLUGIN_VERSION = browser.runtime.getManifest().version; // Версия плагина из manifest.json
    const GIST_URL = 'https://api.github.com/gists/f108f457039a5b11154dcb8e79f1b0da';
    const RELEASES_PAGE_URL = 'https://github.com/cu-3rd-party/lms-extension/releases/';
    const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 минут

    // --- ЛОГИКА ---

    /**
     * Сравнивает две семантические версии (например, "1.10.0" и "1.2.0").
     * @param {string} v1 Первая версия
     * @param {string} v2 Вторая версия
     * @returns {number} 1 если v1 > v2, -1 если v1 < v2, 0 если равны
     */
    function compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < len; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    /**
     * Получает последнюю версию из GitHub Gist.
     * @returns {Promise<string|null>}
     */
    async function getLatestVersionFromGist() {
        try {
            const response = await fetch(GIST_URL, { cache: 'no-store' }); // Добавлен no-store для обхода кэша
            if (!response.ok) {
                console.error("[VersionCheck] Не удалось получить данные с GitHub. Статус:", response.status);
                return null;
            }
            const data = await response.json();
            if (data.files && data.files['version.json']) {
                const content = JSON.parse(data.files['version.json'].content);
                console.log("[VersionCheck] С GitHub получена версия:", content.version);
                return content.version;
            } else {
                 console.error("[VersionCheck] Файл version.json не найден в Gist.");
                 return null;
            }
        } catch (error) {
            console.error("[VersionCheck] Ошибка при запросе к Gist:", error);
            return null;
        }
    }

    /**
     * Создает базовый элемент для уведомления, клонируя существующий.
     * @returns {{container: HTMLElement, element: HTMLElement}|null}
     */
    function createNotificationElement() {
        const headerActionsList = document.querySelector('ul.header__actions-list');
        if (!headerActionsList) {
            console.error("[VersionCheck] Не найден контейнер 'ul.header__actions-list' для вставки уведомления.");
            return null;
        }

        const originalItem = headerActionsList.querySelector('li[automation-id="header-action"]');
        if (!originalItem) {
            console.error("[VersionCheck] Не найден элемент 'li[automation-id=\"header-action\"]' для клонирования.");
            return null;
        }

        return { container: headerActionsList, element: originalItem.cloneNode(true) };
    }

    /**
     * Отображает уведомление о том, что плагин устарел.
     */
    function showUpdateNotification() {
        if (document.getElementById('plugin-version-notification')) return;
        const res = createNotificationElement();
        if (!res) return;

        removeNotifications(); // Убираем другие наши уведомления перед добавлением
        res.element.id = 'plugin-version-notification';
        const linkHTML = `
            <a href="${RELEASES_PAGE_URL}" target="_blank" rel="noopener noreferrer" style="color: red; font-weight: bold; text-decoration: underline;">
                Плагин устарел
            </a>
        `;
        const badgeDiv = res.element.querySelector('.badge');
        if (badgeDiv) badgeDiv.innerHTML = linkHTML;

        res.container.prepend(res.element);
        console.log("[VersionCheck] Уведомление 'Плагин устарел' показано.");
    }

    /**
     * Отображает уведомление о том, что используется pre-release версия.
     */
    function showPreReleaseNotification() {
        if (document.getElementById('plugin-prerelease-notification')) return;
        const res = createNotificationElement();
        if (!res) return;

        removeNotifications(); // Убираем другие наши уведомления перед добавлением
        res.element.id = 'plugin-prerelease-notification';
        const messageHTML = `
            <span style="color: #8A2BE2; font-weight: bold;">
                Pre-release версия
            </span>
        `;
        const badgeDiv = res.element.querySelector('.badge');
        if (badgeDiv) badgeDiv.innerHTML = messageHTML;

        res.container.prepend(res.element);
        console.log("[VersionCheck] Уведомление 'Pre-release версия' показано.");
    }

    /**
     * Удаляет все уведомления, созданные этим скриптом.
     */
    function removeNotifications() {
        const updateNotification = document.getElementById('plugin-version-notification');
        if (updateNotification) updateNotification.remove();

        const preReleaseNotification = document.getElementById('plugin-prerelease-notification');
        if (preReleaseNotification) preReleaseNotification.remove();
    }

    /**
     * Сравнивает текущую и последнюю версии и решает, какое уведомление показать/скрыть.
     * @param {string} latestVersion - Последняя версия с сервера.
     */
    function handleVersionComparison(latestVersion) {
        if (!latestVersion) return;

        const comparisonResult = compareVersions(CURRENT_PLUGIN_VERSION, latestVersion);

        if (comparisonResult === -1) {
            // Текущая версия < последней -> Плагин устарел
            console.log(`[VersionCheck] Сравнение: ${CURRENT_PLUGIN_VERSION} < ${latestVersion}. Требуется обновление.`);
            showUpdateNotification();
        } else if (comparisonResult === 1) {
            // Текущая версия > последней -> Pre-release
            console.log(`[VersionCheck] Сравнение: ${CURRENT_PLUGIN_VERSION} > ${latestVersion}. Установлена pre-release версия.`);
            showPreReleaseNotification();
        } else {
            // Версии совпадают
            console.log(`[VersionCheck] Сравнение: ${CURRENT_PLUGIN_VERSION} == ${latestVersion}. Установлена актуальная версия.`);
            removeNotifications();
        }
    }

    /**
     * Основная асинхронная функция проверки.
     */
    async function checkVersion() {
        console.log("[VersionCheck] Запуск проверки версии...");
        const storedData = await browser.storage.local.get(['lastVersionCheckTimestamp', 'cachedLatestVersion']);
        const lastCheckTime = storedData.lastVersionCheckTimestamp || 0;
        const cachedVersion = storedData.cachedLatestVersion;
        const currentTime = Date.now();

        // 1. Сначала реагируем на кэшированные данные, чтобы пользователь сразу увидел результат.
        if (cachedVersion) {
            console.log("[VersionCheck] Применяется кэшированная версия:", cachedVersion);
            handleVersionComparison(cachedVersion);
        }

        // 2. Проверяем, нужно ли делать новый запрос к серверу.
        if (currentTime - lastCheckTime < CHECK_INTERVAL_MS) {
            console.log("[VersionCheck] Новый запрос к GitHub пока не требуется (не прошел интервал).");
            return;
        }

        console.log("[VersionCheck] Интервал истек. Отправка запроса к GitHub Gist...");
        // 3. Если время пришло, делаем запрос к Gist.
        const latestVersion = await getLatestVersionFromGist();

        // 4. Обновляем локальное хранилище с новым временем и версией.
        const updateData = { lastVersionCheckTimestamp: currentTime };
        if (latestVersion) {
            updateData.cachedLatestVersion = latestVersion;
        }
        await browser.storage.local.set(updateData);
        console.log("[VersionCheck] Локальное хранилище обновлено.");

        // 5. После свежей проверки снова решаем, что показывать.
        if (latestVersion) {
            handleVersionComparison(latestVersion);
        }
    }

    // --- ТОЧКА ВХОДА ---
    // Ищем целевой элемент с помощью MutationObserver, чтобы дождаться его загрузки.

    const targetSelector = 'ul.header__actions-list';

    // Создаем наблюдателя, который будет ждать появления нужного элемента.
    const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector(targetSelector)) {
            console.log(`[VersionCheck] Целевой элемент '${targetSelector}' найден на странице.`);
            checkVersion(); // Запускаем основную логику, когда элемент точно есть.
            obs.disconnect(); // Отключаем наблюдатель, чтобы он не работал впустую.
        }
    });

    // Начинаем наблюдение за изменениями во всем документе.
    console.log(`[VersionCheck] Запуск MutationObserver для поиска элемента '${targetSelector}'.`);
    observer.observe(document.body, {
        childList: true, // Следить за добавлением/удалением дочерних элементов
        subtree: true    // Следить во всех вложенных элементах
    });

})();
