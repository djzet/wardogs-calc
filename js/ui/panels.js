// js/ui/panels.js — Drawer, help-модалка, темы, вышки

window.UIPanels = (function(storage) {
    let theme = storage.loadTheme('dark');
    let showTowers = storage.loadTowers();
    let onChange = null;

    function emit() { if (onChange) onChange(); }

    function init(opts) {
        onChange = opts.onChange || null;
        bind();
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

    return { init, getTheme, getShowTowers, toggleTheme, setShowTowers, openDrawer, openHelp };
})(window.AppStorage);