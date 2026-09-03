window.LocaleManager = (function () {
    const SUPPORTED_LOCALES = ['ru', 'en', 'de', 'fr', 'es', 'pl', 'uk', 'tr', 'zh'];
    const DEFAULT_LOCALE = 'ru';
    const FALLBACK_TRANSLATIONS = {
        ru: {
            title: 'Миномётный калькулятор',
            posA: 'Огневая позиция (A)',
            posB: 'Цель (B)',
            dist: 'Дистанция',
            az: 'Азимут',
            el: 'Угол возвышения',
            time: 'Время подлёта',
            controlsTitle: 'Настройки',
            weaponType: 'Тип орудия',
            mapLabel: 'Карта',
            weaponMortar: 'Миномёт (684 м)',
            weaponArtillery: 'Артиллерия (2679 м)',
            hint: 'ПКМ по карте — поставить или удалить точку.<br>ЛКМ — двигать карту.<br>Колесо мыши — масштаб.',
            hintTouch: 'Долгое нажатие — поставить или удалить точку.<br>Один палец — двигать карту.<br>Два пальца — масштаб.',
            reset: 'Сбросить вид',
            menuA: 'Позиция миномёта (A)',
            menuB: 'Цель (B)',
            menuDel: 'Удалить точку',
            drawTools: 'Рисование',
            clearDrawings: 'Очистить рисунки',
            markerPrompt: 'Название метки:',
            lineWidth: 'Толщина линии',
            toolPen: 'Карандаш',
            toolLine: 'Линейка',
            toolMarker: 'Метка',
            toolEraser: 'Ластик',
            toolPan: 'Перемещение',
            langLabel: 'Язык интерфейса',
            contactLabel: 'Связь',
            oor: 'вне досягаемости',
            tooClose: 'слишком близко',
            zero: 'точки совпадают',
            u_m: 'м',
            u_km: 'км',
            u_s: 'с',
            u_mil: 'mil',
            extra: 'Дополнительно',
            towers: 'Иконки вышек',
            discordTitle: 'Wardogs СНГ / CIS',
            discord: 'Wardogs СНГ / CIS',
            discordBtn: 'Перейти в Discord',
            tower1: 'Башня 1',
            tower2: 'Башня 2',
            tower3: 'Башня 3',
            tower4: 'Башня 4',
            tower5: 'Башня 5',
            helpTitle: 'Как пользоваться калькулятором',
            helpP1: '<b>Установка точек.</b> Укажите свою позицию (точка A) и цель (точка B).',
            helpP2: '<b>Работа с картой.</b> Правый клик — меню. Левая кнопка — перемещение. Колесо — масштаб.',
            helpP3: '<b>Координаты.</b> Y и X в игровых координатах (0–160.00). Шаг — 0.01.',
            helpP4: '<b>Результаты.</b> Дистанция, азимут, угол в mils, время подлёта.',
            helpP5: '<b>Сохранение.</b> Данные сохраняются автоматически.',
            helpP6: '<b>О калькуляторе.</b> Фан-инструмент для WARDOGS.',
            share: 'Поделиться',
            shareCopied: 'Ссылка скопирована!',
            shareApplied: 'Координаты применены из ссылки',
            weaponNames: { mortar: 'Миномёт', artillery: 'Артиллерия' },
            cancel: 'Отмена',
            markerDefault: 'Метка',
            faqTitle: 'Часто задаваемые вопросы о WARDOGS',
            faq1q: 'Как рассчитать миномёт в WARDOGS?',
            faq1a: 'Откройте <strong>калькулятор WARDOGS</strong>, введите координаты огневой позиции (точка A) и цели (точка B) на интерактивной карте или через поля ввода. Калькулятор автоматически рассчитает <strong>дистанцию</strong>, <strong>азимут</strong> и <strong>угол возвышения в mils</strong>.',
            faq2q: 'Какой максимальный радиус миномёта в WARDOGS?',
            faq2a: 'Максимальная дальность <strong>миномёта в WARDOGS</strong> составляет <strong>684 метра</strong>. Для целей дальше 684 м используйте <strong>артиллерию</strong>, которая стреляет на расстояние <strong>до 2679 м</strong>.',
            faq3q: 'Какие карты поддерживаются в калькуляторе?',
            faq3a: 'Калькулятор поддерживает две карты: <strong>Bakurani</strong> и <strong>Ozeti</strong>. Обе карты размером <strong>16×16 км</strong> с интерактивным тайловым зумом и панорамированием.',
            faq4q: 'Как рассчитать азимут и угол возвышения миномёта?',
            faq4a: '<strong>Азимут</strong> — это направление от огневой позиции до цели. <strong>Угол возвышения (mils)</strong> — угол наклона ствола миномёта для попадания в цель.',
            faq5q: 'Сколько mils в градусе в WARDOGS?',
            faq5a: 'В системе измерения, используемой в WARDOGS, один полный круг равен <strong>6400 mils</strong>. 1 градус ≈ 17.78 mils.',
            faq6q: 'Миномётный калькулятор WARDOGS — как пользоваться онлайн?',
            faq6a: '<strong>Калькулятор WARDOGS</strong> полностью бесплатный и работает онлайн в браузере. Установите точку A (позиция миномёта) и точку B (цель) на интерактивной карте правым кликом.',
            faq7q: 'Можно ли сохранить координаты и поделиться с друзьями?',
            faq7a: 'Да! Калькулятор автоматически сохраняет все точки и настройки в <strong>localStorage</strong> браузера. Можно нажать кнопку «Поделиться» для получения <strong>ссылки с координатами</strong>.',
            seoAboutTitle: 'О калькуляторе WARDOGS',
            seoAboutP1: '<strong>WARDOGS Mortar Calculator</strong> — неофициальный бесплатный онлайн-инструмент для расчёта миномётного и артиллерийского огня в тактическом шутере WARDOGS.',
            seoAboutP2: 'Калькулятор работает на интерактивной карте размером 16×16 км с поддержкой двух карт: <strong>Bakurani</strong> и <strong>Ozeti</strong>.',
            seoAboutP3: 'Интерфейс доступен на <strong>9 языках</strong>. Калькулятор адаптирован для мобильных устройств и работает в любом современном браузере без установки.'
        }
    };

    function safeHTML(str) {
        return str.replace(/<(?!\/?(b|strong|em|br|code)\b)[^>]*>/gi, '');
    }

    let currentLocale = DEFAULT_LOCALE;
    try {
        currentLocale = localStorage.getItem('wardogs_lang') || DEFAULT_LOCALE;
    } catch (e) {
        currentLocale = DEFAULT_LOCALE;
    }

    let translations = {};
    let loaded = false;
    let onLocaleChange = null;
    async function loadLocale(locale) {
        if (!SUPPORTED_LOCALES.includes(locale)) {
            locale = DEFAULT_LOCALE;
        }
        const inlined = window.__INLINED_LOCALES__;
        if (inlined && inlined[locale]) {
            translations = inlined[locale];
            currentLocale = locale;
            document.documentElement.lang = currentLocale;
            loaded = true;
            try { localStorage.setItem('wardogs_lang', locale); } catch (e) { }
            return translations;
        }
        try {
            const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
            const response = await fetch(`${base}locales/${locale}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            translations = await response.json();
            currentLocale = locale;
            document.documentElement.lang = currentLocale;
            loaded = true;
            try { localStorage.setItem('wardogs_lang', locale); } catch (e) { }
            return translations;
        } catch (error) {
            console.warn(`Failed to load locale ${locale}, using fallback:`, error.message);
            translations = FALLBACK_TRANSLATIONS[locale] || FALLBACK_TRANSLATIONS[DEFAULT_LOCALE];
            currentLocale = locale;
            document.documentElement.lang = locale;
            loaded = true;
            return translations;
        }
    }

    function t(key) {
        if (!loaded) {
            const fallback = FALLBACK_TRANSLATIONS[DEFAULT_LOCALE];
            return getNestedValue(fallback, key) || key;
        }
        const value = getNestedValue(translations, key);
        return value !== undefined ? value : key;
    }
    function getNestedValue(obj, key) {
        const keys = key.split('.');
        let value = obj;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        return value;
    }

    function applyTranslations() {
        if (!loaded) return;
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const translation = t(el.dataset.i18n);
            if (typeof translation === 'string' && translation.includes('<')) {
                el.innerHTML = safeHTML(translation);
            } else {
                el.textContent = translation;
            }
        });
    }

    async function init() {
        const urlParams = new URLSearchParams(location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && SUPPORTED_LOCALES.includes(urlLang) && urlLang !== currentLocale) {
            currentLocale = urlLang;
            try { localStorage.setItem('wardogs_lang', urlLang); } catch (e) { }
        }
        await loadLocale(currentLocale);
        applyTranslations();
        if (onLocaleChange) onLocaleChange();
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = currentLocale;
            langSelect.addEventListener('change', async (e) => {
                const newLocale = e.target.value;
                await loadLocale(newLocale);
                applyTranslations();
                if (onLocaleChange) onLocaleChange();
                const params = new URLSearchParams(location.search);
                params.set('lang', newLocale);
                history.replaceState({}, '', location.pathname + '?' + params.toString());
            });
        }
    }
    
    function setOnLocaleChange(fn) { onLocaleChange = fn; }
    return {
        init,
        loadLocale,
        t,
        applyTranslations,
        setOnLocaleChange
    };
})();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.LocaleManager.init();
    });
} else {
    window.LocaleManager.init();
}