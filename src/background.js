// background.js

if (typeof importScripts === 'function') {
    try {
        importScripts('browser-polyfill.js');
    } catch (e) {
        console.log("Running in a non-MV3 environment or Firefox.");
    }
}

function handleNavigation(tabId, url) {
    if (!url || !url.startsWith("https://my.centraluniversity.ru/")) return;

    browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ["version_check.js"]
    }).catch(err => console.error(`[BG_LOG] Error injecting version_check.js:`, err));


    // --- ЛОГИКА РАЗДЕЛЬНОГО ВНЕДРЕНИЯ ---
    if (url.includes("/learn/tasks")) {
        browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["browser-polyfill.js", "dark_theme.js", "tasks_fix.js"]
        }).catch(err => console.error(`[BG_LOG] Error injecting scripts for Tasks page:`, err));
    } else {
        browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["browser-polyfill.js", "dark_theme.js", "emoji_swap.js"]
        }).catch(err => console.error(`[BG_LOG] Error injecting default scripts:`, err));
    }

    if (url.includes("/learn/courses/view")) {
        browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["browser-polyfill.js", "course_card_simplifier.js",
                    "future_exams_view.js", "courses_fix.js", "course_overview_task_status.js"]
        }).catch(err => console.error(`[BG_LOG] Error injecting courses_fix.js:`, err));
    }
    if (url.includes("/longreads/")) {
        browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["homework_weight_fix.js", "instant_doc_view_fix.js", "task_status_adaptation.js", "rename_hw.js"]
        }).catch(err => console.error(`[BG_LOG] Error injecting Longreads scripts:`, err));
    }
    if (url.includes("/learn/reports/student-performance")) {
         browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["archive-statements.js", "metrics_statements.js"]
        }).catch(err => console.error(`[BG_LOG] Error injecting reports scripts:`, err))
    }

    browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ["plugin_page_loader.js"]
    }).catch(err => console.error(`[BG_LOG] Error injecting plugin_page_loader.js:`, err));
}

// Слушатели навигации
browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    if (details.frameId === 0) handleNavigation(details.tabId, details.url);
});
browser.webNavigation.onCompleted.addListener(details => {
    if (details.frameId === 0) handleNavigation(details.tabId, details.url);
});
