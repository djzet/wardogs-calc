/**
 *
 * Отвечает за:
 * - Боковая панель (drawer) с дополнительными настройками
 * - Модальное окно справки (help)
 * - Переключение темы (dark/light)
 * - Видимость иконок вышек на карте
 *
 * Зависимости: window.AppStorage
 * Экспорт: window.UIPanels
 */

window.UIPanels = (function (storage) {

    /** Текущая тема (загружается из localStorage) */
    let theme = storage.loadTheme('dark');

    /** Показывать ли иконки вышек на карте */
    let showTowers = storage.loadTowers();

    /** Колбэк при изменении настроек (перерисовка карты) */
    let onChange = null;

    /** Колбэк перерисовки карты (не используется напрямую, но хранится) */
    let renderMap = null;

    /**
     * Локализованное значение ключа.
     * @param {string} key — ключ перевода
     * @returns {string}
     */
    function t(key) {
        return window.LocaleManager ? window.LocaleManager.t(key) : key;
    }

    /** Вызывает колбэк onChange для обновления UI */
    function emit() { if (onChange) onChange(); }

    /**
     * Инициализирует модуль панелей.
     * @param {object} opts — зависимости:
     *   onChange — колбэк при изменении настроек
     *   renderMap — колбэк перерисовки карты
     */
    function init(opts) {
        onChange = opts.onChange || null;
        renderMap = opts.renderMap || null;
        bind();
        applyThemeClass();
        /** Если тема сохранена пользователем — помечаем ручной выбор */
        if (storage.loadTheme(null)) {
            document.documentElement.setAttribute('data-theme-manual', '');
        } else {
            /** Тема не выбрана — определяем по системным настройкам */
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                theme = 'light';
                applyThemeClass();
            }
        }
    }

    /** Возвращает текущую тему. @returns {'dark'|'light'} */
    function getTheme() { return theme; }

    /** Возвращает видимость вышек. @returns {boolean} */
    function getShowTowers() { return showTowers; }

    /** Применяет CSS-класс темы на body */
    function applyThemeClass() {
        document.body.classList.toggle('light', theme === 'light');
    }

    /**
     * Переключает тему dark↔light.
     * Сохраняет в localStorage и обновляет CSS.
     */
    function toggleTheme() {
        theme = (theme === 'dark') ? 'light' : 'dark';
        storage.saveTheme(theme);
        applyThemeClass();
        /** Помечаем что пользователь явно выбрал тему —
         *  отключаем автоопределение prefers-color-scheme */
        document.documentElement.setAttribute('data-theme-manual', '');
        emit();
    }

    /**
     * Устанавливает видимость вышек.
     * @param {boolean} v — показывать ли вышки
     */
    function setShowTowers(v) {
        showTowers = v;
        storage.saveTowers(v);
        emit();
    }

    /**
     * Открывает/закрывает боковую панель (drawer).
     * @param {boolean} state — true = открыть, false = закрыть
     */
    function openDrawer(state) {
        document.getElementById('drawer').classList.toggle('open', state);
        document.getElementById('drawerBackdrop').classList.toggle('hidden', !state);
    }

    /**
     * Открывает/закрывает модальное окно справки.
     * @param {boolean} state — true = открыть, false = закрыть
     */
    function openHelp(state) {
        document.getElementById('helpModal').classList.toggle('hidden', !state);
    }

    /**
     * Привязывает обработчики ко всем UI-элементам:
     * - Кнопки открытия/закрытия drawer
     * - Кнопки открытия/закрытия help
     * - Toggle видимости вышек
     * - Кнопка переключения темы
     */
    function bind() {
        document.getElementById('drawerToggle').onclick = () => openDrawer(true);
        document.getElementById('drawerClose').onclick = () => openDrawer(false);
        document.getElementById('drawerBackdrop').onclick = () => openDrawer(false);
        document.getElementById('helpToggle').onclick = () => openHelp(true);
        document.getElementById('helpClose').onclick = () => openHelp(false);

        /** Закрытие help при клике на backdrop (вне модалки) */
        document.getElementById('helpModal').addEventListener('mousedown', e => {
            if (e.target === document.getElementById('helpModal')) openHelp(false);
        });

        /** Toggle видимости вышек */
        const towersToggle = document.getElementById('towersToggle');
        towersToggle.checked = showTowers;
        towersToggle.addEventListener('change', () => {
            setShowTowers(towersToggle.checked);
        });

        /** Кнопка переключения темы */
        document.getElementById('themeToggle').onclick = toggleTheme;
    }

    return {
        init, getTheme, getShowTowers, toggleTheme, setShowTowers,
        openDrawer, openHelp
    };
})(window.AppStorage);

