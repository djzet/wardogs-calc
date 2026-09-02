/**
 *
 * Отвечает за сохранение/восстановление:
 * - Позиций точек A/B и камеры (view)
 * - Выбранного оружия
 * - Темы оформления
 * - Видимости вышек
 * - Выбранной карты
 *
 * Все данные хранятся в процентах (0–100%) для переносимости между картами.
 * Экспорт: window.AppStorage
 */

window.AppStorage = (function (utils) {

    /** Ключи localStorage для каждого типа данных */
    const STATE_KEY = 'wardogs_mortar_state';   /** Точки A/B + view камеры */
    const WEAPON_KEY = 'wardogs_weapon';         /** Выбранное оружие */
    const THEME_KEY = 'wardogs_theme';           /** Тема (dark/light) */
    const TOWERS_KEY = 'wardogs_towers';         /** Показывать ли вышки */
    const MAP_KEY = 'wardogs_map';               /** Выбранная карта */

    /**
     * Сохраняет текущее состояние (точки + камера) в localStorage.
     * Координаты конвертируются из метров в проценты (0–100%)
     * для совместимости при смене карты.
     *
     * @param {object|null} pointA — точка A {x, y} в метрах
     * @param {object|null} pointB — точка B {x, y} в метрах
     * @param {object} view — объект камеры {scale, ox, oy}
     * @param {number} mapSize — размер карты в метрах
     */
    function saveState(pointA, pointB, view, mapSize) {
        const state = {
            pointA: pointA ? {
                px: utils.metersToPercent(pointA.x, mapSize),  /** X в % */
                py: utils.metersToPercent(pointA.y, mapSize)   /** Y в % */
            } : null,
            pointB: pointB ? {
                px: utils.metersToPercent(pointB.x, mapSize),
                py: utils.metersToPercent(pointB.y, mapSize)
            } : null,
            /** Камера хранится в экранных координатах (scale, ox, oy) */
            view: { scale: view.scale, ox: view.ox, oy: view.oy }
        };
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    /**
     * Загружает сохранённое состояние из localStorage.
     * Конвертирует проценты обратно в метры для текущего размера карты.
     *
     * @param {number} mapSize — размер текущей карты в метрах
     * @returns {{view: object, pointA: object|null, pointB: object|null}|null}
     */
    function loadState(mapSize) {
        const saved = localStorage.getItem(STATE_KEY);
        if (!saved) return null;
        try {
            const state = JSON.parse(saved);
            const result = { view: null, pointA: null, pointB: null };

            /** Конвертация процентных координат точки A в метры */
            if (state.pointA) {
                result.pointA = {
                    x: utils.percentToMeters(state.pointA.px, mapSize),
                    y: utils.percentToMeters(state.pointA.py, mapSize)
                };
            }
            /** Конвертация процентных координат точки B в метры */
            if (state.pointB) {
                result.pointB = {
                    x: utils.percentToMeters(state.pointB.px, mapSize),
                    y: utils.percentToMeters(state.pointB.py, mapSize)
                };
            }
            if (state.view) {
                result.view = state.view;
            }
            return result;
        } catch (e) {
            console.warn('Failed to load state:', e);
            return null;
        }
    }

    /** Сохраняет ID выбранного оружия ('mortar' | 'artillery') */
    function saveWeapon(weapon) {
        localStorage.setItem(WEAPON_KEY, weapon);
    }

    /** Загружает сохранённое оружие или возвращает значение по умолчанию */
    function loadWeapon(defaultWeapon) {
        return localStorage.getItem(WEAPON_KEY) || defaultWeapon;
    }

    /** Сохраняет тему ('dark' | 'light') */
    function saveTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
    }

    /** Загружает сохранённую тему или возвращает значение по умолчанию */
    function loadTheme(defaultTheme) {
        return localStorage.getItem(THEME_KEY) || defaultTheme;
    }

    /** Сохраняет видимость вышек (true/false, хранится как '1'/'0') */
    function saveTowers(show) {
        localStorage.setItem(TOWERS_KEY, show ? '1' : '0');
    }

    /** Загружает настройку видимости вышек (по умолчанию true) */
    function loadTowers() {
        return localStorage.getItem(TOWERS_KEY) !== '0';
    }

    /** Сохраняет ID выбранной карты */
    function saveMap(mapId) {
        localStorage.setItem(MAP_KEY, mapId);
    }

    /** Загружает сохранённую карту или возвращает карту по умолчанию */
    function loadMap(defaultMap) {
        return localStorage.getItem(MAP_KEY) || defaultMap;
    }

    return {
        saveState, loadState,
        saveWeapon, loadWeapon,
        saveTheme, loadTheme,
        saveTowers, loadTowers,
        saveMap, loadMap
    };
})(window.AppUtils);

