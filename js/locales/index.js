// js/locales/index.js — Менеджер локализации

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
            weaponMortar: 'Миномёт (700 м)',
            weaponArtillery: 'Артиллерия (>2 км)',
            hint: 'ПКМ по карте — поставить или удалить точку.<br>ЛКМ — двигать карту.<br>Колесо мыши — масштаб.',
            reset: 'Сбросить вид',
            menuA: 'Позиция миномёта (A)',
            menuB: 'Цель (B)',
            menuDel: 'Удалить точку',
            drawTools: 'Рисование',
            clearDrawings: 'Очистить рисунки',
            markerPrompt: 'Название метки:',
            lineWidth: 'Толщина линии',
            hostName: 'Хост',
            playerName: 'Игрок',
            createLobby: 'Создать лобби',
            joinLobby: 'Присоединиться',
            leaveLobby: 'Покинуть лобби',
            lobby: 'Лобби',
            lobbyCodeLabel: 'Код:',
            you: '(вы)',
            lobbyCreated: 'Лобби создано',
            lobbyConnected: 'Подключено к лобби',
            lobbyNotFound: 'Лобби не найдено',
            lobbyNotConfigured: 'Лобби недоступно в этой версии',
            lobbyError: 'Ошибка подключения к лобби',
            enterLobbyCode: 'Введите код лобби:',
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
            weaponNames: { mortar: 'Миномёт', artillery: 'Артиллерия' }
        }
    };
    let currentLocale = DEFAULT_LOCALE;
    try {
        currentLocale = localStorage.getItem('wardogs_lang') || DEFAULT_LOCALE;
    } catch (e) {
        currentLocale = DEFAULT_LOCALE;
    }
    let translations = {};
    let loaded = false;
    async function loadLocale(locale) {
        if (!SUPPORTED_LOCALES.includes(locale)) {
            locale = DEFAULT_LOCALE;
        }
        try {
            const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
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
            currentLocale = DEFAULT_LOCALE;
            document.documentElement.lang = currentLocale;
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
    function getCurrentLocale() {
        return currentLocale;
    }
    function getSupportedLocales() {
        return SUPPORTED_LOCALES;
    }
    function applyTranslations() {
        if (!loaded) return;
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const translation = t(el.dataset.i18n);
            if (typeof translation === 'string' && translation.includes('<')) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        });
    }
    async function init() {
        await loadLocale(currentLocale);
        applyTranslations();
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = currentLocale;
            langSelect.addEventListener('change', async (e) => {
                const newLocale = e.target.value;
                await loadLocale(newLocale);
                applyTranslations();
            });
        }
    }
    return {
        init,
        loadLocale,
        t,
        getCurrentLocale,
        getSupportedLocales,
        applyTranslations,
        isLoaded: () => loaded
    };
})();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.LocaleManager.init();
    });
} else {
    window.LocaleManager.init();
}