/**
 *
 * Управляет 4 числовыми полями ввода координат точек A и B.
 * Координаты отображаются в игровом формате (0–160, шаг 0.01).
 *
 * Функции:
 * - sync: синхронизирует поля с текущими значениями точек
 * - Обработчики input/blur: применяют введённые значения с debounce
 *
 * Зависимости: window.AppPoints, window.AppUtils
 * Экспорт: window.UIInputs
 */

window.UIInputs = (function (points, utils) {

    /** Объект с 4 полями ввода: {ax, ay, bx, by} */
    let inputs = null;

    /** Таймер debounce для обработки ввода */
    let timer = null;

    /** Задержка debounce по умолчанию (мс) */
    let debounceMs = 80;

    /** Размер карты в метрах (для расчёта макс. игровой координаты) */
    let mapSize = 16000;

    /**
     * Инициализирует модуль полей ввода.
     * Устанавливает min/max/step для всех полей и привязывает обработчики.
     *
     * @param {object} opts — параметры:
     *   inputs — {ax, ay, bx, by} DOM-элементы
     *   debounceMs — задержка debounce
     *   mapSize — размер карты в метрах
     */
    function init(opts) {
        inputs = opts.inputs;
        debounceMs = opts.debounceMs || 80;
        mapSize = opts.mapSize;

        /** Устанавливаем ограничения на числовые поля */
        const maxGame = String(mapSize / 100); /** "160" для 16км карты */
        Object.values(inputs).forEach(i => {
            i.min = '0';
            i.max = maxGame;
            i.step = '0.01';
        });

        bind();
    }

    /**
     * Устанавливает значение поля ввода, если оно не в фокусе.
     * Предотвращает перезапись текста при активном вводе пользователем.
     *
     * @param {HTMLInputElement} el — поле ввода
     * @param {string} val — значение
     */
    function setField(el, val) {
        if (document.activeElement !== el) el.value = val;
    }

    /**
     * Синхронизирует значения полей ввода с текущими координатами точек.
     * Конвертирует метры → игровые координаты (÷100, формат "XX.YY").
     */
    function sync() {
        const A = points.getA(), B = points.getB();

        if (A) {
            setField(inputs.ax, utils.gameCoord(A.x));
            setField(inputs.ay, utils.gameCoord(A.y));
        } else {
            setField(inputs.ax, ''); setField(inputs.ay, '');
        }

        if (B) {
            setField(inputs.bx, utils.gameCoord(B.x));
            setField(inputs.by, utils.gameCoord(B.y));
        } else {
            setField(inputs.bx, ''); setField(inputs.by, '');
        }
    }

    /**
     * Обработчик события input: применяет координаты с debounce.
     * Предотвращает слишком частое обновление карты при быстром вводе.
     */
    function onInput() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
        }, debounceMs);
    }

    /**
     * Обработчик blur: мгновенно применяет координаты.
     * Гарантирует что изменения не потеряются при уходе с поля.
     */
    function onBlur() {
        clearTimeout(timer);
        points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
    }

    /** Привязывает обработчики input и blur ко всем 4 полям */
    function bind() {
        Object.values(inputs).forEach(i => i.addEventListener('input', onInput));
        Object.values(inputs).forEach(i => i.addEventListener('blur', onBlur));
    }

    /**
     * Обновляет размер карты (при смене карты).
     * Пересчитывает max-значение для полей ввода.
     *
     * @param {number} size — новый размер карты в метрах
     */
    function setMapSize(size) {
        mapSize = size;
        if (inputs) {
            const maxGame = String(size / 100);
            Object.values(inputs).forEach(i => { i.max = maxGame; });
        }
    }

    return { init, sync, setMapSize };
})(window.AppPoints, window.AppUtils);

/**
 *
 * ПКМ / long-press на карте открывает меню с действиями:
 * - Установить позицию миномёта (A) в точке
 * - Установить цель (B) в точке
 * - Удалить точку (если кликнули по существующей)
 *
 * Позиционируется рядом с курсором, не выходя за пределы map-wrap.
 *
 * Зависимости: window.AppUtils
 * Экспорт: window.UIContextMenu
 */

