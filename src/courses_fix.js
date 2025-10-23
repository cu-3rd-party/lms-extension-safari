// courses_fix.js (версия с корректным обновлением цвета archiveButton при смене темы)

if (typeof window.culmsCourseFixInitialized === 'undefined') {
    window.culmsCourseFixInitialized = true;

    'use strict';
    let currentUrl = location.href;

    (async function() {
        const designData = await browser.storage.sync.get('oldCoursesDesignToggle');
        const useOldDesign = !!designData.oldCoursesDesignToggle;

        if (useOldDesign) {
            const style = document.createElement('style');
            style.id = 'course-archiver-preload-style';
            style.textContent = `
              ul.course-list {
                  opacity: 0 !important;
                  visibility: hidden !important;
              }
              ul.course-list.course-archiver-ready {
                  opacity: 1 !important;
                  visibility: visible !important
              }
          `;
            document.head.appendChild(style);
        }
    })();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

    function main() {
        browser.storage.onChanged.addListener((changes) => {
            if (changes.oldCoursesDesignToggle) {
                window.location.reload();
                return;
            }

            if (changes.futureExamsViewToggle) {
                window.location.reload();
                return;
            }

            // 🔧 Разделено, чтобы корректно отслеживать themeEnabled
            if (changes.archivedCourseIds) {
                window.cuLmsLog('Course Archiver: archivedCourseIds changed, re-rendering.');
                const currentPath = window.location.pathname;
                const isOnArchivedPage = currentPath.includes('/courses/view/archived');
                browser.storage.sync.get('oldCoursesDesignToggle').then((designData) => {
                    const useOldDesign = !!designData.oldCoursesDesignToggle;
                    if (!isOnArchivedPage || !useOldDesign) {
                        processCourses();
                    }
                });
            }

            if (changes.themeEnabled) {
                const isDark = changes.themeEnabled.newValue;
                window.cuLmsLog('Course Archiver: theme changed -> updating icon colors');
                updateArchiveButtonColors(isDark);
            }
        });

        const observer = new MutationObserver(() => {
            if (location.href !== currentUrl) {
                currentUrl = location.href;
                console.log('Course Archiver: URL changed, re-running logic.');
                processCourses();

                const currentPath = window.location.pathname;
                const isOnIndividualCoursePage = /\/view\/actual\/\d+/.test(currentPath);
                if (isOnIndividualCoursePage) {
                    processFutureExams();
                }
            }
        });

        observer.observe(document.body, { subtree: true, childList: true });

        processCourses();

        const currentPath = window.location.pathname;
        const isOnIndividualCoursePage = /\/view\/actual\/\d+/.test(currentPath);
        if (isOnIndividualCoursePage) {
            processFutureExams();
        }
    }

    // 🔧 Обновление цвета иконок архивирования при смене темы
    function updateArchiveButtonColors(isDark) {
        document.querySelectorAll('.archive-button-container span').forEach(span => {
            span.style.setProperty('background-color', isDark ? '#FFFFFF' : '#181a1c', 'important');
        });
    }

    const archiveButtonsObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;

                if (node.matches && node.matches('.archive-button-container')) {
                    browser.storage.sync.get('themeEnabled').then(data => {
                        const isDark = !!data.themeEnabled;
                        node.querySelectorAll('span').forEach(span => {
                            span.style.setProperty('background-color', isDark ? '#FFFFFF' : '#181a1c', 'important');
                        });
                    });
                } else {
                    const found = node.querySelector && node.querySelectorAll && node.querySelectorAll('.archive-button-container span');
                    if (found && found.length) {
                        browser.storage.sync.get('themeEnabled').then(data => {
                            const isDark = !!data.themeEnabled;
                            node.querySelectorAll('.archive-button-container span').forEach(span => {
                                span.style.setProperty('background-color', isDark ? '#FFFFFF' : '#181a1c', 'important');
                            });
                        });
                    }
                }
            });
        });
    });

    archiveButtonsObserver.observe(document.body, { childList: true, subtree: true });

    async function processCourses() {
        try {
            const courseList = await waitForElement('ul.course-list', 15000);
            const currentPath = window.location.pathname;
            const isOnArchivedPage = currentPath.includes('/courses/view/archived');

            if (isOnArchivedPage) {
                await renderArchivedPageFromScratch();
            } else {
                await updateExistingActiveCourses();
            }

            restoreSkillLevelIconColors();
            const designData = await browser.storage.sync.get('oldCoursesDesignToggle');
            const useOldDesign = !!designData.oldCoursesDesignToggle;

            if (useOldDesign && typeof simplifyAllCourseCards === 'function') {
                simplifyAllCourseCards();
                observeCourseListChanges();
                courseList.classList.add('course-archiver-ready');
            }

        } catch (e) {
            window.cuLmsLog("Course Archiver: Not a course page, or content failed to load in time.", e);
        }
    }

    function restoreSkillLevelIconColors() {
        const icons = document.querySelectorAll('.course-card .skill-level tui-icon');
        icons.forEach(icon => {
            const originalColor = icon.style.color;
            if (originalColor) {
                icon.style.setProperty('color', originalColor, 'important');
            }
        });
    }

    async function processFutureExams() {
        try {
            const futureExamsData = await browser.storage.sync.get('futureExamsViewToggle');
            const useFutureExams = !!futureExamsData.futureExamsViewToggle;
            if (useFutureExams && typeof viewFutureExams === 'function') {
                viewFutureExams();
            }
        } catch (e) {
            console.log("Something went wrong with future exams", e);
        }
    }

    async function updateExistingActiveCourses() {
        const allApiCourses = await fetchAllCoursesData();
        const storedArchivedCourseIds = await getArchivedCoursesFromStorage();
        const themeData = await browser.storage.sync.get('themeEnabled');
        const isDarkTheme = !!themeData.themeEnabled;

        const courseNameMap = new Map();
        allApiCourses.forEach(course => courseNameMap.set(course.name.trim(), course));

        function normalizeEmoji(str) {
            return str.replace(/💙/g, '🔵').replace(/❤️/g, '🔴').replace(/🖤/g, '⚫️');
        }

        const courseCards = document.querySelectorAll('ul.course-list > li.course-card');
        courseCards.forEach(card => {
            const nameElement = card.querySelector('.course-name');
            if (!nameElement) return;

            const courseName = normalizeEmoji(nameElement.textContent.trim());
            const courseData = courseNameMap.get(courseName);
            if (!courseData) return;

            const courseId = courseData.id;
            const isLocallyArchived = storedArchivedCourseIds.has(courseId);

            if (isLocallyArchived) {
                card.style.display = 'none';
            } else {
                card.style.display = '';
                addOrUpdateButton(card, courseId, isLocallyArchived, isDarkTheme);
            }
        });
    }

    async function renderArchivedPageFromScratch() {
        const courseListContainer = document.querySelector('ul.course-list');
        if (!courseListContainer) return;

        const storedArchivedCourseIds = await getArchivedCoursesFromStorage();
        const allApiCourses = await fetchAllCoursesData();
        const themeData = await browser.storage.sync.get('themeEnabled');
        const isDarkTheme = !!themeData.themeEnabled;

        const templateLi = document.querySelector('li.course-card');
        if (!templateLi) return;

        const coursesToDisplay = allApiCourses.filter(course => {
            const isLocallyArchived = storedArchivedCourseIds.has(course.id);
            const isApiArchived = course.isArchived;
            return isApiArchived || isLocallyArchived;
        });

        courseListContainer.innerHTML = '';

        coursesToDisplay.forEach(courseData => {
            const newLi = createCourseCardElement(courseData, templateLi);
            if (newLi) {
                courseListContainer.appendChild(newLi);
                addOrUpdateButton(newLi, courseData.id, storedArchivedCourseIds.has(courseData.id), isDarkTheme);
            }
        });
    }

    async function fetchAllCoursesData() {
        try {
            const API_BASE_URL = 'https://my.centraluniversity.ru/api/micro-lms';
            const activeResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=published`);
            const archivedResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=archived`);
            if (!activeResponse.ok || !archivedResponse.ok) throw new Error('HTTP error!');
            const activeCourses = (await activeResponse.json()).items;
            const archivedCourses = (await archivedResponse.json()).items;
            const allCoursesMap = new Map();
            activeCourses.forEach(course => allCoursesMap.set(course.id, course));
            archivedCourses.forEach(course => allCoursesMap.set(course.id, course));
            return Array.from(allCoursesMap.values());
        } catch (error) {
            window.cuLmsLog(`Course Archiver: Failed to fetch all courses:`, error);
            return [];
        }
    }

    async function getArchivedCoursesFromStorage() {
        try {
            const data = await browser.storage.local.get('archivedCourseIds');
            return new Set(data.archivedCourseIds || []);
        } catch (e) {
            return new Set();
        }
    }

    async function setArchivedCoursesInStorage(archivedCourseIds) {
        try {
            await browser.storage.local.set({ archivedCourseIds: Array.from(archivedCourseIds) });
        } catch (e) {
            console.error("Course Archiver: Error saving data to storage", e);
        }
    }

    function createCourseCardElement(courseData, templateLi) {
        const newLi = templateLi.cloneNode(true);
        newLi.style.display = '';
        newLi.setAttribute('data-course-id', courseData.id);
        const title = newLi.querySelector('.course-name');
        if (title) title.textContent = escapeHtml(courseData.name);
        const linkComponent = newLi.querySelector('cu-course-card');
        if (linkComponent) {
            const originalLink = linkComponent.querySelector('a');
            if (originalLink) originalLink.remove();
            linkComponent.onclick = () => {
                window.location.href = `/learn/courses/view/actual/${courseData.id}`;
            };
            linkComponent.style.cursor = 'pointer';
        }
        return newLi;
    }

    function addOrUpdateButton(li, courseId, isLocallyArchived, isDarkTheme) {
        const imageAreaContainer = li.querySelector('div.course-card');
        if (!imageAreaContainer) return;
        imageAreaContainer.style.position = 'relative';
        let buttonContainer = li.querySelector('.archive-button-container');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'archive-button-container';
            imageAreaContainer.appendChild(buttonContainer);
        }
        buttonContainer.style.cssText = `position: absolute; right: 8px; bottom: 4px; z-index: 10;`;
        buttonContainer.innerHTML = '';
        const archiveButton = document.createElement('button');
        archiveButton.style.cssText = `background: none; border: none; padding: 0; cursor: pointer; line-height: 0;`;
        const iconSpan = document.createElement('span');
        const iconUrl = isLocallyArchived
            ? browser.runtime.getURL('icons/unarchive.svg')
            : browser.runtime.getURL('icons/archive.svg');
        const iconColor = isDarkTheme ? '#FFFFFF' : '#181a1c';
        iconSpan.style.cssText = `
            display: inline-block;
            width: 24px;
            height: 24px;
            mask-image: url(${iconUrl});
            -webkit-mask-image: url(${iconUrl});
            mask-size: contain;
            -webkit-mask-size: contain;
            mask-repeat: no-repeat;
            background-color: ${iconColor} !important;
        `;
        archiveButton.appendChild(iconSpan);
        buttonContainer.appendChild(archiveButton);

        archiveButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentArchivedCourseIds = await getArchivedCoursesFromStorage();
            if (currentArchivedCourseIds.has(courseId)) {
                currentArchivedCourseIds.delete(courseId);
            } else {
                currentArchivedCourseIds.add(courseId);
            }
            await setArchivedCoursesInStorage(currentArchivedCourseIds);

            const designData = await browser.storage.sync.get('oldCoursesDesignToggle');
            const useOldDesign = !!designData.oldCoursesDesignToggle;

            if (useOldDesign) {
                const isNowArchived = currentArchivedCourseIds.has(courseId);
                const currentPath = window.location.pathname;
                const isOnArchivedPage = currentPath.includes('/courses/view/archived');
                const cardLi = li.closest('li.course-card');
                if (!isOnArchivedPage && isNowArchived) {
                    if (cardLi) cardLi.style.display = 'none';
                } else if (isOnArchivedPage && !isNowArchived) {
                    if (cardLi) cardLi.style.display = 'none';
                }
            }
        });
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            const observer = new MutationObserver(() => {
                const foundElement = document.querySelector(selector);
                if (foundElement) {
                    observer.disconnect();
                    resolve(foundElement);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
}
