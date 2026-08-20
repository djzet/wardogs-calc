// js/features/lobby.js — Cloudflare Durable Objects Lobby
window.AppLobby = (function () {
    const API_BASE = 'https://wardogs-lobby.silaev-egor2003.workers.dev/';
    const WS_BASE = 'wss://wardogs-lobby.silaev-egor2003.workers.dev';

    const COLORS = [
        '#e05656', '#5ba8d3', '#9fd356', '#e8c35a',
        '#d35bba', '#56d3c1', '#ff9d5c', '#7b68ee',
        '#ff6b9d', '#4ecdc4', '#ffe66d', '#95e1d3'
    ];

    let ws = null;
    let myId = localStorage.getItem('wardogs_player_id') || crypto.randomUUID();
    localStorage.setItem('wardogs_player_id', myId);

    let state = {
        code: null,
        isHost: false,
        me: null,
        players: {},
        drawings: [],
        hiddenPlayers: new Set(),
        connected: false
    };

    let onRemoteState = null;
    let onDrawing = null;
    let onCursor = null;
    let onPlayersChange = null;
    let onInit = null;

    function init() { }

    async function create(pointA, pointB, weapon) {
        const res = await fetch(`${API_BASE}/api/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: myId })
        });
        const { code } = await res.json();
        state.code = code;
        state.isHost = true;
        await connectWS(code, 'Командир');
        syncState({ pointA, pointB, weapon });
        return code;
    }

    async function join(code) {
        const res = await fetch(`${API_BASE}/api/lobby/${code}/state`);
        if (!res.ok) return { ok: false, error: 'not_found' };
        const lobbyState = await res.json();
        if (lobbyState.error) return { ok: false, error: lobbyState.error };

        state.code = code;
        state.isHost = false;
        state.drawings = lobbyState.drawings || [];
        state.players = lobbyState.players || {};
        await connectWS(code, 'Наблюдатель');

        return {
            ok: true,
            pointA: lobbyState.pointA,
            pointB: lobbyState.pointB,
            weapon: lobbyState.weapon
        };
    }

    function leave() {
        if (ws) { ws.close(); ws = null; }
        state.code = null; state.isHost = false; state.connected = false;
        state.players = {}; state.drawings = []; state.hiddenPlayers.clear();
    }

    function syncState({ pointA, pointB, weapon }) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'state_update', payload: { pointA, pointB, weapon } }));
    }

    function sendDrawing(tool, color, points, width, label) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'drawing', payload: { tool, color, points, width, label } }));
    }

    let cursorTimer = null;
    function sendCursor(x, y) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (cursorTimer) return;
        cursorTimer = setTimeout(() => { cursorTimer = null; }, 50);
        ws.send(JSON.stringify({ type: 'cursor', payload: { x, y } }));
    }

    function clearDrawings() {
        if (state.isHost && ws) ws.send(JSON.stringify({ type: 'clear_drawings' }));
    }

    function togglePlayerVisibility(playerId, visible) {
        if (visible) state.hiddenPlayers.delete(playerId);
        else state.hiddenPlayers.add(playerId);
    }
    function isPlayerVisible(playerId) { return !state.hiddenPlayers.has(playerId); }

    async function connectWS(code, defaultName) {
        return new Promise((resolve) => {
            const url = `${WS_BASE}/api/lobby/${code}/ws?playerId=${myId}&name=${encodeURIComponent(defaultName)}`;
            ws = new WebSocket(url);
            ws.onopen = () => { state.connected = true; resolve(); };
            ws.onmessage = (event) => {
                try { handleMessage(JSON.parse(event.data)); } catch (e) { }
            };
            ws.onclose = () => { state.connected = false; };
        });
    }

    function handleMessage(msg) {
        switch (msg.type) {
            case 'init':
                state.me = msg.payload;
                state.players = msg.payload.lobby.players;
                state.drawings = msg.payload.lobby.drawings || [];
                if (state.players[msg.payload.playerId]) state.me = state.players[msg.payload.playerId];
                if (onInit) onInit(msg.payload.lobby);
                if (onPlayersChange) onPlayersChange();
                break;
            case 'state_update':
                if (msg.from === myId) break;
                if (onRemoteState) onRemoteState(msg.payload);
                break;
            case 'drawing':
                state.drawings.push(msg.payload);
                if (onDrawing) onDrawing(msg.payload);
                break;
            case 'cursor':
                if (msg.payload.playerId === myId) break;
                if (onCursor) onCursor(msg.payload);
                break;
            case 'player_joined':
                state.players[msg.payload.playerId] = msg.payload;
                if (onPlayersChange) onPlayersChange();
                break;
            case 'player_left':
                delete state.players[msg.payload.playerId];
                if (onPlayersChange) onPlayersChange();
                break;
            case 'clear_drawings':
                state.drawings = [];
                if (onDrawing) onDrawing({ type: 'clear' });
                break;
        }
    }

    function getCode() { return state.code; }
    function isHost() { return state.isHost; }
    function isConnected() { return state.connected; }
    function getPlayers() { return state.players; }
    function getDrawings() { return state.drawings; }
    function getMyId() { return myId; }
    function getMyColor() { return state.me?.color; }
    function getMyName() { return state.me?.name; }

    return {
        init, create, join, leave,
        syncState, sendDrawing, sendCursor, clearDrawings,
        togglePlayerVisibility, isPlayerVisible,
        getCode, isHost, isConnected, getPlayers, getDrawings,
        getMyId, getMyColor, getMyName,
        setOnRemoteState: cb => { onRemoteState = cb; },
        setOnDrawing: cb => { onDrawing = cb; },
        setOnCursor: cb => { onCursor = cb; },
        setOnPlayersChange: cb => { onPlayersChange = cb; },
        setOnInit: cb => { onInit = cb; }
    };
})();