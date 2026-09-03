window.UIPanels = (function (storage) {
    let theme = storage.loadTheme('dark');
    let showTowers = storage.loadTowers();
    let onChange = null;
    let renderMap = null;
    function t(key) {
        return window.LocaleManager ? window.LocaleManager.t(key) : key;
    }
    function emit() { if (onChange) onChange(); }
    function init(opts) {
        onChange = opts.onChange || null;
        renderMap = opts.renderMap || null;
        bind();
        if (storage.loadTheme(null)) {
            document.documentElement.setAttribute('data-theme-manual', '');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            theme = 'light';
        }
        applyThemeClass();
    }
    function getTheme() { return theme; }
    function getShowTowers() { return showTowers; }
    function applyThemeClass() {
        document.body.classList.toggle('light', theme === 'light');
    }
    function toggleTheme() {
        theme = (theme === 'dark') ? 'light' : 'dark';
        storage.saveTheme(theme);
        applyThemeClass();
        document.documentElement.setAttribute('data-theme-manual', '');
        emit();
    }
    function setShowTowers(v) {
        showTowers = v;
        storage.saveTowers(v);
        emit();
    }
    function openDrawer(state) {
        document.getElementById('drawer').classList.toggle('open', state);
        document.getElementById('drawerBackdrop').classList.toggle('hidden', !state);
        if (window.MapInteractions) {
            window.MapInteractions.invalidateWrapRect();
            window.MapInteractions.invalidateCanvasRect();
        }
    }
    function openHelp(state) {
        document.getElementById('helpModal').classList.toggle('hidden', !state);
    }
    function bind() {
        document.getElementById('drawerToggle').onclick = () => openDrawer(true);
        document.getElementById('drawerClose').onclick = () => openDrawer(false);
        document.getElementById('drawerBackdrop').onclick = () => openDrawer(false);
        document.getElementById('helpToggle').onclick = () => openHelp(true);
        document.getElementById('helpClose').onclick = () => openHelp(false);
        document.getElementById('helpModal').addEventListener('mousedown', e => {
            if (e.target === document.getElementById('helpModal')) openHelp(false);
        });
        const towersToggle = document.getElementById('towersToggle');
        towersToggle.checked = showTowers;
        towersToggle.addEventListener('change', () => {
            setShowTowers(towersToggle.checked);
        });
        document.getElementById('themeToggle').onclick = toggleTheme;
    }
    return {
        init, getTheme, getShowTowers, toggleTheme, setShowTowers,
        openDrawer, openHelp
    };
})(window.AppStorage);
window.UIInputs = (function (points, utils) {
    let inputs = null;
    let timer = null;
    let debounceMs = 80;
    let mapSize = 16000;
    let coordScale = 100;
    function init(opts) {
        inputs = opts.inputs;
        debounceMs = opts.debounceMs || 80;
        mapSize = opts.mapSize;
        coordScale = opts.coordScale || 100;
        const maxGame = String(mapSize / coordScale);
        Object.values(inputs).forEach(i => {
            i.min = '0';
            i.max = maxGame;
            i.step = '0.01';
        });
        bind();
    }
    function setField(el, val) {
        if (document.activeElement !== el) el.value = val;
    }
    function sync() {
        const A = points.getA(), B = points.getB();
        if (A) {
            setField(inputs.ax, utils.gameCoord(A.x, coordScale));
            setField(inputs.ay, utils.gameCoord(A.y, coordScale));
        } else {
            setField(inputs.ax, ''); setField(inputs.ay, '');
        }
        if (B) {
            setField(inputs.bx, utils.gameCoord(B.x, coordScale));
            setField(inputs.by, utils.gameCoord(B.y, coordScale));
        } else {
            setField(inputs.bx, ''); setField(inputs.by, '');
        }
    }
    function onInput() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
        }, debounceMs);
    }
    function onBlur() {
        clearTimeout(timer);
        points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
    }
    function bind() {
        Object.values(inputs).forEach(i => i.addEventListener('input', onInput));
        Object.values(inputs).forEach(i => i.addEventListener('blur', onBlur));
    }
    function setMapSize(size, newCoordScale) {
        mapSize = size;
        if (newCoordScale) coordScale = newCoordScale;
        if (inputs) {
            const maxGame = String(size / coordScale);
            Object.values(inputs).forEach(i => { i.max = maxGame; });
        }
    }
    return { init, sync, setMapSize };
})(window.AppPoints, window.AppUtils);
window.UIContextMenu = (function (utils) {
    let menu = null;
    let menuWorld = null;
    let menuPointKey = null;
    let deps = null;
    function init(d) {
        deps = d;
        menu = document.getElementById('ctxMenu');
        if (!menu) return;
        bind();
    }
    function openMenuAt(sx, sy) {
        if (!menu) return;
        const view = deps.getView();
        menuWorld = utils.screenToWorld(sx, sy, view);
        menuPointKey = deps.hitPoint(sx, sy);
        document.getElementById('menuDelete').classList.toggle('hidden', !menuPointKey);
        menu.classList.remove('hidden');
        const isMobile = window.innerWidth <= 800;
        if (isMobile) {
            menu.style.left = '';
            menu.style.top = '';
        } else {
            const wrap = deps.getWrapRect();
            const canvasEl = document.getElementById('map');
            const canvasRect = canvasEl.getBoundingClientRect();
            const wrapLeft = canvasRect.left - wrap.left;
            const wrapTop = canvasRect.top - wrap.top;
            let left = wrapLeft + sx;
            let top = wrapTop + sy;
            if (left + menu.offsetWidth > wrap.width) left -= menu.offsetWidth;
            if (top + menu.offsetHeight > wrap.height) top -= menu.offsetHeight;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        }
    }
    function hideMenu() { if (menu) menu.classList.add('hidden'); }
    function bind() {
        menu.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            const action = btn ? btn.dataset.action : null;
            if (!action) return;
            if (action === 'setA') deps.setPoint('A', menuWorld.x, menuWorld.y);
            if (action === 'setB') deps.setPoint('B', menuWorld.x, menuWorld.y);
            if (action === 'delete') deps.setPoint(menuPointKey, null, null);
            hideMenu();
        });
    }
    return { init, openMenuAt, hideMenu };
})(window.AppUtils);
window.UIResults = (function (calc, points, utils) {
    let out = null, getWeapons = null, getCurrentWeapon = null, STR = null;
    function replayAnim(el) {
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
    }
    function init(opts) {
        out = opts.out;
        getWeapons = opts.getWeapons;
        getCurrentWeapon = opts.getCurrentWeapon;
        STR = opts.STR;
    }
    function update() {
        out.el.classList.remove('oor', 'warn');
        out.dist.classList.remove('oor', 'warn');
        out.az.classList.remove('oor', 'warn');
        const weapon = getWeapons()[getCurrentWeapon()];
        const r = calc.calculate(points.getA(), points.getB(), weapon);
        if (r.status === 'noPoints') {
            out.dist.textContent = out.az.textContent = out.el.textContent = '—';
            return;
        }
        out.dist.textContent = utils.fmtDist(r.dist, STR);
        out.az.textContent = r.azimuth.toFixed(1) + '°';
        replayAnim(out.dist);
        replayAnim(out.az);
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
        replayAnim(out.el);
    }
    return { init, update };
})(window.AppCalculator, window.AppPoints, window.AppUtils);