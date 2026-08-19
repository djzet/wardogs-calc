// js/map/renderer.js — Отрисовка карты

window.MapRenderer = (function(utils, tiles) {
    const CANVAS_THEMES = {
        dark: {
            bg: '#10151b', mapBg: '#161d25',
            gridMinor: 'rgba(255, 255, 255, 0.08)',
            gridMajor: 'rgba(255, 255, 255, 0.18)',
            axes: 'rgba(255, 255, 255, 0.35)',
            dim: 'rgba(6, 8, 12, 0.55)',
            border: '#46536b', labels: '#5c6875',
            line: '#e8c35a',
        },
        light: {
            bg: '#dfe5ec', mapBg: '#f2f5f8',
            gridMinor: 'rgba(15, 25, 40, 0.10)',
            gridMajor: 'rgba(15, 25, 40, 0.22)',
            axes: 'rgba(15, 25, 40, 0.40)',
            dim: 'rgba(255, 255, 255, 0.6)',
            border: '#7d8896', labels: '#5c6875',
            line: '#8a6d00',
        },
    };

    function getThemeColors(theme) {
        return CANVAS_THEMES[theme] || CANVAS_THEMES.dark;
    }

    function niceStep(scale) {
        const raw = 70 / scale;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
        return 10 * pow;
    }

    function getTowerIconSize(scale) {
        return Math.max(16, Math.min(30, 22 * scale * 80));
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
        const padX = 8, padY = 4;
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
            if (selectedTower === p) {
                drawTowerTooltip(ctx, view, p, s, STR);
            }
        } else {
            ctx.fillStyle = '#ff9d5c';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
            ctx.fill();
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

        const step = niceStep(view.scale), minor = step / 5;
        const a = utils.screenToWorld(0, 0, view), b = utils.screenToWorld(w, h, view);
        const minX = a.x, maxX = b.x, minY = b.y, maxY = a.y;
        ctx.lineWidth = 1;

        if (minor * view.scale >= 9) {
            ctx.strokeStyle = c.gridMinor;
            ctx.beginPath();
            for (let gx = Math.ceil(minX / minor) * minor; gx <= maxX; gx += minor) {
                const s = utils.worldToScreen(gx, 0, view);
                ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
            }
            for (let gy = Math.ceil(minY / minor) * minor; gy <= maxY; gy += minor) {
                const s = utils.worldToScreen(0, gy, view);
                ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
            }
            ctx.stroke();
        }

        ctx.strokeStyle = c.gridMajor;
        ctx.beginPath();
        for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step) {
            const s = utils.worldToScreen(gx, 0, view);
            ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
        }
        for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step) {
            const s = utils.worldToScreen(0, gy, view);
            ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
        }
        ctx.stroke();

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

        ctx.fillStyle = c.labels;
        ctx.font = '11px monospace';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step)
            ctx.fillText(utils.fmtCoord(gx, step, STR), utils.worldToScreen(gx, 0, view).x + 4, h - 6);
        for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step)
            ctx.fillText(utils.fmtCoord(gy, step, STR), 4, utils.worldToScreen(0, gy, view).y - 4);

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

    return { getThemeColors, niceStep, getTowerIconSize, draw };
})(window.AppUtils, window.MapTiles);