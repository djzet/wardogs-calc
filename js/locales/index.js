// js/locales/index.js — Менеджер локализации (с fallback)

window.LocaleManager = (function () {
    const SUPPORTED_LOCALES = ['ru', 'en', 'de', 'fr', 'es', 'pl', 'uk', 'tr', 'zh'];
    const DEFAULT_LOCALE = 'ru';

    // Fallback переводы на случай если JSON не загрузился
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
            hint: 'ПКМ по карте — поставить или удалить точку.<br>ЛКМ — двигать карту.<br>Колесо мыши — масштаб.',
            reset: 'Сбросить вид',
            menuA: '📍 Позиция миномёта (A)',
            menuB: '🎯 Цель (B)',
            menuDel: '✕ Удалить точку',
            langLabel: 'Язык интерфейса',
            contactLabel: '✉️ Связь',
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
            helpP3: '<b>Координаты.</b> X и Y в процентах карты (0–100).',
            helpP4: '<b>Результаты.</b> Дистанция, азимут, угол в mils, время подлёта.',
            helpP5: '<b>Сохранение.</b> Данные сохраняются автоматически.',
            helpP6: '<b>О калькуляторе.</b> Фан-инструмент для WARDOGS.',
            share: 'Поделиться',
            shareCopied: 'Ссылка скопирована!',
            shareApplied: 'Координаты применены из ссылки',
            weaponNames: { mortar: 'Миномёт', artillery: 'Артиллерия' }
        }
    };

    let currentLocale = localStorage.getItem('wardogs_lang') || DEFAULT_LOCALE;
    let translations = {};
    let loaded = false;

    // Загрузка JSON файла для языка
    async function loadLocale(locale) {
        if (!SUPPORTED_LOCALES.includes(locale)) {
            locale = DEFAULT_LOCALE;
        }

        try {
            const response = await fetch(`js/locales/${locale}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            translations = await response.json();
            currentLocale = locale;
            loaded = true;
            localStorage.setItem('wardogs_lang', locale);
            return translations;
        } catch (error) {
            console.warn(`Failed to load locale ${locale}, using fallback:`, error.message);

            // Используем fallback переводы
            if (FALLBACK_TRANSLATIONS[locale]) {
                translations = FALLBACK_TRANSLATIONS[locale];
            } else {
                translations = FALLBACK_TRANSLATIONS[DEFAULT_LOCALE];
            }
            currentLocale = locale;
            loaded = true;
            return translations;
        }
    }

    // Получить перевод по ключу
    function t(key) {
        if (!loaded) {
            // Если ещё не загружено, используем fallback
            const fallback = FALLBACK_TRANSLATIONS[DEFAULT_LOCALE];
            return getNestedValue(fallback, key) || key;
        }

        const value = getNestedValue(translations, key);
        return value !== undefined ? value : key;
    }

    // Вспомогательная функция для вложенных ключей
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

    // Получить текущий язык
    function getCurrentLocale() {
        return currentLocale;
    }

    // Получить список поддерживаемых языков
    function getSupportedLocales() {
        return SUPPORTED_LOCALES;
    }

    // Применить переводы к DOM
    function applyTranslations() {
        if (!loaded) return;

        // Обновляем все элементы с data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = t(key);

            // Определяем, нужно ли использовать innerHTML (для helpP1-helpP6, hint)
            const htmlKeys = ['hint', 'helpP1', 'helpP2', 'helpP3', 'helpP4', 'helpP5', 'helpP6'];

            if (htmlKeys.includes(key)) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        });

        // Обновляем названия оружия в radio buttons
        const mortarLabel = document.querySelector('input[value="mortar"] + span');
        const artilleryLabel = document.querySelector('input[value="artillery"] + span');

        if (mortarLabel) {
            const mortarName = t('weaponNames.mortar');
            mortarLabel.textContent = `${mortarName} (700 м)`;
        }

        if (artilleryLabel) {
            const artilleryName = t('weaponNames.artillery');
            artilleryLabel.textContent = `${artilleryName} (>2 км)`;
        }

        // Триггерим перерисовку карты если она существует
        if (typeof draw === 'function') {
            draw();
        }

        // Триггерим перерасчёт если функция существует
        if (typeof recalc === 'function') {
            recalc();
        }
    }

    // Инициализация
    async function init() {
        await loadLocale(currentLocale);
        applyTranslations();

        // Обновляем select элемент
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = currentLocale;

            // Добавляем обработчик изменения
            langSelect.addEventListener('change', async (e) => {
                const newLocale = e.target.value;
                await loadLocale(newLocale);
                applyTranslations();
            });
        }
    }

    // Публичный API
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

// Автоматическая инициализация после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.LocaleManager.init();
    });
} else {
    window.LocaleManager.init();
}