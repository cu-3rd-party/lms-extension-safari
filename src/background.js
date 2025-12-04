// background.js (адаптированная версия под Safari / кросс-браузерная)

// Попытка импортировать полифилл для совместимости с Manifest V3 (Chrome и др.)
if (typeof importScripts === 'function') {
    try {
        importScripts('browser-polyfill.js');
    } catch (e) {
        // Это нормально для сред, где browser.* уже доступен (Safari Web Extension, Firefox и т.п.)
        console.log("[BG_LOG] Polyfill not loaded, probably not needed in this environment.");
    }
}

// Нормализуем объект browser/chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    // eslint-disable-next-line no-var
    var browser = chrome;
}

/**
 * Универсальный хелпер для внедрения списка скриптов в указанную вкладку.
 * Работает как с browser.scripting (Chrome MV3), так и с tabs.executeScript (Safari/Firefox/MV2).
 *
 * @param {number} tabId - ID вкладки.
 * @param {string[]} files - Массив путей к файлам скриптов.
 * @param {string} [logPrefix] - Префикс для логов об ошибках.
 * @returns {Promise<void>}
 */
function executeScripts(tabId, files, logPrefix = "[BG_LOG]") {
    if (!files || !files.length) {
        return Promise.resolve();
    }

    // Вариант для Manifest V3 / Chrome: browser.scripting.executeScript
    if (browser.scripting && typeof browser.scripting.executeScript === "function") {
        return browser.scripting.executeScript({
            target: { tabId },
            files
        }).catch(err => console.error(`${logPrefix} Error injecting scripts via scripting.executeScript:`, err));
    }

    // Фолбэк для Safari / Firefox / MV2: tabs.executeScript по одному файлу
    if (browser.tabs && typeof browser.tabs.executeScript === "function") {
        const injections = files.map(file =>
            browser.tabs.executeScript(tabId, { file }).catch(err =>
                console.error(`${logPrefix} Error injecting script "${file}" via tabs.executeScript:`, err)
            )
        );
        return Promise.all(injections).then(() => undefined);
    }

    console.error(`${logPrefix} Neither browser.scripting nor browser.tabs.executeScript is available.`);
    return Promise.resolve();
}

/**
 * Обёртка над browser.storage.sync.get с защитой от сред без промисов.
 *
 * @param {Array|string|Object} keys
 * @returns {Promise<Object>}
 */