/**
 *
 * Точка A — огневая позиция (миномёт/арталлерия).
 * Точка B — цель.
 *
 * Точки хранятся в мировых координатах (метры), зажатые в пределах карты.
 * При изменении вызывается колбэк onChange для обновления UI.
 *
 * Зависимости: window.AppUtils
 * Экспорт: window.AppPoints
 */

window.AppPoints = (function (utils) {

    /** Текущая позиция A (огневая позиция) — {x, y} в метрах или null */
    let pointA = null;

    /** Текущая позиция B (цель) — {x, y} в метрах или null */
    let pointB = null;

    /** Размер карты в метрах (для ограничения координат) */
    let mapSize = 16000;

    /** Колбэк, вызываемый при любом изменении точек */
    let onChange = null;

    /**
     * Инициализирует модуль: устанавливает размер карты и колбэк изменения.
     * Вызывается при загрузке и при смене карты.
     *
     * @param {{mapSize: number, onChange?: Function}} opts — параметры конфигурации
     */
    function configure(opts) {
        mapSize = opts.mapSize;
        onChange = opts.onChange || null;
    }

    /** Вызывает колбэк onChange при изменении точек */
    function emit() { if (onChange) onChange(); }

    /** Возвращает текущую точку A (огневая позиция). @returns {{x: number, y: number}|null} */
    function getA() { return pointA; }

    /** Возвращает текущую точку B (цель). @returns {{x: number, y: number}|null} */
    function getB() { return pointB; }

    /**
     * Устанавливает точку A или B.
     * Координаты зажимаются (clamp) в пределах [0, mapSize].
     * Если x/y — null, точка удаляется.
     *
     * @param {'A'|'B'} key — идентификатор точки
     * @param {number|null} x — X координата в метрах
     * @param {number|null} y — Y координата в метрах
     */
    function setPoint(key, x, y) {
        let p = null;
        if (x != null && y != null) {
            p = { x: utils.clamp(x, 0, mapSize), y: utils.clamp(y, 0, mapSize) };
        }
        if (key === 'A') pointA = p; else pointB = p;
        emit();
    }

    /**
     * Напрямую присваивает обе точки (без колбэка onChange).
     * Используется при восстановлении состояния из localStorage
     * или парсинга параметров URL — чтобы не вызывать лишних обновлений.
     *
     * @param {{x: number, y: number}|null} a — точка A
     * @param {{x: number, y: number}|null} b — точка B
     */
    function assign(a, b) {
        pointA = a;
        pointB = b;
    }

    /**
     * Считывает координаты точки из полей ввода.
     * Ввод — в игровых координатах (0–160), конвертирует в метры (* 100).
     * Запятая заменяется на точку для совместимости с европейской раскладкой.
     *
     * @param {HTMLInputElement} ix — поле X
     * @param {HTMLInputElement} iy — поле Y
     * @returns {{x: number, y: number}|null} точка в метрах или null при ошибке
     */
    function readPoint(ix, iy) {
        const gx = parseFloat(String(ix.value).replace(',', '.'));
        const gy = parseFloat(String(iy.value).replace(',', '.'));
        if (isNaN(gx) || isNaN(gy)) return null;
        const maxGame = mapSize / 100; /** Макс. игровая координата (160) */
        return {
            x: utils.clamp(gx, 0, maxGame) * 100,
            y: utils.clamp(gy, 0, maxGame) * 100
        };
    }

    /**
     * Считывает и применяет координаты из всех полей ввода (A и B).
     * Вызывается из обработчиков input/blur на полях координат.
     *
     * @param {HTMLInputElement} ax — поле X точки A
     * @param {HTMLInputElement} ay — поле Y точки A
     * @param {HTMLInputElement} bx — поле X точки B
     * @param {HTMLInputElement} by — поле Y точки B
     */
    function applyFromInputs(ax, ay, bx, by) {
        pointA = readPoint(ax, ay);
        pointB = readPoint(bx, by);
        emit();
    }

    /**
     * Проверяет, попала ли экраниая позиция ( клик/касание) на точку A или B.
     * Использует Euclidean расстояние с радиусом попадания 12 px.
     *
     * @param {number} sx — экраниая X координата (пиксели)
     * @param {number} sy — экраниая Y координата (пиксели)
     * @param {{scale: number, ox: number, oy: number}} view — объект камеры
     * @returns {'A'|'B'|null} ключ попавшей точки или null
     */
    function hitPoint(sx, sy, view) {
        for (const [key, p] of [['A', pointA], ['B', pointB]]) {
            if (!p) continue;
            const s = utils.worldToScreen(p.x, p.y, view);
            if (Math.hypot(s.x - sx, s.y - sy) <= 12) return key;
        }
        return null;
    }

    return { configure, getA, getB, setPoint, assign, applyFromInputs, hitPoint };
})(window.AppUtils);

