// js/features/lobby.js — Supabase Realtime Lobby

window.AppLobby = (function () {
    const SUPABASE_URL = '__SUPABASE_URL__';
    const SUPABASE_KEY = '__SUPABASE_KEY__';
    const MAX_DRAWINGS = 500;
    const CURSOR_THROTTLE_MS = 50;
    const COLORS = [
        '#ff4757', '#ff6b81', '#ff3838', '#ff5252', '#ff4081', '#f44336', '#e91e63', '#ff1744', '#d50000', '#c51162',
        '#ff7f50', '#ffa502', '#ff9f43', '#ee5a24', '#fa8231', '#f39c12', '#e67e22', '#d35400', '#ff6348', '#ff7675',
        '#ffd32a', '#f9ca24', '#fdcb6e', '#f1c40f', '#f4d03f', '#f7dc6f', '#f9e79f', '#f5b041', '#eb984e', '#dc7633',
        '#bcdc58', '#a8e6cf', '#dcedc1', '#c4e538', '#05c46b', '#0be881', '#00d8d6', '#01a3a4', '#009432', '#006266',
        '#1dd1a1', '#10ac84', '#2ed573', '#7bed9f', '#26de81', '#20bf6b', '#0fb9b1', '#2bcbba', '#45aaf2', '#4b7bec',
        '#2d98da', '#3867d6', '#4b7bec', '#778ca3', '#a5b1c2', '#d1d8e0', '#4bcffa', '#0fbcf9', '#00d2d3', '#54a0ff',
        '#7c5cff', '#8a7cff', '#9b8cff', '#ac9cff', '#bdacff', '#cebcff', '#dfccff', '#f0dcff', '#6a5acd', '#7b68ee',
        '#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb', '#1dd1a1', '#00d2d3', '#54a0ff', '#5f27cd', '#ff9f43', '#ee5253',
        '#0abde3', '#10ac84', '#2e86de', '#5f27cd', '#8395a7', '#576574', '#222f3e', '#1e272e', '#000000', '#ffffff',
        '#e05656', '#5ba8d3', '#9fd356', '#e8c35a', '#d35bba', '#56d3c1', '#ff9d5c', '#7b68ee', '#ff6b9d', '#4ecdc4'
    ];
    let _supabase = null;
    function getSupabase() {
        if (!_supabase) {
            if (!window.supabase) {
                console.warn('[Lobby] Supabase SDK not loaded');
                return null;
            }
            if (SUPABASE_URL.startsWith('__') || SUPABASE_KEY.startsWith('__')) {
                console.warn('[Lobby] Supabase credentials not configured (placeholders detected). Lobby disabled.');
                return null;
            }
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return _supabase;
    }
    let myId = localStorage.getItem('wardogs_player_id') || crypto.randomUUID();
    localStorage.setItem('wardogs_player_id', myId);
    let state = {
        code: null, isHost: false, me: null,
        players: {}, drawings: [], hiddenPlayers: new Set(),
        connected: false
    };
    let realtimeChannel = null;
    let onRemoteState = null, onDrawing = null, onCursor = null;
    let onPlayersChange = null, onInit = null;
    function init() { }
    function generateCode() {
        const arr = new Uint8Array(6);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => (b % 36).toString(36)).join('').toUpperCase();
    }
    async function create(pointA, pointB, weapon) {
        const sb = getSupabase();
        if (!sb) throw new Error('Lobby недоступен: Supabase не настроен');
        try {
            const code = generateCode();
            const myColor = COLORS[0];
            const myName = t('hostName');
            const { error: lobbyError } = await sb
                .from('lobbies')
                .insert({ code, host_id: myId, point_a: pointA, point_b: pointB, weapon });
            if (lobbyError) throw lobbyError;
            const { error: playerError } = await sb
                .from('players')
                .insert({ lobby_code: code, player_id: myId, name: myName, color: myColor, is_host: true });
            if (playerError) throw playerError;
            state.code = code;
            state.isHost = true;
            state.me = { playerId: myId, name: myName, color: myColor };
            state.players[myId] = state.me;
            subscribeToLobby(code);
            if (onPlayersChange) onPlayersChange();
            return code;
        } catch (error) {
            console.error('[Lobby] create failed:', error);
            throw error;
        }
    }
    function t(key) {
        return window.LocaleManager ? window.LocaleManager.t(key) : key;
    }
    async function join(code) {
        const sb = getSupabase();
        if (!sb) return { ok: false, error: 'not_configured' };
        try {
            if (state.code && state.code !== code) {
                await leave();
            }
            const { data: lobby, error: lobbyError } = await sb
                .from('lobbies').select('*').eq('code', code).single();
            if (lobbyError || !lobby) return { ok: false, error: 'not_found' };
            const { data: existingPlayers } = await sb
                .from('players').select('*').eq('lobby_code', code);
            await sb.from('players').delete().eq('lobby_code', code).eq('player_id', myId);
            const others = (existingPlayers || []).filter(p => p.player_id !== myId);
            const takenColors = others.map(p => p.color);
            const myColor = COLORS.find(c => !takenColors.includes(c)) ||
                '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            const myName = `${t('playerName')} ${others.length + 1}`;
            const { error: playerError } = await sb
                .from('players')
                .insert({ lobby_code: code, player_id: myId, name: myName, color: myColor, is_host: false });
            if (playerError) throw playerError;
            state.code = code;
            state.isHost = false;
            state.me = { playerId: myId, name: myName, color: myColor };
            const playersMap = {};
            others.forEach(p => {
                playersMap[p.player_id] = { playerId: p.player_id, name: p.name, color: p.color };
            });
            playersMap[myId] = state.me;
            state.players = playersMap;
            const { data: drawings } = await sb
                .from('drawings').select('*').eq('lobby_code', code).order('created_at', { ascending: true }).limit(MAX_DRAWINGS);
            state.drawings = (drawings || []).map(d => ({
                id: d.id, playerId: d.player_id, tool: d.tool, color: d.color,
                points: d.points, width: d.width, label: d.label,
                createdAt: new Date(d.created_at).getTime()
            }));
            subscribeToLobby(code);
            if (onPlayersChange) onPlayersChange();
            if (onInit) onInit({ pointA: lobby.point_a, pointB: lobby.point_b, weapon: lobby.weapon });
            return { ok: true, pointA: lobby.point_a, pointB: lobby.point_b, weapon: lobby.weapon };
        } catch (error) {
            console.error('[Lobby] join failed:', error);
            return { ok: false, error: 'connection_failed' };
        }
    }
    function subscribeToLobby(code) {
        const sb = getSupabase();
        if (!sb) return;
        if (realtimeChannel) sb.removeChannel(realtimeChannel);
        realtimeChannel = sb.channel(`lobby:${code}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `code=eq.${code}` },
                (payload) => { if (onRemoteState) onRemoteState({ pointA: payload.new.point_a, pointB: payload.new.point_b, weapon: payload.new.weapon }); })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `lobby_code=eq.${code}` },
                (payload) => {
                    const player = { playerId: payload.new.player_id, name: payload.new.name, color: payload.new.color };
                    state.players[player.playerId] = player;
                    if (onPlayersChange) onPlayersChange();
                })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `lobby_code=eq.${code}` },
                (payload) => { delete state.players[payload.old.player_id]; if (onPlayersChange) onPlayersChange(); })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drawings', filter: `lobby_code=eq.${code}` },
                (payload) => {
                    const stroke = { id: payload.new.id, playerId: payload.new.player_id, tool: payload.new.tool, color: payload.new.color, points: payload.new.points, width: payload.new.width, label: payload.new.label, createdAt: new Date(payload.new.created_at).getTime() };
                    state.drawings.push(stroke);
                    if (state.drawings.length > MAX_DRAWINGS) state.drawings = state.drawings.slice(-MAX_DRAWINGS);
                    if (onDrawing) onDrawing(stroke);
                })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'drawings', filter: `lobby_code=eq.${code}` },
                (payload) => { state.drawings = state.drawings.filter(d => d.id !== payload.old.id); if (onDrawing) onDrawing({ type: 'delete', id: payload.old.id }); })
            .on('broadcast', { event: 'cursor' }, ({ payload }) => { if (payload.playerId === myId) return; if (onCursor) onCursor(payload); })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') { state.connected = true; }
                else if (status === 'CHANNEL_ERROR') { state.connected = false; console.error('[Lobby] subscription error'); }
                else if (status === 'CLOSED') { state.connected = false; }
            });
    }
    async function leave() {
        const sb = getSupabase();
        if (cursorTimer) { clearTimeout(cursorTimer); cursorTimer = null; }
        if (realtimeChannel && sb) {
            try { sb.removeChannel(realtimeChannel); } catch (e) { }
            realtimeChannel = null;
        }
        if (state.code && sb) {
            try {
                if (state.isHost) {
                    await sb.from('drawings').delete().eq('lobby_code', state.code);
                    await sb.from('players').delete().eq('lobby_code', state.code);
                    await sb.from('lobbies').delete().eq('code', state.code);
                } else {
                    await sb.from('players').delete().eq('lobby_code', state.code).eq('player_id', myId);
                }
            } catch (e) {
                console.warn('[Lobby] leave cleanup failed:', e);
            }
        }
        state.code = null; state.isHost = false; state.connected = false;
        state.me = null; state.players = {}; state.drawings = []; state.hiddenPlayers.clear();
        if (onPlayersChange) onPlayersChange();
    }
    async function syncState({ pointA, pointB, weapon }) {
        if (!state.code || !state.isHost) return;
        const sb = getSupabase();
        if (!sb) return;
        try { await sb.from('lobbies').update({ point_a: pointA, point_b: pointB, weapon }).eq('code', state.code); }
        catch (e) { console.warn('[Lobby] syncState failed:', e); }
    }
    async function sendDrawing(tool, color, points, width, label) {
        if (!state.code) return;
        const sb = getSupabase();
        if (!sb) return;
        try { await sb.from('drawings').insert({ lobby_code: state.code, player_id: myId, tool, color, points, width, label }); }
        catch (e) { console.warn('[Lobby] sendDrawing failed:', e); }
    }
    let cursorTimer = null;
    function sendCursor(x, y) {
        if (!state.code || !realtimeChannel) return;
        if (cursorTimer) return;
        cursorTimer = setTimeout(() => { cursorTimer = null; }, CURSOR_THROTTLE_MS);
        try {
            realtimeChannel.send({ type: 'broadcast', event: 'cursor', payload: { x, y, playerId: myId, color: state.me?.color } });
        } catch (e) {
            console.warn('[Lobby] sendCursor failed:', e);
        }
    }
    async function clearDrawings() {
        if (!state.isHost || !state.code) return;
        const sb = getSupabase();
        if (!sb) return;
        try { await sb.from('drawings').delete().eq('lobby_code', state.code); }
        catch (e) { console.warn('[Lobby] clearDrawings failed:', e); }
    }
    async function deleteDrawing(id) {
        if (!state.code) return;
        const sb = getSupabase();
        if (!sb) return;
        try {
            await sb.from('drawings').delete().eq('id', id).eq('player_id', myId);
        } catch (e) {
            console.warn('[Lobby] deleteDrawing failed:', e);
        }
    }
    function togglePlayerVisibility(playerId, visible) {
        if (visible) state.hiddenPlayers.delete(playerId); else state.hiddenPlayers.add(playerId);
    }
    function isPlayerVisible(playerId) { return !state.hiddenPlayers.has(playerId); }
    function getCode() { return state.code; }
    function isHost() { return state.isHost; }
    function isConnected() { return state.connected; }
    function getPlayers() { return { ...state.players }; }
    function getDrawings() { return [...state.drawings]; }
    function getMyId() { return myId; }
    function getMyColor() { return state.me?.color; }
    function getMyName() { return state.me?.name; }
    return {
        init, create, join, leave,
        syncState, sendDrawing, sendCursor, clearDrawings, deleteDrawing,
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