function storageSyncGet(keys) {
    if (!browser.storage || !browser.storage.sync || typeof browser.storage.sync.get !== "function") {
        return Promise.reject(new Error("storage.sync API is not available"));
    }

    // Если browser-polyfill уже подключен, get возвращает Promise
    try {
        const maybePromise = browser.storage.sync.get(keys);
        if (maybePromise && typeof maybePromise.then === "function") {
            return maybePromise;
        }
    } catch (e) {
        // Падать не будем, попробуем callback-стиль
    }

    // Callback-стиль (на всякий случай)
    return new Promise((resolve, reject) => {
        try {
            browser.storage.sync.get(keys, result => {
                const lastError = browser.runtime && browser.runtime.lastError;
                if (lastError) {
                    reject(lastError);
                } else {
                    resolve(result);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Центральная функция для обработки навигации и внедрения скриптов.
 * @param {number} tabId - ID вкладки, где произошло событие.
 * @param {string} url - URL страницы.
 */
function handleNavigation(tabId, url) {
    // Прекращаем выполнение, если URL не соответствует целевому сайту
    if (!url || !url.startsWith("https://my.centraluniversity.ru/")) return;

    // Внедряем скрипт проверки версии на всех страницах домена
    executeScripts(tabId, ["version_check.js"], "[BG_LOG] version_check.js");

    // --- ЛОГИКА РАЗДЕЛЬНОГО ВНЕДРЕНИЯ ---

    if (url.includes("/learn/tasks")) {
        // СТРАНИЦА ЗАДАЧ: Внедряем объединенный tasks_fix, но НЕ emoji_swap
        executeScripts(
            tabId,
            ["browser-polyfill.js", "dark_theme.js", "tasks_fix.js", "snow.js", "course_card_image_replacer.js"],
            "[BG_LOG] Tasks page"
        );
    } else {
        // ДРУГИЕ СТРАНИЦЫ: Внедряем стандартный набор, включая emoji_swap
        executeScripts(
            tabId,
            ["browser-polyfill.js", "dark_theme.js", "emoji_swap.js", "snow.js", "course_card_image_replacer.js"],
            "[BG_LOG] Default pages"
        );
    }

    // Внедрение скриптов для страницы просмотра курсов
    if (url.includes("/learn/courses/view")) {
        executeScripts(
            tabId,
            [
                "browser-polyfill.js",
                "course_card_simplifier.js",
                "future_exams_view.js",
                "courses_fix.js",
                "course_overview_task_status.js",
                "course_overview_autoscroll.js"
            ],
            "[BG_LOG] Courses view"
        );
    }

    // Внедрение скриптов для страниц с материалами (лонгридами)
    if (url.includes("/longreads/")) {
        executeScripts(
            tabId,
            ["homework_weight_fix.js", "instant_doc_view_fix.js", "task_status_adaptation.js", "rename_hw.js"],
            "[BG_LOG] Longreads"
        );
    }

    // --- ОБНОВЛЕННЫЙ БЛОК ДЛЯ СТРАНИЦЫ УСПЕВАЕМОСТИ ---
    if (url.includes("/learn/reports/student-performance")) {
        // Внедряем скрипты для общей страницы успеваемости (архив и GPA калькулятор)
        executeScripts(
            tabId,
            ["archive-statements.js", "metrics_statements.js"],
            "[BG_LOG] Reports"
        );

        // --- НОВАЯ ЛОГИКА ДЛЯ СТАНДАРТИЗИРОВАННОЙ ВЕДОМОСТИ ---
        if (url.includes("/activity")) {
            // Проверяем, включена ли опция в настройках расширения
            storageSyncGet(["advancedStatementsEnabled"])
                .then(settings => {
                    if (settings.advancedStatementsEnabled) {
                        return executeScripts(
                            tabId,
                            ["advanced_statements.js"],
                            "[BG_LOG] Advanced statements"
                        );
                    }
                    return undefined;
                })
                .catch(err => console.error("[BG_LOG] Error getting settings for advanced statements:", err));
        }
    }

    // Внедряем загрузчик страницы плагина (для настроек)
    executeScripts(tabId, ["plugin_page_loader.js"], "[BG_LOG] plugin_page_loader");
}

// --- СЛУШАТЕЛИ НАВИГАЦИИ ---
// Отслеживаем переходы внутри SPA (Single Page Application)
if (browser.webNavigation && browser.webNavigation.onHistoryStateUpdated) {
    browser.webNavigation.onHistoryStateUpdated.addListener(details => {
        // frameId === 0 означает, что событие произошло в основном окне, а не в iframe
        if (details.frameId === 0) {
            handleNavigation(details.tabId, details.url);
        }
    });
}

// Отслеживаем полную загрузку страницы (например, после F5 или прямого перехода)
if (browser.webNavigation && browser.webNavigation.onCompleted) {
    browser.webNavigation.onCompleted.addListener(details => {
        if (details.frameId === 0) {
            handleNavigation(details.tabId, details.url);
        }
    });
}


// --- ЛОГИКА ОБРАБОТКИ GIST ---
// Слушатель сообщений от других частей расширения (например, от content scripts)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchGistContent") {
        fetch(request.url)
            .then(response => response.text())
            .then(text => {
                let processedText = text.trim();

                const prefix = "document.write('";
                const suffix = "')";
                // Регулярное выражение для поиска "шва" между файлами в Gist
                const separatorRegex = /'\)\s*document\.write\('/g;

                if (processedText.startsWith(prefix) && processedText.endsWith(suffix)) {

                    // 1. Убираем внешнюю "обертку" document.write
                    processedText = processedText.substring(prefix.length, processedText.length - suffix.length);

                    // 2. Заменяем все "швы" на пустую строку, чтобы "склеить" файлы
                    let rawHtml = processedText.replace(separatorRegex, '');

                    // 3. Убираем экранирование символов, добавленное Gist'ом
                    rawHtml = rawHtml
                        .replace(/\\'/g, "'").replace(/\\"/g, '"')
                        .replace(/\\n/g, '\n').replace(/\\\//g, '/')
                        .replace(/\\\\/g, '\\');

                    // 4. Извлекаем из чистого HTML ссылку на CSS стили, если они есть
                    const cssMatch = rawHtml.match(/<link.*?href="(.*?)"/);
                    const cssUrl = cssMatch ? cssMatch[1] : null;

                    sendResponse({ success: true, html: rawHtml, cssUrl: cssUrl });

                } else {
                    sendResponse({ success: false, error: "Ответ от Gist имеет неожиданный формат." });
                }
            })
            .catch(error => sendResponse({ success: false, error: error.message }));

        // Возвращаем true, чтобы указать, что ответ будет асинхронным
        return true;
    }
});
