/**
 *
 * Поддерживает 9 языков: ru, en, de, fr, es, pl, uk, tr, zh.
 *
 * Работа:
 * 1. Загружает JSON-файл перевода из /locales/{lang}.json
 * 2. При ошибке загрузки — использует встроенный fallback (только ru)
 * 3. Применяет переводы к DOM через data-i18n / data-i18n-title
 * 4. Сохраняет выбор языка в localStorage
 *
 * Экспорт: window.LocaleManager
 */

window.LocaleManager = (function () {

    /** Поддерживаемые языки */
    const SUPPORTED_LOCALES = ['ru', 'en', 'de', 'fr', 'es', 'pl', 'uk', 'tr', 'zh'];

    /** Язык по умолчанию */
    const DEFAULT_LOCALE = 'ru';

    /**
     * Встроенный fallback-перевод (только русский).
     * Используется если JSON-файл не загрузился (офлайн, ошибка сервера).
     */
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
            weaponMortar: 'Миномёт (700 м)',
            weaponArtillery: 'Артиллерия (>2 км)',
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
            helpP3: '<b>Координаты.</b> X и Y в игровых координатах (0–160). Шаг — 0.01.',
            helpP4: '<b>Результаты.</b> Дистанция, азимут, угол в mils, время подлёта.',
            helpP5: '<b>Сохранение.</b> Данные сохраняются автоматически.',
            helpP6: '<b>О калькуляторе.</b> Фан-инструмент для WARDOGS.',
            share: 'Поделиться',
            shareCopied: 'Ссылка скопирована!',
            shareApplied: 'Координаты применены из ссылки',
            weaponNames: { mortar: 'Миномёт', artillery: 'Артиллерия' },
            cancel: 'Отмена',
            markerDefault: 'Метка'
        }
    };

    /** Текущий активный язык */
    let currentLocale = DEFAULT_LOCALE;

    /** Пытаемся загрузить сохранённый язык из localStorage */
    try {
        currentLocale = localStorage.getItem('wardogs_lang') || DEFAULT_LOCALE;
    } catch (e) {
        currentLocale = DEFAULT_LOCALE;
    }

    /** Загруженные переводы (объект ключ→перевод) */
    let translations = {};

    /** Флаг: были ли переводы загружены */
    let loaded = false;

    /** Колбэк при смене языка (для перерисовки canvas) */
    let onLocaleChange = null;

    /**
     * Загружает переводы для указанного языка из JSON-файла.
     * При ошибке использует fallback (встроенные русские переводы).
     *
     * @param {string} locale — код языка ('ru', 'en', ...)
     * @returns {Promise<object>} объект перевода
     */
    async function loadLocale(locale) {
        if (!SUPPORTED_LOCALES.includes(locale)) {
            locale = DEFAULT_LOCALE;
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

    /**
     * Возвращает перевод по ключу.
     * Поддерживает вложенные ключи через точку (например, "weaponNames.mortar").
     *
     * @param {string} key — ключ перевода
     * @returns {string|object} переведённый текст или сам ключ если не найден
     */
    function t(key) {
        if (!loaded) {
            const fallback = FALLBACK_TRANSLATIONS[DEFAULT_LOCALE];
            return getNestedValue(fallback, key) || key;
        }
        const value = getNestedValue(translations, key);
        return value !== undefined ? value : key;
    }

    /**
     * Извлекает вложенное значение из объекта по ключу с точками.
     * Пример: getNestedValue({a: {b: 'x'}}, 'a.b') → 'x'
     *
     * @param {object} obj — объект перевода
     * @param {string} key — ключ с точечной нотацией
     * @returns {*} значение или undefined
     */
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

    /**
     * Применяет переводы ко всем DOM-элементам с атрибутами data-i18n.
     *
     * data-i18n="key" — подставляет текст (или innerHTML если содержит <)
     * data-i18n-title="key" — подставляет атрибут title
     */
    function applyTranslations() {
        if (!loaded) return;

        /** Переводим атрибуты title */
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });

        /** Переводим текст/innerHTML */
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const translation = t(el.dataset.i18n);
            if (typeof translation === 'string' && translation.includes('<')) {
                el.innerHTML = translation; /** С HTML (например, helpP2 с <br>) */
            } else {
                el.textContent = translation;
            }
        });
    }

    /**
     * Инициализация: загружает язык и привязывает селектор языка в drawer.
     */
    async function init() {
        /** Parse ?lang= from URL (highest priority, overrides localStorage) */
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
                /** Update URL to reflect selected language */
                const params = new URLSearchParams(location.search);
                params.set('lang', newLocale);
                history.replaceState({}, '', location.pathname + '?' + params.toString());
            });
        }
    }

    /** Устанавливает колбэк при смене языка (для перерисовки canvas) */
    function setOnLocaleChange(fn) { onLocaleChange = fn; }

    return {
        init,
        loadLocale,
        t,
        applyTranslations,
        setOnLocaleChange
    };
})();

/**
 * Автоматическая инициализация при загрузке DOM.
 * Если DOM уже готов — init() сразу, иначе ждём DOMContentLoaded.
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.LocaleManager.init();
    });
} else {
    window.LocaleManager.init();
}