/**
 *
 * Управляет состоянием текущего оружия (mortar/artillery):
 * - Привязывает radio-кнопки в UI
 * - Сохраняет выбор в localStorage через AppStorage
 * - Уведомляет при изменении типа оружия
 *
 * Зависимости: window.AppStorage
 * Экспорт: window.AppWeapons
 */

window.AppWeapons = (function (storage) {

    /** Текущий ID выбранного оружия ('mortar' | 'artillery') */
    let currentWeapon = null;

    /**
     * Инициализирует модуль: загружает сохранённое оружие и привязывает UI.
     *
     * @param {string} defaultWeapon — оружие по умолчанию из конфига
     * @param {Function} onChange — колбэк при смене оружия (обновление результатов и карты)
     */
    function init(defaultWeapon, onChange) {
        currentWeapon = storage.loadWeapon(defaultWeapon);
        /** Validate weapon ID — prevent corrupted localStorage from crashing the app */
        if (!['mortar', 'artillery'].includes(currentWeapon)) {
            currentWeapon = defaultWeapon;
            storage.saveWeapon(currentWeapon);
        }
        bind(onChange);
    }

    /** Возвращает ID текущего оружия. @returns {string} */
    function get() { return currentWeapon; }

    /**
     * Программно устанавливает оружие (например, из шаринга).
     * Обновляет radio-кнопки в UI и сохраняет в localStorage.
     *
     * @param {string} w — ID оружия ('mortar' | 'artillery')
     */
    function set(w) {
        if (!['mortar', 'artillery'].includes(w)) return;
        currentWeapon = w;
        storage.saveWeapon(w);
        /** Синхронизируем состояние radio-кнопок */
        document.querySelectorAll('input[name="weapon"]').forEach(r => {
            r.checked = r.value === w;
        });
    }

    /** Store bound onChange handler to remove duplicates on re-bind */
    let _boundOnChange = null;

    /**
     * Привязывает обработчики к radio-кнопкам выбора оружия.
     * При клике сохраняет выбор и вызывает колбэк onChange.
     * Снимает предыдущие обработчики для предотвращения дублирования.
     *
     * @param {Function} onChange — колбэк при смене оружия
     */
    function bind(onChange) {
        /** Remove previous listeners to prevent duplicate handlers */
        if (_boundOnChange) {
            document.querySelectorAll('input[name="weapon"]').forEach(radio => {
                radio.removeEventListener('change', _boundOnChange);
            });
        }
        _boundOnChange = (e) => {
            currentWeapon = e.target.value;
            storage.saveWeapon(currentWeapon);
            if (onChange) onChange();
        };
        const radios = document.querySelectorAll('input[name="weapon"]');
        radios.forEach(radio => {
            if (radio.value === currentWeapon) radio.checked = true;
            radio.addEventListener('change', _boundOnChange);
        });
    }

    return { init, get, set };
})(window.AppStorage);

/**
 *
 * Позволяет:
 * - Генерировать URL с параметрами (точки A/B, оружие, карта)
 * - Копировать ссылку в буфер обмена
 * - Парсить параметры из URL при открытии
 * - Показывать всплывающие уведомления (toast)
 *
 * Формат URL: ?ax=XX&ay=YY&bx=XX&by=YY&w=mortar&map=bakurani
 * Координаты в URL — в процентах (0–100%).
 *
 * Зависимости: window.AppUtils
 * Экспорт: window.AppShare
 */

