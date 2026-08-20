// WARDOGS LOBBY — Cloudflare Worker + Durable Object
// Единый файл: скопируй весь код и вставь в этот файл

const COLORS = [
    '#e05656', '#5ba8d3', '#9fd356', '#e8c35a',
    '#d35bba', '#56d3c1', '#ff9d5c', '#7b68ee',
    '#ff6b9d', '#4ecdc4', '#ffe66d', '#95e1d3'
];

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

class Lobby {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map();
        this.lobby = null;
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (!this.lobby) this.lobby = await this.state.storage.get('lobby');

        if (url.pathname === '/create' && request.method === 'POST') {
            const { playerId, code: requestedCode } = await request.json();
            const code = requestedCode || generateCode();
            this.lobby = {
                code, hostId: playerId,
                pointA: null, pointB: null, weapon: 'mortar',
                drawings: [], players: {}, createdAt: Date.now()
            };
            await this.state.storage.put('lobby', this.lobby);
            return json({ code, created: true });
        }

        if (url.pathname === '/state' && request.method === 'GET') {
            if (!this.lobby) return json({ error: 'not_found' }, 404);
            return json(this.getPublicState());
        }

        if (url.pathname === '/ws') {
            const upgrade = request.headers.get('Upgrade');
            if (upgrade !== 'websocket') return new Response('Expected websocket', { status: 400 });
            if (!this.lobby) return new Response('Lobby not found', { status: 404 });

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);
            this.state.acceptWebSocket(server);

            const playerId = url.searchParams.get('playerId') || crypto.randomUUID();
            const requestedName = url.searchParams.get('name') || 'Игрок';
            this.handleConnection(server, playerId, requestedName);

            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response('Not found', { status: 404 });
    }

    handleConnection(ws, playerId, requestedName) {
        const takenColors = Object.values(this.lobby.players).map(p => p.color);
        const color = COLORS.find(c => !takenColors.includes(c)) ||
            '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        const name = `${requestedName} ${Object.keys(this.lobby.players).length + 1}`;

        const player = { playerId, name, color };
        this.lobby.players[playerId] = player;
        this.sessions.set(ws, player);

        this.send(ws, { type: 'init', payload: { playerId, name, color, lobby: this.getPublicState() } });
        this.broadcast({ type: 'player_joined', payload: player }, ws);

        ws.addEventListener('message', async (msg) => {
            try { await this.handleMessage(ws, JSON.parse(msg.data)); } catch (e) { }
        });

        ws.addEventListener('close', () => {
            this.sessions.delete(ws);
            if (this.lobby.players[playerId]) {
                delete this.lobby.players[playerId];
                this.broadcast({ type: 'player_left', payload: { playerId } });
                this.saveLobby();
            }
        });
    }

    async handleMessage(ws, data) {
        const player = this.sessions.get(ws);
        if (!player) return;

        switch (data.type) {
            case 'state_update': {
                if (data.payload.pointA !== undefined) this.lobby.pointA = data.payload.pointA;
                if (data.payload.pointB !== undefined) this.lobby.pointB = data.payload.pointB;
                if (data.payload.weapon !== undefined) this.lobby.weapon = data.payload.weapon;
                await this.saveLobby();
                this.broadcast({ type: 'state_update', payload: data.payload, from: player.playerId }, ws);
                break;
            }
            case 'drawing': {
                const stroke = {
                    id: crypto.randomUUID(), playerId: player.playerId,
                    tool: data.payload.tool || 'pen',
                    color: data.payload.color || player.color,
                    points: data.payload.points,
                    width: data.payload.width || 2,
                    label: data.payload.label || null,
                    createdAt: Date.now()
                };
                this.lobby.drawings.push(stroke);
                if (this.lobby.drawings.length > 500) this.lobby.drawings = this.lobby.drawings.slice(-500);
                await this.saveLobby();
                this.broadcast({ type: 'drawing', payload: stroke, from: player.playerId }, ws);
                break;
            }
            case 'cursor': {
                this.broadcast({ type: 'cursor', payload: { playerId: player.playerId, x: data.payload.x, y: data.payload.y, color: player.color } }, ws);
                break;
            }
            case 'clear_drawings': {
                if (player.playerId === this.lobby.hostId) {
                    this.lobby.drawings = [];
                    await this.saveLobby();
                    this.broadcast({ type: 'clear_drawings' });
                }
                break;
            }
        }
    }

    getPublicState() {
        return {
            code: this.lobby.code, hostId: this.lobby.hostId,
            pointA: this.lobby.pointA, pointB: this.lobby.pointB,
            weapon: this.lobby.weapon,
            players: this.lobby.players, drawings: this.lobby.drawings
        };
    }

    async saveLobby() {
        await this.state.storage.put('lobby', this.lobby);
    }

    send(ws, data) { try { ws.send(JSON.stringify(data)); } catch (e) { } }
    broadcast(data, excludeWs = null) {
        const msg = JSON.stringify(data);
        for (const [ws] of this.sessions) {
            if (ws === excludeWs) continue;
            try { ws.send(msg); } catch (e) { }
        }
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        if (url.pathname === '/api/create' && request.method === 'POST') {
            const body = await request.json();
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const id = env.LOBBY.idFromName(code);
            const stub = env.LOBBY.get(id);
            const resp = await stub.fetch(new Request('http://internal/create', {
                method: 'POST', body: JSON.stringify({ ...body, code })
            }));
            return wrapCors(resp);
        }

        if (url.pathname.match(/^\/api\/lobby\/[A-Z0-9]+\/state$/)) {
            const code = url.pathname.split('/')[3];
            const id = env.LOBBY.idFromName(code);
            const stub = env.LOBBY.get(id);
            const resp = await stub.fetch(new Request('http://internal/state', { method: 'GET' }));
            return wrapCors(resp);
        }

        if (url.pathname.match(/^\/api\/lobby\/[A-Z0-9]+\/ws$/)) {
            const code = url.pathname.split('/')[3];
            const id = env.LOBBY.idFromName(code);
            const stub = env.LOBBY.get(id);
            return stub.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    }
};

export { Lobby };

function wrapCors(response) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, { status: response.status, headers: newHeaders });
}