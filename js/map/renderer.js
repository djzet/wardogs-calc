// js/map/renderer.js — Отрисовка карты

window.MapRenderer = (function (utils, tiles) {
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

    function drawLobbyDrawings(ctx, view, utils, theme, mapSize) {
        const drawings = window.AppLobby.getDrawings();
        const lobby = window.AppLobby;

        drawings.forEach(stroke => {
            if (!lobby.isPlayerVisible(stroke.playerId)) return;
            if (!stroke.points || stroke.points.length < 2) return;

            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = (stroke.width || 2) * Math.max(0.5, view.scale * 80);

            if (stroke.tool === 'eraser') {
                ctx.strokeStyle = theme.mapBg;
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.strokeStyle = stroke.color || '#fff';
                ctx.globalCompositeOperation = 'source-over';
            }

            const first = stroke.points[0];
            const s1 = utils.worldToScreen(
                utils.percentToMeters(first.x, mapSize),
                utils.percentToMeters(first.y, mapSize),
                view
            );
            ctx.moveTo(s1.x, s1.y);

            for (let i = 1; i < stroke.points.length; i++) {
                const p = stroke.points[i];
                const s = utils.worldToScreen(
                    utils.percentToMeters(p.x, mapSize),
                    utils.percentToMeters(p.y, mapSize),
                    view
                );
                ctx.lineTo(s.x, s.y);
            }
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        });
    }

    function drawLobbyCursors(ctx, view, utils, mapSize) {
        // Курсоры хранятся отдельно? Пока пропустим или добавим простую реализацию:
        // Можно хранить lastCursor в Map на клиенте, но для MVP можно без курсоров.
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
        drawDrawings(ctx, view, utils, c, MAP.size);
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

        // ─── Рисунки лобби ───
        if (window.AppLobby && window.AppLobby.isConnected()) {
            drawLobbyDrawings(ctx, view, utils, theme, MAP.size);
            drawLobbyCursors(ctx, view, utils, MAP.size);
        }

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
        drawTiles(ctx, view, c, mapSize);
        drawMinorGrid(ctx, view, c, mapSize);   // мелкие квадратики — под major
        drawGrid(ctx, view, c, mapSize);        // основная сетка
        drawCornerCoords(ctx, view, c, mapSize);
    }

    function drawDrawings(ctx, view, utils, theme, mapSize) {
        const remote = (window.AppLobby && window.AppLobby.isConnected())
            ? window.AppLobby.getDrawings() : [];
        const local = window.AppDraw ? window.AppDraw.getLocalDrawings() : [];
        const strokes = window.AppLobby && window.AppLobby.isConnected() ? remote : local;

        strokes.forEach(stroke => {
            if (stroke.playerId !== 'local' && window.AppLobby &&
                !window.AppLobby.isPlayerVisible(stroke.playerId)) return;
            drawSingleStroke(ctx, view, utils, theme, mapSize, stroke, false);
        });

        const current = window.AppDraw ? window.AppDraw.getCurrentStroke() : null;
        if (current) {
            drawSingleStroke(ctx, view, utils, theme, mapSize, current, true);
        }
    }

    function drawSingleStroke(ctx, view, utils, theme, mapSize, stroke, isPreview) {
        if (!stroke.points || stroke.points.length === 0) return;

        if (stroke.tool === 'marker') {
            const p = stroke.points[0];
            const wx = utils.percentToMeters(p.x, mapSize);
            const wy = utils.percentToMeters(p.y, mapSize);
            const s = utils.worldToScreen(wx, wy, view);
            const scale = Math.max(0.6, view.scale * 80);

            // Точка
            ctx.fillStyle = stroke.color || '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 6 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Подпись
            if (stroke.label) {
                ctx.font = `bold ${12 * scale}px sans-serif`;
                const tw = ctx.measureText(stroke.label).width;
                const pad = 4 * scale;
                const h = 18 * scale;
                const x = s.x + 10 * scale;
                const y = s.y - 10 * scale;

                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(x - pad, y - h + pad, tw + pad * 2, h);
                ctx.fillStyle = stroke.color || '#fff';
                ctx.fillText(stroke.label, x, y);
            }
            return;
        }

        ctx.beginPath();
        const first = stroke.points[0];
        const s0 = utils.worldToScreen(
            utils.percentToMeters(first.x, mapSize),
            utils.percentToMeters(first.y, mapSize),
            view
        );
        ctx.moveTo(s0.x, s0.y);

        for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            const s = utils.worldToScreen(
                utils.percentToMeters(pt.x, mapSize),
                utils.percentToMeters(pt.y, mapSize),
                view
            );
            ctx.lineTo(s.x, s.y);
        }

        if (stroke.tool === 'eraser') {
            ctx.strokeStyle = theme.mapBg;
            ctx.lineWidth = (stroke.width || 10) * Math.max(0.5, view.scale * 80);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else {
            ctx.strokeStyle = stroke.color || '#fff';
            ctx.lineWidth = (stroke.width || 2) * Math.max(0.5, view.scale * 80);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (isPreview) ctx.setLineDash([5, 5]);
        }

        ctx.stroke();
        ctx.setLineDash([]);
    }
    function getGridSteps(scale) {
        // major — основная сетка с подписями
        // minor — мелкие квадратики внутри
        if (scale > 0.15) return { major: 100, minor: 20 };
        if (scale > 0.06) return { major: 250, minor: 50 };
        if (scale > 0.025) return { major: 500, minor: 100 };
        return { major: 1000, minor: 200 };
    }
    function drawMinorGrid(ctx, view, c, mapSize) {
        const steps = getGridSteps(view.scale);
        const minor = steps.minor;
        const vb = getViewBox(view, c, mapSize);

        const startX = Math.floor(vb.left / minor) * minor;
        const endX = Math.ceil(vb.right / minor) * minor;
        const startY = Math.floor(vb.top / minor) * minor;
        const endY = Math.ceil(vb.bottom / minor) * minor;

        ctx.save();
        ctx.strokeStyle = themeColors.dim + '18'; // очень тусклые линии
        ctx.lineWidth = 0.5 * dpr;

        for (let x = startX; x <= endX; x += minor) {
            const sx = (x - vb.left) * view.scale;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, c.height);
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y += minor) {
            const sy = (y - vb.top) * view.scale;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(c.width, sy);
            ctx.stroke();
        }

        ctx.restore();
    }
    function drawGrid(ctx, view, c, mapSize) {
        const steps = getGridSteps(view.scale);
        const step = steps.major;
        const vb = getViewBox(view, c, mapSize);

        const startX = Math.floor(vb.left / step) * step;
        const endX = Math.ceil(vb.right / step) * step;
        const startY = Math.floor(vb.top / step) * step;
        const endY = Math.ceil(vb.bottom / step) * step;

        ctx.save();

        // Major линии
        ctx.strokeStyle = themeColors.dim + '55';
        ctx.lineWidth = 1 * dpr;

        for (let x = startX; x <= endX; x += step) {
            const sx = (x - vb.left) * view.scale;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, c.height);
            ctx.stroke();

            // Подпись сверху и снизу
            ctx.fillStyle = themeColors.muted;
            ctx.font = `${11 * dpr}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(formatMeters(x), sx, 3 * dpr);

            ctx.textBaseline = 'bottom';
            ctx.fillText(formatMeters(x), sx, c.height - 3 * dpr);
        }

        for (let y = startY; y <= endY; y += step) {
            const sy = (y - vb.top) * view.scale;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(c.width, sy);
            ctx.stroke();

            ctx.fillStyle = themeColors.muted;
            ctx.font = `${11 * dpr}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatMeters(y), 3 * dpr, sy);

            ctx.textAlign = 'right';
            ctx.fillText(formatMeters(y), c.width - 3 * dpr, sy);
        }

        ctx.restore();
    }
    function drawCornerCoords(ctx, view, c, mapSize) {
        const vb = getViewBox(view, c, mapSize);

        ctx.save();
        ctx.font = `bold ${13 * dpr}px monospace`;
        ctx.fillStyle = themeColors.text;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 5 * dpr;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Левый нижний угол: x=left, y=bottom
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const bl = `x${utils.gameCoord(vb.left)}   y${utils.gameCoord(vb.bottom)}`;
        ctx.fillText(bl, 14 * dpr, c.height - 14 * dpr);

        // Правый верхний угол: x=right, y=top
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const tr = `x${utils.gameCoord(vb.right)}   y${utils.gameCoord(vb.top)}`;
        ctx.fillText(tr, c.width - 14 * dpr, 14 * dpr);

        ctx.restore();
    }
    return { getThemeColors, niceStep, getTowerIconSize, draw, getGridSteps };
})(window.AppUtils, window.MapTiles);