window.AppShare = (function (utils) {

    /** Таймер для скрытия toast-уведомления */
    let toastTimer = null;

    /**
     * Генерирует URL со всеми параметрами состояния.
     * Координаты конвертируются из метров в проценты (0–100%).
     *
     * @param {object|null} pointA — точка A {x, y} в метрах
     * @param {object|null} pointB — точка B {x, y} в метрах
     * @param {string} currentWeapon — ID текущего оружия ('mortar' | 'artillery')
     * @param {number} mapSize — размер карты в метрах
     * @param {string} mapId — ID текущей карты
     * @returns {string} полный URL для шаринга
     */
    function generateUrl(pointA, pointB, currentWeapon, mapSize, mapId) {
        const params = new URLSearchParams();

        /** Добавляем координаты точки A в процентах (2 знака) */
        if (pointA) {
            params.set('ax', utils.metersToPercent(pointA.x, mapSize).toFixed(2));
            params.set('ay', utils.metersToPercent(pointA.y, mapSize).toFixed(2));
        }

        /** Добавляем координаты точки B в процентах (2 знака) */
        if (pointB) {
            params.set('bx', utils.metersToPercent(pointB.x, mapSize).toFixed(2));
            params.set('by', utils.metersToPercent(pointB.y, mapSize).toFixed(2));
        }

        /** Тип оружия */
        params.set('w', currentWeapon);

        /** ID карты (если не дефолтная) */
        if (mapId) params.set('map', mapId);

        return location.origin + location.pathname + '?' + params.toString();
    }

    /**
     * Копирует текст в буфер обмена.
     * Сначала пробует современный Clipboard API, затем fallback на execCommand.
     *
     * @param {string} text — текст для копирования
     * @returns {true} всегда true (ошибки перехватываются)
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            /** Fallback: создаем невидимый input и копируем через execCommand */
            const input = document.createElement('input');
            input.value = text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            return true;
        }
    }

    /**
     * Показывает всплывающее уведомление (toast) с анимацией.
     * Автоматически скрывается через 2.5 секунды.
     *
     * @param {string} message — текст уведомления
     * @param {string} [type='success'] — тип стиля ('success' | другой)
     */
    function showToast(message, type = 'success') {
        let toast = document.getElementById('toast');

        /** Создаём toast-элемент, если его ещё нет в DOM */
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            const wrap = document.querySelector('.map-wrap') || document.body;
            wrap.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = 'toast ' + type;

        /** Принудительный reflow для перезапуска CSS-анимации */
        void toast.offsetWidth;
        toast.classList.add('show');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    /**
     * Парсит параметры URL и извлекает состояние из шаринга.
     *
     * Параметры URL:
     *   ax, ay — координаты точки A в процентах
     *   bx, by — координаты точки B в процентах
     *   w      — тип оружия ('mortar' | 'artillery')
     *   map    — ID карты
     *
     * @param {number} mapSize — размер текущей карты в метрах
     * @param {object} knownMaps — объект всех доступных карт из CONFIG_APP
     * @returns {{applied: boolean, pointA: object|null, pointB: object|null, weapon: string|null, mapId: string|null}}
     */
    function parseSharedParams(mapSize, knownMaps) {
        const params = new URLSearchParams(location.search);
        const result = { applied: false, pointA: null, pointB: null, weapon: null, mapId: null };

        /** Проверяем и валидируем ID карты */
        if (params.has('map') && knownMaps && knownMaps[params.get('map')]) {
            result.mapId = params.get('map');
            result.applied = true;
        }

        /** Парсим координаты точки A (проценты → метры) */
        if (params.has('ax') && params.has('ay')) {
            const ax = parseFloat(params.get('ax'));
            const ay = parseFloat(params.get('ay'));
            if (!isNaN(ax) && !isNaN(ay)) {
                result.pointA = {
                    x: utils.percentToMeters(utils.clamp(ax, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(ay, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }

        /** Парсим координаты точки B (проценты → метры) */
        if (params.has('bx') && params.has('by')) {
            const bx = parseFloat(params.get('bx'));
            const by = parseFloat(params.get('by'));
            if (!isNaN(bx) && !isNaN(by)) {
                result.pointB = {
                    x: utils.percentToMeters(utils.clamp(bx, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(by, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }

        /** Парсим тип оружия (только разрешённые значения) */
        if (params.has('w')) {
            const w = params.get('w');
            if (w === 'mortar' || w === 'artillery') {
                result.weapon = w;
                result.applied = true;
            }
        }

        return result;
    }

    return {
        generateUrl,
        copyToClipboard,
        showToast,
        parseSharedParams
    };
})(window.AppUtils);
