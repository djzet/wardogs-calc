// js/map/renderer.js — Отрисовка карты

window.MapRenderer = (function (utils, tiles) {
    const CANVAS_THEMES = {
        dark: {
            bg: '#10151b', mapBg: '#161d25',
            gridMinor: 'rgba(255, 255, 255, 0.07)',
            gridMajor: 'rgba(255, 255, 255, 0.18)',
            axes: 'rgba(255, 255, 255, 0.35)',
            dim: 'rgba(6, 8, 12, 0.55)',
            border: '#46536b', labels: '#5c6875',
            line: '#e8c35a',
        },
        light: {
            bg: '#dfe5ec', mapBg: '#f2f5f8',
            gridMinor: 'rgba(15, 25, 40, 0.08)',
            gridMajor: 'rgba(15, 25, 40, 0.22)',
            axes: 'rgba(15, 25, 40, 0.40)',
            dim: 'rgba(255, 255, 255, 0.6)',
            border: '#7d8896', labels: '#5c6875',
            line: '#8a6d00',
        },
    };
    function getThemeColors(theme) { return CANVAS_THEMES[theme] || CANVAS_THEMES.dark; }
    function getTowerIconSize(scale) {
        return Math.max(16, Math.min(30, 22 * scale * 80));
    }
    function getViewBox(view, w, h, mapSize) {
        const a = utils.screenToWorld(0, 0, view);
        const b = utils.screenToWorld(w, h, view);
        return {
            left: Math.max(0, Math.min(a.x, b.x)),
            right: Math.min(mapSize, Math.max(a.x, b.x)),
            top: Math.max(0, Math.min(a.y, b.y)),
            bottom: Math.min(mapSize, Math.max(a.y, b.y))
        };
    }
    function getGridSteps(scale) {
        if (scale > 0.15) return { major: 100, minor: 20 };
        if (scale > 0.06) return { major: 250, minor: 50 };
        if (scale > 0.025) return { major: 500, minor: 100 };
        return { major: 1000, minor: 200 };
    }
    function drawPoint(ctx, view, p, color, label) {
        const s = utils.worldToScreen(p.x, p.y, view);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, s.x + 11, s.y - 9);
    }
    function drawTowerTooltip(ctx, view, p, s, STR) {
        const label = STR[p.name] || p.name;
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(label).width;
        const padX = 8;
        const w = textWidth + padX * 2;
        const h = 22;
        const x = s.x - w / 2;
        const y = s.y - getTowerIconSize(view.scale) / 2 - 28;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + 2, y + 2, w, h);
        ctx.fillStyle = '#1a1f27';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#9fd356';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.beginPath();
        ctx.moveTo(s.x - 6, y + h);
        ctx.lineTo(s.x + 6, y + h);
        ctx.lineTo(s.x, y + h + 6);
        ctx.closePath();
        ctx.fillStyle = '#1a1f27';
        ctx.fill();
        ctx.strokeStyle = '#9fd356';
        ctx.stroke();
        ctx.fillStyle = '#e6e6e6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, s.x, y + h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }
    function drawTower(ctx, view, p, towerIcon, selectedTower, STR, mapSize) {
        const wx = utils.percentToMeters(p.x, mapSize);
        const wy = utils.percentToMeters(p.y, mapSize);
        const s = utils.worldToScreen(wx, wy, view);
        const iconSize = getTowerIconSize(view.scale);
        if (towerIcon.complete && towerIcon.naturalWidth > 0) {
            ctx.drawImage(towerIcon, s.x - iconSize / 2, s.y - iconSize / 2, iconSize, iconSize);
            if (selectedTower === p) drawTowerTooltip(ctx, view, p, s, STR);
        } else {
            ctx.fillStyle = '#ff9d5c';
            ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawRangeCircle(ctx, view, pointA, weapon, STR) {
        if (!pointA) return;
        if (!weapon || !weapon.maxRangeKm) return;
        const maxRangeMeters = weapon.maxRangeKm * 1000;
        const sa = utils.worldToScreen(pointA.x, pointA.y, view);
        const radiusPx = maxRangeMeters * view.scale;
        const color = weapon.rangeColor || '#9fd356';
        ctx.beginPath();
        ctx.arc(sa.x, sa.y, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = color + '14';
        ctx.fill();
        ctx.strokeStyle = color + '99';
        ctx.setLineDash([10, 6]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        const label = weapon.maxRangeKm < 1
            ? Math.round(weapon.maxRangeKm * 1000) + utils.NBSP + STR.u_m
            : weapon.maxRangeKm.toFixed(1) + utils.NBSP + STR.u_km;
        ctx.fillStyle = color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, sa.x, sa.y - radiusPx - 4);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }
    function drawMarker(ctx, s, stroke) {
        const color = stroke.color || '#fff';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 6, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 2);
        ctx.lineTo(s.x, s.y + 6);
        ctx.lineTo(s.x + 3, s.y - 2);
        ctx.stroke();
        if (stroke.label) {
            ctx.font = 'bold 11px sans-serif';
            const tw = ctx.measureText(stroke.label).width;
            const x = s.x + 9, y = s.y - 12;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(x - 3, y - 8, tw + 6, 15);
            ctx.fillStyle = color;
            ctx.textAlign = 'start';
            ctx.textBaseline = 'middle';
            ctx.fillText(stroke.label, x, y);
            ctx.textBaseline = 'alphabetic';
        }
    }
    function drawRuler(ctx, view, mapSize, stroke, STR) {
        const a = stroke.points[0];
        const b = stroke.points[stroke.points.length - 1];
        const sa = utils.worldToScreen(utils.percentToMeters(a.x, mapSize), utils.percentToMeters(a.y, mapSize), view);
        const sb = utils.worldToScreen(utils.percentToMeters(b.x, mapSize), utils.percentToMeters(b.y, mapSize), view);
        const color = stroke.color || '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, stroke.width || 1);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        [sa, sb].forEach(s => {
            ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill();
        });
        if (STR) {
            const d = Math.hypot(
                utils.percentToMeters(b.x, mapSize) - utils.percentToMeters(a.x, mapSize),
                utils.percentToMeters(b.y, mapSize) - utils.percentToMeters(a.y, mapSize)
            );
            const label = utils.fmtDist(d, STR);
            const mx = (sa.x + sb.x) / 2;
            const my = Math.min(sa.y, sb.y) - 10;
            ctx.font = '11px monospace';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(mx - tw / 2 - 4, my - 12, tw + 8, 15);
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, mx, my - 4);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
    }
    function drawPen(ctx, view, mapSize, stroke, isPreview) {
        ctx.beginPath();
        const first = stroke.points[0];
        const s0 = utils.worldToScreen(utils.percentToMeters(first.x, mapSize), utils.percentToMeters(first.y, mapSize), view);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            const s = utils.worldToScreen(utils.percentToMeters(pt.x, mapSize), utils.percentToMeters(pt.y, mapSize), view);
            ctx.lineTo(s.x, s.y);
        }
        ctx.strokeStyle = stroke.color || '#fff';
        ctx.lineWidth = Math.max(1, stroke.width || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (isPreview) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    function drawSingleStroke(ctx, view, mapSize, stroke, isPreview, STR) {
        if (!stroke.points || stroke.points.length === 0) return;
        if (stroke.tool === 'marker') {
            const p = stroke.points[0];
            const s = utils.worldToScreen(utils.percentToMeters(p.x, mapSize), utils.percentToMeters(p.y, mapSize), view);
            drawMarker(ctx, s, stroke);
            return;
        }
        if (stroke.tool === 'line') {
            if (stroke.points.length >= 2) drawRuler(ctx, view, mapSize, stroke, STR);
            return;
        }
        drawPen(ctx, view, mapSize, stroke, isPreview);
    }
    function drawDrawings(ctx, view, mapSize, STR) {
        const connected = window.AppLobby && window.AppLobby.isConnected();
        const remote = connected ? window.AppLobby.getDrawings() : [];
        const local = window.AppDraw ? window.AppDraw.getLocalDrawings() : [];
        const strokes = connected ? remote : local;
        strokes.forEach(stroke => {
            if (stroke.playerId !== 'local' && window.AppLobby &&
                !window.AppLobby.isPlayerVisible(stroke.playerId)) return;
            drawSingleStroke(ctx, view, mapSize, stroke, false, STR);
        });
        const current = window.AppDraw ? window.AppDraw.getCurrentStroke() : null;
        if (current) drawSingleStroke(ctx, view, mapSize, current, true, STR);
    }
    function drawMinorGrid(ctx, view, c, w, h, mapSize) {
        const steps = getGridSteps(view.scale);
        const minor = steps.minor;
        if (minor * view.scale < 4) return;
        const vb = getViewBox(view, w, h, mapSize);
        const startX = Math.floor(vb.left / minor) * minor;
        const endX = Math.ceil(vb.right / minor) * minor;
        const startY = Math.floor(vb.top / minor) * minor;
        const endY = Math.ceil(vb.bottom / minor) * minor;
        ctx.strokeStyle = c.gridMinor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += minor) {
            const sx = utils.worldToScreen(x, 0, view).x;
            ctx.moveTo(Math.round(sx) + .5, 0);
            ctx.lineTo(Math.round(sx) + .5, h);
        }
        for (let y = startY; y <= endY; y += minor) {
            const sy = utils.worldToScreen(0, y, view).y;
            ctx.moveTo(0, Math.round(sy) + .5);
            ctx.lineTo(w, Math.round(sy) + .5);
        }
        ctx.stroke();
    }
    function drawGrid(ctx, view, c, w, h, mapSize, STR) {
        const steps = getGridSteps(view.scale);
        const step = steps.major;
        const vb = getViewBox(view, w, h, mapSize);
        const startX = Math.floor(vb.left / step) * step;
        const endX = Math.ceil(vb.right / step) * step;
        const startY = Math.floor(vb.top / step) * step;
        const endY = Math.ceil(vb.bottom / step) * step;
        ctx.strokeStyle = c.gridMajor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            const sx = utils.worldToScreen(x, 0, view).x;
            ctx.moveTo(Math.round(sx) + .5, 0);
            ctx.lineTo(Math.round(sx) + .5, h);
        }
        for (let y = startY; y <= endY; y += step) {
            const sy = utils.worldToScreen(0, y, view).y;
            ctx.moveTo(0, Math.round(sy) + .5);
            ctx.lineTo(w, Math.round(sy) + .5);
        }
        ctx.stroke();
        ctx.fillStyle = c.labels;
        ctx.font = '10px monospace';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        for (let x = startX; x <= endX; x += step) {
            const sx = utils.worldToScreen(x, 0, view).x;
            ctx.fillText(utils.fmtCoord(x, step, STR), sx + 3, h - 4);
        }
        for (let y = startY; y <= endY; y += step) {
            const sy = utils.worldToScreen(0, y, view).y;
            ctx.fillText(utils.fmtCoord(y, step, STR), 4, sy - 3);
        }
    }
    function draw(ctx, canvas, opts) {
        const { view, MAP, ZONE, TOWERS, WEAPONS, currentWeapon,
            pointA, pointB, theme, showTowers, selectedTower,
            STR, towerIcon, TILES, onTileLoaded } = opts;
        const c = getThemeColors(theme);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, w, h);
        const m0 = utils.worldToScreen(0, 0, view);
        const m1 = utils.worldToScreen(MAP.size, MAP.size, view);
        ctx.fillStyle = c.mapBg;
        ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
        tiles.drawTiles(ctx, canvas, view, MAP, TILES, c, onTileLoaded);
        drawMinorGrid(ctx, view, c, w, h, MAP.size);
        drawGrid(ctx, view, c, w, h, MAP.size, STR);
        ctx.strokeStyle = c.axes;
        ctx.beginPath();
        const zero = utils.worldToScreen(0, 0, view);
        ctx.moveTo(zero.x + .5, 0); ctx.lineTo(zero.x + .5, h);
        ctx.moveTo(0, zero.y + .5); ctx.lineTo(w, zero.y + .5);
        ctx.stroke();
        ctx.fillStyle = c.dim;
        ctx.fillRect(0, 0, w, m1.y);
        ctx.fillRect(0, m0.y, w, h - m0.y);
        ctx.fillRect(0, m1.y, m0.x, m0.y - m1.y);
        ctx.fillRect(m1.x, m1.y, w - m1.x, m0.y - m1.y);
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
        ctx.lineWidth = 1;
        const zc = utils.worldToScreen(ZONE.cx, ZONE.cy, view);
        ctx.beginPath();
        ctx.arc(zc.x, zc.y, ZONE.r * view.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(159, 211, 86, 0.05)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(124, 180, 60, 0.55)';
        ctx.setLineDash([10, 6]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        if (showTowers) TOWERS.forEach(p => drawTower(ctx, view, p, towerIcon, selectedTower, STR, MAP.size));
        drawDrawings(ctx, view, MAP.size, STR);
        if (pointA && pointB) {
            const sa = utils.worldToScreen(pointA.x, pointA.y, view);
            const sb = utils.worldToScreen(pointB.x, pointB.y, view);
            ctx.strokeStyle = c.line;
            ctx.setLineDash([6, 6]);
            ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
            ctx.setLineDash([]);
            const d = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
            ctx.fillStyle = c.line;
            ctx.font = '12px monospace';
            ctx.fillText(utils.fmtDist(d, STR), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
        }
        drawRangeCircle(ctx, view, pointA, WEAPONS[currentWeapon], STR);
        if (pointA) drawPoint(ctx, view, pointA, '#7bc95e', 'A');
        if (pointB) drawPoint(ctx, view, pointB, '#e05656', 'B');
    }
    return { getThemeColors, getTowerIconSize, draw, getGridSteps };
})(window.AppUtils, window.MapTiles);