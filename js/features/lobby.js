// js/features/lobby.js — Supabase Realtime Lobby
window.AppLobby = (function () {
    // ─── Supabase конфиг ────────────────────────────────────
    const SUPABASE_URL = '__SUPABASE_URL__';
    const SUPABASE_KEY = '__SUPABASE_KEY__';

    const MAX_DRAWINGS = 500;
    const CURSOR_THROTTLE_MS = 50;

    const COLORS = [
        '#e05656', '#5ba8d3', '#9fd356', '#e8c35a',
        '#d35bba', '#56d3c1', '#ff9d5c', '#7b68ee',
        '#ff6b9d', '#4ecdc4', '#ffe66d', '#95e1d3'
    ];

    // ─── Ленивая инициализация клиента ──────────────────────
    let _supabase = null;
    function getSupabase() {
        if (!_supabase) {
            if (!window.supabase) {
                throw new Error('Supabase SDK не загружен');
            }
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return _supabase;
    }

    // ─── Состояние ──────────────────────────────────────────
    let myId = localStorage.getItem('wardogs_player_id') || crypto.randomUUID();
    localStorage.setItem('wardogs_player_id', myId);

    let state = {
        code: null, isHost: false, me: null,
        players: {}, drawings: [], hiddenPlayers: new Set(),
        connected: false
    };

    let realtimeChannel = null;

    // ─── Колбэки ────────────────────────────────────────────
    let onRemoteState = null, onDrawing = null, onCursor = null;
    let onPlayersChange = null, onInit = null;

    function init() { }
    function generateCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // ─── Создание лобби ─────────────────────────────────────
    async function create(pointA, pointB, weapon) {
        try {
            const code = generateCode();
            const myColor = COLORS[0];
            const myName = 'Командир';

            const sb = getSupabase();
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

    // ─── Присоединение к лобби ──────────────────────────────
    async function join(code) {
        try {
            const sb = getSupabase();
            const { data: lobby, error: lobbyError } = await sb
                .from('lobbies').select('*').eq('code', code).single();
            if (lobbyError || !lobby) return { ok: false, error: 'not_found' };

            const { data: existingPlayers } = await sb
                .from('players').select('*').eq('lobby_code', code);

            const takenColors = (existingPlayers || []).map(p => p.color);
            const myColor = COLORS.find(c => !takenColors.includes(c)) ||
                '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            const myName = `Игрок ${(existingPlayers?.length || 0) + 1}`;

            const { error: playerError } = await sb
                .from('players')
                .insert({ lobby_code: code, player_id: myId, name: myName, color: myColor, is_host: false });
            if (playerError) throw playerError;

            state.code = code;
            state.isHost = false;
            state.me = { playerId: myId, name: myName, color: myColor };

            const playersMap = {};
            (existingPlayers || []).forEach(p => {
                playersMap[p.player_id] = { playerId: p.player_id, name: p.name, color: p.color };
            });
            playersMap[myId] = state.me;
            state.players = playersMap;

            const { data: drawings } = await sb
                .from('drawings').select('*').eq('lobby_code', code).order('created_at', { ascending: true });

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

    // ─── Подписка на Realtime ───────────────────────────────
    function subscribeToLobby(code) {
        const sb = getSupabase();
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
                (payload) => { state.drawings = state.drawings.filter(d => d.id !== payload.old.id); if (onDrawing) onDrawing({ type: 'clear' }); })
            .on('broadcast', { event: 'cursor' }, ({ payload }) => { if (payload.playerId === myId) return; if (onCursor) onCursor(payload); })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') { state.connected = true; console.log('[Lobby] subscribed to', code); }
                else if (status === 'CHANNEL_ERROR') console.error('[Lobby] subscription error');
            });
    }

    // ─── Покинуть лобби ─────────────────────────────────────
    async function leave() {
        if (realtimeChannel) { getSupabase().removeChannel(realtimeChannel); realtimeChannel = null; }
        if (state.code) {
            const sb = getSupabase();
            await sb.from('players').delete().eq('lobby_code', state.code).eq('player_id', myId);
            if (state.isHost) {
                await sb.from('drawings').delete().eq('lobby_code', state.code);
                await sb.from('players').delete().eq('lobby_code', state.code);
                await sb.from('lobbies').delete().eq('code', state.code);
            }
        }
        state.code = null; state.isHost = false; state.connected = false;
        state.players = {}; state.drawings = []; state.hiddenPlayers.clear();
        if (onPlayersChange) onPlayersChange();
    }

    async function syncState({ pointA, pointB, weapon }) {
        if (!state.code) return;
        try { await getSupabase().from('lobbies').update({ point_a: pointA, point_b: pointB, weapon }).eq('code', state.code); }
        catch (e) { console.warn('[Lobby] syncState failed:', e); }
    }

    async function sendDrawing(tool, color, points, width, label) {
        if (!state.code) return;
        try { await getSupabase().from('drawings').insert({ lobby_code: state.code, player_id: myId, tool, color, points, width, label }); }
        catch (e) { console.warn('[Lobby] sendDrawing failed:', e); }
    }

    let cursorTimer = null;
    function sendCursor(x, y) {
        if (!state.code || !realtimeChannel) return;
        if (cursorTimer) return;
        cursorTimer = setTimeout(() => { cursorTimer = null; }, CURSOR_THROTTLE_MS);
        realtimeChannel.send({ type: 'broadcast', event: 'cursor', payload: { x, y, playerId: myId, color: state.me?.color } });
    }

    async function clearDrawings() {
        if (!state.isHost || !state.code) return;
        try { await getSupabase().from('drawings').delete().eq('lobby_code', state.code); }
        catch (e) { console.warn('[Lobby] clearDrawings failed:', e); }
    }

    async function deleteDrawing(id) {
        if (!state.code) return;
        try {
            await getSupabase()
                .from('drawings')
                .delete()
                .eq('id', id)
                .eq('player_id', myId); // только свои
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
    function getPlayers() { return state.players; }
    function getDrawings() { return state.drawings; }
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