 (function() {
     'use strict';
     
     function fixPasswordFields() {
         console.log('Password Autofill Fix: searching for password fields...');
         
         // Находим все поля пароля
         const passwordFields = document.querySelectorAll('input[type="password"]');
         
         passwordFields.forEach((field, index) => {
             console.log(`Found password field ${index + 1}:`, field);
             
             // Сохраняем оригинальные значения
             const originalAutocomplete = field.getAttribute('autocomplete');
             const originalName = field.getAttribute('name');
             const originalId = field.getAttribute('id');
             
             // Устанавливаем правильные атрибуты для автозаполнения
             field.setAttribute('autocomplete', 'current-password');
             
             if (!field.getAttribute('name') || field.getAttribute('name') === '') {
                 field.setAttribute('name', 'password');
             }
             
             if (!field.getAttribute('id') || field.getAttribute('id') === '') {
                 field.setAttribute('id', 'password-' + Date.now());
             }
             
             console.log(`Fixed password field ${index + 1}:`, {
                 originalAutocomplete,
                 originalName,
                 originalId,
                 newAutocomplete: field.getAttribute('autocomplete'),
                 newName: field.getAttribute('name'),
                 newId: field.getAttribute('id')
             });
         });
         
         // Ищем поле для имени пользователя/email
         const usernameFields = document.querySelectorAll('input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][id*="user"], input[type="text"][id*="email"]');
         
         usernameFields.forEach((field, index) => {
             console.log(`Found username field ${index + 1}:`, field);
             
             field.setAttribute('autocomplete', 'username');
             
             if (!field.getAttribute('name') || !field.getAttribute('name').includes('user')) {
                 field.setAttribute('name', 'username');
             }
             
             console.log(`Fixed username field ${index + 1}`);
         });
         
         // Если не нашли поле username, создаем скрытое
         if (usernameFields.length === 0 && passwordFields.length > 0) {
             const hiddenUsername = document.createElement('input');
             hiddenUsername.type = 'hidden';
             hiddenUsername.name = 'username';
             hiddenUsername.autocomplete = 'username';
             hiddenUsername.value = '';
             
             const form = passwordFields[0].closest('form');
             if (form) {
                 form.appendChild(hiddenUsername);
                 console.log('Added hidden username field to form');
             }
         }
         
         // Триггерим события для браузера
         setTimeout(() => {
             passwordFields.forEach(field => {
                 // Создаем события для активации автозаполнения
                 const focusEvent = new Event('focus', { bubbles: true });
                 const inputEvent = new Event('input', { bubbles: true });
                 
                 field.dispatchEvent(focusEvent);
                 field.dispatchEvent(inputEvent);
                 
                 // Быстрое мигание фокуса
                 field.focus();
                 setTimeout(() => field.blur(), 50);
             });
         }, 100);
     }
     
     // Запускаем сразу после загрузки
     if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', fixPasswordFields);
     } else {
         fixPasswordFields();
     }
     
     // Запускаем также при динамических изменениях (для SPA)
     const observer = new MutationObserver((mutations) => {
         let shouldFix = false;
         
         mutations.forEach((mutation) => {
             mutation.addedNodes.forEach((node) => {
                 if (node.nodeType === 1) { // Element node
                     if (node.querySelector && node.querySelector('input[type="password"]')) {
                         shouldFix = true;
                     }
                 }
             });
         });
         
         if (shouldFix) {
             setTimeout(fixPasswordFields, 2000);
         }
     });
     
     observer.observe(document.body, {
         childList: true,
         subtree: true
     });
     
     // Дополнительный запуск через 2 секунды на случай динамической загрузки
     setTimeout(fixPasswordFields, 500);
     
     console.log('Password Autofill Fix extension loaded');
 })();
