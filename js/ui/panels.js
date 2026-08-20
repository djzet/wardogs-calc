// js/ui/panels.js — Drawer, help-модалка, темы, вышки

window.UIPanels = (function (storage) {
    let theme = storage.loadTheme('dark');
    let showTowers = storage.loadTowers();
    let onChange = null;
    let renderMap = null;
    let saveState = null;

    // Helper: получить перевод через LocaleManager
    function t(key) {
        return window.LocaleManager ? window.LocaleManager.t(key) : key;
    }

    function emit() { if (onChange) onChange(); }

    function init(opts) {
        onChange = opts.onChange || null;
        renderMap = opts.renderMap || null;
        saveState = opts.saveState || null;
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

    function renderLobbyPlayers() {
        const list = document.getElementById('lobbyPlayersList');
        const info = document.getElementById('lobbyInfo');
        const section = document.getElementById('lobbySection');
        if (!window.AppLobby || !window.AppLobby.isConnected()) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        const code = window.AppLobby.getCode();
        const players = window.AppLobby.getPlayers();
        const myId = window.AppLobby.getMyId();

        // Безопасно через DOM API
        info.textContent = '';
        const codeSpan = document.createElement('span');
        codeSpan.className = 'lobby-code';
        codeSpan.textContent = t('lobbyCodeLabel') + ' ';
        const codeBold = document.createElement('b');
        codeBold.textContent = code;
        codeSpan.appendChild(codeBold);
        info.appendChild(codeSpan);

        list.innerHTML = '';
        Object.values(players).forEach(p => {
            const isMe = p.playerId === myId;
            const isHidden = !window.AppLobby.isPlayerVisible(p.playerId);

            const row = document.createElement('label');
            row.className = 'player-row';

            // Color indicator
            const colorSpan = document.createElement('span');
            colorSpan.className = 'player-color';
            colorSpan.style.background = p.color;
            row.appendChild(colorSpan);

            // Name (с переводом "вы")
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = p.name + (isMe ? ' ' + t('you') : '');
            row.appendChild(nameSpan);

            // Checkbox (только для других игроков)
            if (!isMe) {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = !isHidden;
                cb.dataset.pid = p.playerId;
                cb.addEventListener('change', (e) => {
                    window.AppLobby.togglePlayerVisibility(p.playerId, e.target.checked);
                    if (renderMap) renderMap();
                });
                row.appendChild(cb);
            }

            list.appendChild(row);
        });
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

        // ─── Создать лобби (с обработкой ошибок) ───
        document.getElementById('createLobbyBtn').addEventListener('click', async () => {
            try {
                const code = await AppLobby.create(AppPoints.getA(), AppPoints.getB(), AppWeapons.get());
                if (code) {
                    AppShare.showToast(`${t('lobbyCreated')}: ${code}`, 'success');
                    renderLobbyPlayers();
                    if (renderMap) renderMap();
                }
            } catch (error) {
                console.error('[Lobby] create failed:', error);
                AppShare.showToast(error.message || t('lobbyError'), 'error');
            }
        });

        // ─── Присоединиться к лобби ───
        document.getElementById('joinLobbyBtn').addEventListener('click', async () => {
            const code = prompt(t('enterLobbyCode'));
            if (!code) return;

            try {
                const res = await AppLobby.join(code.trim().toUpperCase());

                if (res.ok) {
                    AppPoints.assign(res.pointA, res.pointB);
                    if (res.weapon) AppWeapons.set(res.weapon);
                    UIInputs.sync();
                    UIResults.update();
                    if (renderMap) renderMap();
                    AppShare.showToast(t('lobbyConnected'), 'success');
                    renderLobbyPlayers();
                } else if (res.error === 'not_configured') {
                    AppShare.showToast(t('lobbyNotConfigured'), 'error');
                } else if (res.error === 'not_found') {
                    AppShare.showToast(t('lobbyNotFound'), 'error');
                } else {
                    AppShare.showToast(t('lobbyError'), 'error');
                }
            } catch (error) {
                console.error('[Lobby] join failed:', error);
                AppShare.showToast(t('lobbyError'), 'error');
            }
        });

        // ─── Покинуть лобби ───
        document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
            AppLobby.leave();
            renderLobbyPlayers();
            if (renderMap) renderMap();
        });
    }

    return {
        init, getTheme, getShowTowers, toggleTheme, setShowTowers,
        openDrawer, openHelp, renderLobbyPlayers
    };
})(window.AppStorage);