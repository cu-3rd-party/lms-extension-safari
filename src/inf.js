// Функция для замены текста
function replaceBadgeValue() {
    const badge = document.querySelector('span.badge__days');
    if (badge && badge.textContent !== '∞') {
        badge.textContent = '∞';
        console.log('Значение изменено на ∞');
    }
}

// Запускаем сразу
replaceBadgeValue();

// Если элемент может появляться позже, используем MutationObserver
const obs = new MutationObserver(() => {
    const badge = document.querySelector('span.badge__days');
    if (badge && badge.textContent !== '∞') {
        badge.textContent = '∞';
        console.log('Значение изменено на ∞ (через observer)');
        obs.disconnect(); // Отключаем observer после успешной замены
    }
});

obs.observe(document.body, { childList: true, subtree: true });
