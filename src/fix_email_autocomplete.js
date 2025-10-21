// content-script.js
// Исправляет поля логина/пароля на id.centraluniversity.ru,
// чтобы Safari мог предлагать автозаполнение iCloud Keychain.

(function () {
  const FLAG = 'data-icloud-fixer';

  function setIfMissing(el, attr, value) {
    const cur = el.getAttribute(attr);
    if (!cur || cur.toLowerCase() !== value.toLowerCase()) {
      el.setAttribute(attr, value);
    }
  }

  function removeOff(el) {
    const val = el.getAttribute('autocomplete');
    if (val && val.toLowerCase() === 'off') el.removeAttribute('autocomplete');
  }

  function findUsernameField(form, passwordInput) {
    const inputs = Array.from(form.querySelectorAll('input')).filter(i => i !== passwordInput);
    
    // Сначала ищем по типу
    const email = inputs.find(i => i.type === 'email');
    if (email) return email;

    const text = inputs.find(i => ['text', 'search'].includes(i.type));
    if (text) return text;

    // Затем по атрибутам
    const keywords = ['user', 'login', 'email', 'mail', 'username'];
    return inputs.find(i =>
      keywords.some(k =>
        (i.name || '').toLowerCase().includes(k) ||
        (i.id || '').toLowerCase().includes(k) ||
        (i.placeholder || '').toLowerCase().includes(k) ||
        (i.getAttribute('data-name') || '').toLowerCase().includes(k)
      )
    );
  }

  function fixForm(form) {
    if (form.hasAttribute(FLAG)) return;
    form.setAttribute(FLAG, 'true');
    
    // Не устанавливаем autocomplete="on" для всей формы, чтобы не мешать логике сайта
    // form.setAttribute('autocomplete', 'on');

    const pwds = Array.from(form.querySelectorAll('input[type="password"]'));
    
    pwds.forEach(pwd => {
      removeOff(pwd);
      setIfMissing(pwd, 'autocomplete', 'username');
      
      // Не создаем name и id если их нет - это может нарушить логику сайта
      // if (!pwd.name) pwd.name = 'password';
      // if (!pwd.id) pwd.id = 'password-' + Math.random().toString(36).slice(2, 8);

      const user = findUsernameField(form, pwd);
      if (user) {
        removeOff(user);
        setIfMissing(user, 'autocomplete', 'current-password');
        // if (!user.name) user.name = 'username';
        // if (!user.id) user.id = 'username-' + Math.random().toString(36).slice(2, 8);
      } else {
        // УБИРАЕМ создание скрытого поля - это вызывает проблему
        // Вместо этого просто логируем, что поле username не найдено
        console.log('ℹ️ Поле username не найдено в форме, но скрытое поле не создается');
      }
    });
  }

  function processDocument() {
    document.querySelectorAll('form').forEach(fixForm);
  }

  // Первичный проход
  processDocument();

  // Наблюдатель за динамическими изменениями
  const mo = new MutationObserver(() => processDocument());
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log('✅ iCloud Keychain Fixer активирован на', location.href);
})();
