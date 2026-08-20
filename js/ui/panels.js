// js/ui/panels.js — Drawer, help-модалка, темы, вышки

window.UIPanels = (function (storage) {
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

        info.innerHTML = `<span class="lobby-code">Код: <b>${code}</b></span>`;

        list.innerHTML = '';
        Object.values(players).forEach(p => {
            const isMe = p.playerId === myId;
            const isHidden = !window.AppLobby.isPlayerVisible(p.playerId);

            const row = document.createElement('label');
            row.className = 'player-row';
            row.innerHTML = `
      <span class="player-color" style="background:${p.color}"></span>
      <span class="player-name">${p.name} ${isMe ? '(вы)' : ''}</span>
      ${!isMe ? `<input type="checkbox" ${!isHidden ? 'checked' : ''} data-pid="${p.playerId}">` : ''}
    `;

            const cb = row.querySelector('input');
            if (cb) {
                cb.addEventListener('change', (e) => {
                    window.AppLobby.togglePlayerVisibility(p.playerId, e.target.checked);
                });
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
                    renderMap();
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
        });
    }

    return {
        init, getTheme, getShowTowers, toggleTheme, setShowTowers,
        openDrawer, openHelp, renderLobbyPlayers
    };
})(window.AppStorage);