window.UIContextMenu = (function (utils) {

    /** DOM-элемент контекстного меню */
    let menu = null;

    /** Мировые координаты точки вызова меню (метры) */
    let menuWorld = null;

    /** Ключ точки под курсором ('A'|'B'|null) — для показа пункта "Удалить" */
    let menuPointKey = null;

    /** Зависимости ( колбэки из index.js ) */
    let deps = null;

    /**
     * Инициализирует контекстное меню.
     * @param {object} d — зависимости:
     *   getView — возвращает текущую камеру
     *   hitPoint — проверяет попадание на точку A/B
     *   setPoint — устанавливает/удаляет точку
     *   getWrapRect — возвращает размер map-wrap
     */
    function init(d) {
        deps = d;
        menu = document.getElementById('ctxMenu');
        if (!menu) return;
        bind();
    }

    /**
     * Открывает контекстное меню в экраниной позиции.
     * Конвертирует экраниые координаты в мировые для setPoint.
     * Позиционирует меню так, чтобы оно не выходило за пределы map-wrap.
     *
     * @param {number} sx — экраниая X координата (пиксели canvas)
     * @param {number} sy — экраниая Y координата (пиксели canvas)
     */
    function openMenuAt(sx, sy) {
        if (!menu) return;
        const view = deps.getView();

        /** Конвертируем экраниые координаты в мировые (метры) */
        menuWorld = utils.screenToWorld(sx, sy, view);

        /** Проверяем, попали ли на существующую точку */
        menuPointKey = deps.hitPoint(sx, sy);

        /** Показываем/скрываем пункт "Удалить" в зависимости от контекста */
        document.getElementById('menuDelete').classList.toggle('hidden', !menuPointKey);

        menu.classList.remove('hidden');

        /** Позиционирование: не выходя за пределы map-wrap */
        const wrap = deps.getWrapRect();
        let left = sx, top = sy;
        if (left + menu.offsetWidth > wrap.width) left -= menu.offsetWidth;
        if (top + menu.offsetHeight > wrap.height) top -= menu.offsetHeight;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    /** Скрывает контекстное меню */
    function hideMenu() { if (menu) menu.classList.add('hidden'); }

    /**
     * Привязывает обработчик кликов по пунктам меню.
     * Действия определяются через data-action атрибут кнопок:
     *   setA    — установить позицию миномёта (A)
     *   setB    — установить цель (B)
     *   delete  — удалить точку под курсором
     */
    function bind() {
        menu.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            const action = btn ? btn.dataset.action : null;
            if (!action) return;

            if (action === 'setA') deps.setPoint('A', menuWorld.x, menuWorld.y);
            if (action === 'setB') deps.setPoint('B', menuWorld.x, menuWorld.y);
            if (action === 'delete') deps.setPoint(menuPointKey, null);

            hideMenu();
        });
    }

    return { init, openMenuAt, hideMenu };
})(window.AppUtils);

/**
 *
 * Обновляет 3 поля в UI:
 * - Дистанция (dist)
 * - Азимут (azimuth)
 * - Угол возвышения (elevation) — в mils
 *
 * Статусы расчёта отображаются с цветовой индикацией:
 *   ok          — зелёный (accent)
 *   warn        — жёлтый (coincide, tooClose)
 *   oor         — красный (outOfRange, noSolution)
 *   noPoints    — прочерки
 *
 * Зависимости: window.AppCalculator, window.AppPoints, window.AppUtils
 * Экспорт: window.UIResults
 */

window.UIResults = (function (calc, points, utils) {

    /** Ссылки на DOM-элементы и данные */
    let out = null, getWeapons = null, getCurrentWeapon = null, STR = null;

    /**
     * Инициализирует модуль результатов.
     * @param {object} opts — зависимости:
     *   out — {dist, az, el} DOM-элементы
     *   getWeapons — функция получения всех оружий
     *   getCurrentWeapon — функция получения текущего оружия
     *   STR — объект локализации
     */
    function init(opts) {
        out = opts.out;
        getWeapons = opts.getWeapons;
        getCurrentWeapon = opts.getCurrentWeapon;
        STR = opts.STR;
    }

    /**
     * Обновляет панель результатов на основе текущих точек и оружия.
     * Вызывается при каждом изменении точек или типа оружия.
     */
    function update() {
        /** Сбрасываем CSS-классы ошибок */
        out.el.classList.remove('oor', 'warn');
        out.dist.classList.remove('oor', 'warn');

        /** Получаем текущее оружие и рассчитываем параметры стрельбы */
        const weapon = getWeapons()[getCurrentWeapon()];
        const r = calc.calculate(points.getA(), points.getB(), weapon);

        /** Точки не заданы — показываем прочерки */
        if (r.status === 'noPoints') {
            out.dist.textContent = out.az.textContent = out.el.textContent = '—';
            return;
        }

        /** Дистанция и азимут отображаются всегда (если есть обе точки) */
        out.dist.textContent = utils.fmtDist(r.dist, STR);
        out.az.textContent = r.azimuth.toFixed(1) + '°';

        switch (r.status) {
            case 'coincide':
                out.el.textContent = STR.zero;
                out.el.classList.add('warn');
                break;
            case 'tooClose':
                out.el.textContent = STR.tooClose || 'слишком близко';
                out.el.classList.add('warn');
                break;
            case 'outOfRange':
            case 'noSolution':
                out.el.textContent = STR.oor;
                out.el.classList.add('oor');
                break;
            case 'ok':
                out.el.textContent = r.mils + utils.NBSP + STR.u_mil;
                break;
        }
    }

    return { init, update };
})(window.AppCalculator, window.AppPoints, window.AppUtils);
