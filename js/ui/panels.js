// js/ui/panels.js — Drawer, help-модалка, темы, вышки

window.UIPanels = (function (storage) {
    let theme = storage.loadTheme('dark');
    let showTowers = storage.loadTowers();
    let onChange = null;
    let renderMap = null;
    let saveState = null;

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
        if (!window.AppLobby.isConnected()) {
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
        codeSpan.textContent = 'Код: ';
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

            // Name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = `${p.name}${isMe ? ' (вы)' : ''}`;
            row.appendChild(nameSpan);

            // Checkbox (только для других игроков)
            if (!isMe) {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = !isHidden;
                cb.dataset.pid = p.playerId;
                cb.addEventListener('change', (e) => {
                    window.AppLobby.togglePlayerVisibility(p.playerId, e.target.checked);
                    renderMap();
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

        // Lobby кнопки
        document.getElementById('createLobbyBtn').addEventListener('click', async () => {
            const code = await AppLobby.create(AppPoints.getA(), AppPoints.getB(), AppWeapons.get());
            if (code) {
                AppShare.showToast(`Лобби создано: ${code}`, 'success');
                renderLobbyPlayers();
                if (renderMap) renderMap();
            }
        });

        document.getElementById('joinLobbyBtn').addEventListener('click', () => {
            const code = prompt('Введите код лобби:');
            if (!code) return;
            AppLobby.join(code.trim().toUpperCase()).then(res => {
                if (res.ok) {
                    AppPoints.assign(res.pointA, res.pointB);
                    if (res.weapon) AppWeapons.set(res.weapon);
                    UIInputs.sync();
                    UIResults.update();
                    if (renderMap) renderMap();
                    AppShare.showToast('Подключено к лобби', 'success');
                    renderLobbyPlayers();
                } else {
                    AppShare.showToast('Лобби не найдено', 'error');
                }
            });
        });

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