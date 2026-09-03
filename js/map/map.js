window.MapTiles = (function () {
    const tileCache = new Map();
    let cacheMax = 500;
    function configure(max) {
        cacheMax = max;
    }

    function clearCache() {
        tileCache.forEach((t) => {
            if (t && t.img) {
                t.img.src = '';
                t.img.onload = null;
                t.img.onerror = null;
            }
        });
        tileCache.clear();
    }

    function getTile(z, x, y, tilesConfig, onLoaded) {
        const mapId = tilesConfig.mapId || 'default';
        const key = `${mapId}/${z}/${x}_${y}`;
        let t = tileCache.get(key);
        if (t) {
            tileCache.delete(key);
            tileCache.set(key, t);
            return t;
        }
        const img = new Image();
        t = { img, loaded: false, error: false };
        img.onload = () => {
            t.loaded = true;
            onLoaded && onLoaded();
        };
        img.onerror = () => { t.error = true; };
        const rel = tilesConfig.path(z, x, y);
        img.src = (window.AppUtils && window.AppUtils.assetUrl) ? window.AppUtils.assetUrl(rel) : rel;
        tileCache.set(key, t);
        if (tileCache.size > cacheMax) {
            const oldestKey = tileCache.keys().next().value;
            const oldest = tileCache.get(oldestKey);
            if (oldest && oldest.img) {
                oldest.img.src = '';
                oldest.img.onload = null;
                oldest.img.onerror = null;
            }
            tileCache.delete(oldestKey);
        }
        return t;
    }

    function getTileZoom(tilesConfig, tileBounds, viewScale) {
        const tileWorldWidth = tileBounds.maxX - tileBounds.minX;
        if (!tileWorldWidth || tileWorldWidth <= 0) return 0;
        const basePixelsPerWorldUnit = tilesConfig.tileSize / tileWorldWidth;
        const raw = Math.log2(viewScale / basePixelsPerWorldUnit);
        return Math.max(
            tilesConfig.minZoom || 0,
            Math.min(tilesConfig.maxZoom || 7, Math.round(raw))
        );
    }

    function drawTiles(ctx, canvas, view, mapConfig, tilesConfig, themeColors, onTileLoaded) {
        const tileBounds = mapConfig.tileBounds;
        if (!tileBounds || !tilesConfig) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const utils = window.AppUtils;
        const zoom = getTileZoom(tilesConfig, tileBounds, view.scale);
        const tileCount = Math.pow(2, zoom);
        const tileWorldWidth = (tileBounds.maxX - tileBounds.minX) / tileCount;
        const tileWorldHeight = (tileBounds.maxY - tileBounds.minY) / tileCount;
        const tileScreenWidth = tileWorldWidth * view.scale;
        const tileScreenHeight = tileWorldHeight * view.scale;

        const topLeft = utils.screenToWorld(0, 0, view);
        const bottomRight = utils.screenToWorld(w, h, view);
        const visibleLeft = Math.min(topLeft.x, bottomRight.x);
        const visibleRight = Math.max(topLeft.x, bottomRight.x);
        const visibleBottom = Math.min(topLeft.y, bottomRight.y);
        const visibleTop = Math.max(topLeft.y, bottomRight.y);

        const worldLeft = Math.max(tileBounds.minX, visibleLeft);
        const worldRight = Math.min(tileBounds.maxX, visibleRight);
        const worldBottom = Math.max(tileBounds.minY, visibleBottom);
        const worldTop = Math.min(tileBounds.maxY, visibleTop);
        if (worldLeft >= worldRight || worldBottom >= worldTop) return;
        const minTileX = Math.max(0, Math.floor((worldLeft - tileBounds.minX) / tileWorldWidth));
        const maxTileX = Math.min(tileCount - 1, Math.floor((worldRight - tileBounds.minX) / tileWorldWidth));
        const minTileY = Math.max(0, Math.floor((tileBounds.maxY - worldTop) / tileWorldHeight));
        const maxTileY = Math.min(tileCount - 1, Math.floor((tileBounds.maxY - worldBottom) / tileWorldHeight));
        for (let ty = minTileY; ty <= maxTileY; ty++) {
            const tileWorldTop = tileBounds.maxY - ty * tileWorldHeight;
            for (let tx = minTileX; tx <= maxTileX; tx++) {
                const tileWorldLeft = tileBounds.minX + tx * tileWorldWidth;
                const s = utils.worldToScreen(tileWorldLeft, tileWorldTop, view);
                const t = getTile(zoom, tx, ty, tilesConfig, onTileLoaded);
                if (t.loaded) {
                    ctx.drawImage(t.img, s.x, s.y, tileScreenWidth + 0.5, tileScreenHeight + 0.5);
                } else if (!t.error) {
                    ctx.fillStyle = themeColors.mapBg;
                    ctx.fillRect(s.x, s.y, tileScreenWidth, tileScreenHeight);
                }
            }
        }
    }
    return { configure, clearCache, getTile, drawTiles };
})();

window.MapRenderer = (function (utils, tiles) {
    function getThemeColors() {
        const r = getComputedStyle(document.body);
        return {
            bg:       r.getPropertyValue('--canvas-bg').trim(),
            mapBg:    r.getPropertyValue('--canvas-map-bg').trim(),
            gridMinor: r.getPropertyValue('--canvas-grid-minor').trim(),
            gridMajor: r.getPropertyValue('--canvas-grid-major').trim(),
            axes:     r.getPropertyValue('--canvas-axes').trim(),
            dim:      r.getPropertyValue('--canvas-dim').trim(),
            border:   r.getPropertyValue('--canvas-border').trim(),
            labels:   r.getPropertyValue('--canvas-labels').trim(),
            line:     r.getPropertyValue('--canvas-line').trim(),
        };
    }

    function getTowerIconSize(scale) {
        return Math.max(16, Math.min(30, 22 * scale * 80));
    }

    function getViewBox(view, w, h, bounds) {
        const a = utils.screenToWorld(0, 0, view);
        const b = utils.screenToWorld(w, h, view);
        return {
            left: Math.max(bounds.minX, Math.min(a.x, b.x)),
            right: Math.min(bounds.maxX, Math.max(a.x, b.x)),
            top: Math.max(bounds.minY, Math.min(a.y, b.y)),
            bottom: Math.min(bounds.maxY, Math.max(a.y, b.y))
        };
    }

    function getGridSteps(scale, coordScale) {
        const mpu = coordScale || 100;
        if (mpu === 100) {
            return { major: 10, minor: 1 };
        }
        return { major: 1, minor: 0.1 };
    }

    function drawPoint(ctx, view, p, color, label) {
        const s = utils.worldToScreen(p.x, p.y, view);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, s.x + 11, s.y - 9);
    }

    function drawTowerTooltip(ctx, view, p, s, STR, themeColors) {
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
        ctx.fillStyle = themeColors.mapBg || '#1a1f27';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = themeColors.border || '#9fd356';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.beginPath();
        ctx.moveTo(s.x - 6, y + h);
        ctx.lineTo(s.x + 6, y + h);
        ctx.lineTo(s.x, y + h + 6);
        ctx.closePath();
        ctx.fillStyle = themeColors.mapBg || '#1a1f27';
        ctx.fill();
        ctx.strokeStyle = themeColors.border || '#9fd356';
        ctx.stroke();
        ctx.fillStyle = themeColors.labels || '#e6e6e6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, s.x, y + h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    function drawTower(ctx, view, p, towerIcon, selectedTower, STR, themeColors, idx) {
        const cached = window.MapSpatial && window.MapSpatial.getTowerScreenPos(idx);
        const s = cached || utils.worldToScreen(p.x, p.y, view);
        const iconSize = getTowerIconSize(view.scale);
        if (towerIcon.complete && towerIcon.naturalWidth > 0) {
            ctx.drawImage(towerIcon, s.x - iconSize / 2, s.y - iconSize / 2, iconSize, iconSize);
            if (selectedTower === p) drawTowerTooltip(ctx, view, p, s, STR, themeColors);
        } else {
            ctx.fillStyle = '#ff9d5c';
            ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        }
    }

    function hexToRgba(hex, a) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    function drawRangeCircle(ctx, view, pointA, weapon, coordScale, STR) {
        if (!pointA) return;
        if (!weapon || !weapon.maxRangeKm) return;
        const cs = coordScale || 100;
        const maxRangeGameUnits = (weapon.maxRangeKm * 1000) / cs;
        const sa = utils.worldToScreen(pointA.x, pointA.y, view);
        const radiusPx = maxRangeGameUnits * view.scale;
        const color = weapon.rangeColor || '#9fd356';
        ctx.beginPath();
        ctx.arc(sa.x, sa.y, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.08);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, 0.6);
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

    function drawRuler(ctx, view, worldSize, stroke, STR, coordScale) {
        const a = stroke.points[0];
        const b = stroke.points[stroke.points.length - 1];
        const sa = utils.worldToScreen(utils.percentToWorld(a.x, worldSize), utils.percentToWorld(a.y, worldSize), view);
        const sb = utils.worldToScreen(utils.percentToWorld(b.x, worldSize), utils.percentToWorld(b.y, worldSize), view);
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
            const wx0 = utils.percentToWorld(a.x, worldSize);
            const wy0 = utils.percentToWorld(a.y, worldSize);
            const wx1 = utils.percentToWorld(b.x, worldSize);
            const wy1 = utils.percentToWorld(b.y, worldSize);
            const cs = (coordScale || 100);
            const d = Math.hypot(wx1 - wx0, wy1 - wy0) * cs;
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

    function drawPen(ctx, view, worldSize, stroke, isPreview) {
        ctx.beginPath();
        const first = stroke.points[0];
        const s0 = utils.worldToScreen(utils.percentToWorld(first.x, worldSize), utils.percentToWorld(first.y, worldSize), view);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            const s = utils.worldToScreen(utils.percentToWorld(pt.x, worldSize), utils.percentToWorld(pt.y, worldSize), view);
            ctx.lineTo(s.x, s.y);
        }
        ctx.strokeStyle = stroke.color || '#fff';
        ctx.lineWidth = Math.max(1, stroke.width || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (isPreview) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    }

    function drawSingleStroke(ctx, view, worldSize, stroke, isPreview, STR, coordScale) {
        if (!stroke.points || stroke.points.length === 0) return;
        if (stroke.tool === 'marker') {
            const p = stroke.points[0];
            const s = utils.worldToScreen(utils.percentToWorld(p.x, worldSize), utils.percentToWorld(p.y, worldSize), view);
            drawMarker(ctx, s, stroke);
            return;
        }
        if (stroke.tool === 'line') {
            if (stroke.points.length >= 2) drawRuler(ctx, view, worldSize, stroke, STR, coordScale);
            return;
        }
        drawPen(ctx, view, worldSize, stroke, isPreview);
    }

    function drawDrawings(ctx, view, worldSize, STR, coordScale) {
        const local = window.AppDraw ? window.AppDraw.getLocalDrawings() : [];
        local.forEach(stroke => {
            drawSingleStroke(ctx, view, worldSize, stroke, false, STR, coordScale);
        });
        const current = window.AppDraw ? window.AppDraw.getCurrentStroke() : null;
        if (current) drawSingleStroke(ctx, view, worldSize, current, true, STR, coordScale);
    }

    function drawMinorGrid(ctx, view, c, w, h, bounds, coordScale) {
        const steps = getGridSteps(view.scale, coordScale);
        const minor = steps.minor;
        if (minor * view.scale < 4) return;
        const vb = getViewBox(view, w, h, bounds);
        const m0 = utils.worldToScreen(bounds.minX, bounds.minY, view);
        const m1 = utils.worldToScreen(bounds.maxX, bounds.maxY, view);
        const mapL = Math.min(m0.x, m1.x), mapR = Math.max(m0.x, m1.x);
        const mapT = Math.min(m0.y, m1.y), mapB = Math.max(m0.y, m1.y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(mapL, mapT, mapR - mapL, mapB - mapT);
        ctx.clip();
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
        ctx.restore();
    }

    function drawGrid(ctx, view, c, w, h, bounds, coordScale, _STR) {
        const steps = getGridSteps(view.scale, coordScale);
        const step = steps.major;
        const vb = getViewBox(view, w, h, bounds);
        const m0 = utils.worldToScreen(bounds.minX, bounds.minY, view);
        const m1 = utils.worldToScreen(bounds.maxX, bounds.maxY, view);
        const mapL = Math.min(m0.x, m1.x), mapR = Math.max(m0.x, m1.x);
        const mapT = Math.min(m0.y, m1.y), mapB = Math.max(m0.y, m1.y);
        const startX = Math.floor(vb.left / step) * step;
        const endX = Math.ceil(vb.right / step) * step;
        const startY = Math.floor(vb.top / step) * step;
        const endY = Math.ceil(vb.bottom / step) * step;
        ctx.save();
        ctx.beginPath();
        ctx.rect(mapL, mapT, mapR - mapL, mapB - mapT);
        ctx.clip();
        ctx.strokeStyle = c.gridMajor;
        ctx.lineWidth = 1.5;
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
        ctx.restore();
        ctx.font = '10px monospace';
        const precision = (coordScale || 100) === 100 ? 2 : 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = startX; x <= endX; x += step) {
            const sx = utils.worldToScreen(x, 0, view).x;
            if (sx < mapL - 1 || sx > mapR + 1) continue;
            const label = x.toFixed(precision);
            const ly = mapB + 5;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(sx - tw / 2 - 3, ly - 1, tw + 6, 13);
            ctx.fillStyle = c.labels;
            ctx.fillText(label, sx, ly);
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = startY; y <= endY; y += step) {
            const sy = utils.worldToScreen(0, y, view).y;
            if (sy < mapT - 1 || sy > mapB + 1) continue;
            const label = y.toFixed(precision);
            const lx = mapL - 6;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(lx - tw - 5, sy - 7, tw + 7, 14);
            ctx.fillStyle = c.labels;
            ctx.fillText(label, lx, sy);
        }
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    let _staticCanvas = null;
    let _staticCtx = null;
    let _staticCssW = 0;
    let _staticCssH = 0;
    let _staticDpr = 0;

    function ensureStaticCanvas(cssW, cssH) {
        const dpr = window.devicePixelRatio || 1;
        if (_staticCanvas && _staticCssW === cssW && _staticCssH === cssH && _staticDpr === dpr) return;
        _staticCanvas = document.createElement('canvas');
        _staticCssW = cssW;
        _staticCssH = cssH;
        _staticDpr = dpr;
        _staticCanvas.width = Math.round(cssW * dpr);
        _staticCanvas.height = Math.round(cssH * dpr);
        _staticCtx = _staticCanvas.getContext('2d');
        _staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let _ovDirty = true;
    let _ovScale = 0, _ovOx = 0, _ovOy = 0;
    let _ovW = 0, _ovH = 0;
    let _ovBoundsKey = '', _ovTilesId = '', _ovLocale = '', _ovBg = '';

    function invalidateBgCache() { _ovDirty = true; }
    function compositeStatic(ctx) {
        if (!_staticCanvas) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(_staticCanvas, 0, 0);
        ctx.restore();
    }
    
    function drawBgAndMap(ctx, view, bounds, w, h, c) {
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, w, h);
        const m0 = utils.worldToScreen(bounds.minX, bounds.minY, view);
        const m1 = utils.worldToScreen(bounds.maxX, bounds.maxY, view);
        const mapL = Math.min(m0.x, m1.x), mapR = Math.max(m0.x, m1.x);
        const mapT = Math.min(m0.y, m1.y), mapB = Math.max(m0.y, m1.y);
        ctx.fillStyle = c.mapBg;
        ctx.fillRect(mapL, mapT, mapR - mapL, mapB - mapT);
    }

    function draw(ctx, canvas, opts) {
        const { view, MAP, ZONE, TOWERS, WEAPONS, currentWeapon,
            pointA, pointB, showTowers, selectedTower,
            STR, towerIcon, TILES, coordScale, onTileLoaded } = opts;
        const c = getThemeColors();
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const bounds = MAP.bounds;
        ensureStaticCanvas(w, h);
        drawBgAndMap(ctx, view, bounds, w, h, c);
        tiles.drawTiles(ctx, canvas, view, MAP, TILES, c, onTileLoaded);
        const locale = document.documentElement.lang || '';
        const boundsKey = `${bounds.minX},${bounds.maxX},${bounds.minY},${bounds.maxY}`;
        const ovStale = _ovDirty
            || view.scale !== _ovScale || view.ox !== _ovOx || view.oy !== _ovOy
            || w !== _ovW || h !== _ovH
            || boundsKey !== _ovBoundsKey || TILES.mapId !== _ovTilesId
            || locale !== _ovLocale || c.bg !== _ovBg;
        if (ovStale) {
            const sctx = _staticCtx;
            sctx.clearRect(0, 0, w, h);
            drawMinorGrid(sctx, view, c, w, h, bounds, coordScale);
            drawGrid(sctx, view, c, w, h, bounds, coordScale, STR);
            sctx.strokeStyle = c.axes;
            sctx.beginPath();
            const zero = utils.worldToScreen(0, 0, view);
            sctx.moveTo(zero.x + .5, 0); sctx.lineTo(zero.x + .5, h);
            sctx.moveTo(0, zero.y + .5); sctx.lineTo(w, zero.y + .5);
            sctx.stroke();

            const m0 = utils.worldToScreen(bounds.minX, bounds.minY, view);
            const m1 = utils.worldToScreen(bounds.maxX, bounds.maxY, view);
            const mapL = Math.min(m0.x, m1.x), mapR = Math.max(m0.x, m1.x);
            const mapT = Math.min(m0.y, m1.y), mapB = Math.max(m0.y, m1.y);
            sctx.fillStyle = c.dim;
            sctx.fillRect(0, 0, w, mapT);
            sctx.fillRect(0, mapB, w, h - mapB);
            sctx.fillRect(0, mapT, mapL, mapB - mapT);
            sctx.fillRect(mapR, mapT, w - mapR, mapB - mapT);
            sctx.strokeStyle = c.border;
            sctx.lineWidth = 1.5;
            sctx.strokeRect(mapL, mapT, mapR - mapL, mapB - mapT);
            sctx.lineWidth = 1;

            if (ZONE && ZONE.r > 0) {
                const zc = utils.worldToScreen(ZONE.cx, ZONE.cy, view);
                const cs = coordScale || 100;
                const radiusPx = (ZONE.r / cs) * view.scale;
                sctx.beginPath();
                sctx.arc(zc.x, zc.y, radiusPx, 0, Math.PI * 2);
                sctx.fillStyle = 'rgba(159, 211, 86, 0.05)';
                sctx.fill();
                sctx.strokeStyle = 'rgba(124, 180, 60, 0.55)';
                sctx.setLineDash([10, 6]);
                sctx.lineWidth = 1.5;
                sctx.stroke();
                sctx.setLineDash([]);
                sctx.lineWidth = 1;
            }

            if (showTowers) TOWERS.forEach((p, i) => drawTower(sctx, view, p, towerIcon, selectedTower, STR, c, i));
            drawDrawings(sctx, view, MAP.worldSize, STR, coordScale);

            if (pointA && pointB) {
                const sa = utils.worldToScreen(pointA.x, pointA.y, view);
                const sb = utils.worldToScreen(pointB.x, pointB.y, view);
                sctx.strokeStyle = c.line;
                sctx.lineWidth = 1;
                sctx.lineCap = 'butt';
                sctx.setLineDash([6, 6]);
                sctx.beginPath(); sctx.moveTo(sa.x, sa.y); sctx.lineTo(sb.x, sb.y); sctx.stroke();
                sctx.setLineDash([]);
                const cs = coordScale || 100;
                const d = Math.hypot((pointB.x - pointA.x) * cs, (pointB.y - pointA.y) * cs);
                sctx.fillStyle = c.line;
                sctx.font = '12px monospace';
                sctx.fillText(utils.fmtDist(d, STR), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
            }
            drawRangeCircle(sctx, view, pointA, WEAPONS[currentWeapon], coordScale, STR);
            if (pointA) drawPoint(sctx, view, pointA, '#7bc95e', 'A');
            if (pointB) drawPoint(sctx, view, pointB, '#e05656', 'B');
            _ovDirty = false;
            _ovScale = view.scale; _ovOx = view.ox; _ovOy = view.oy;
            _ovW = w; _ovH = h;
            _ovBoundsKey = boundsKey; _ovTilesId = TILES.mapId;
            _ovLocale = locale; _ovBg = c.bg;
        }
        compositeStatic(ctx);
    }

    function drawComposite(ctx, canvas, opts) {
        const { view, MAP, TILES, onTileLoaded } = opts;
        const c = getThemeColors();
        const w = canvas.clientWidth, h = canvas.clientHeight;
        drawBgAndMap(ctx, view, MAP.bounds, w, h, c);
        tiles.drawTiles(ctx, canvas, view, MAP, TILES, c, onTileLoaded);
        compositeStatic(ctx);
    }
    return { getTowerIconSize, draw, drawComposite, invalidateBgCache };
})(window.AppUtils, window.MapTiles);

window.MapInteractions = (function () {
    const MIN_SCALE = 0.005;
    const MAX_SCALE = 4;
    const pointers = new Map();
    let pinch = null;
    let longPressTimer = null;
    let longPressFired = false;
    let lastTouchTs = 0;
    let dragging = null;
    let _cursorCoords = null;
    let _cxSpan = null;
    let _cySpan = null;
    let _wrapRect = null;
    let _canvasRect = null;
    function ensureTooltipCache() {
        if (_cursorCoords) return;
        _cursorCoords = document.getElementById('cursorCoords');
        if (!_cursorCoords) return;
        _cxSpan = document.createElement('span');
        _cySpan = document.createElement('span');
        _cursorCoords.appendChild(_cxSpan);
        _cursorCoords.appendChild(_cySpan);
    }
    function invalidateWrapRect() { _wrapRect = null; invalidateCanvasRect(); }
    function getWrapRect(canvas) {
        if (!_wrapRect) _wrapRect = canvas.parentElement.getBoundingClientRect();
        return _wrapRect;
    }
    function invalidateCanvasRect() { _canvasRect = null; }
    function canvasPos(e, canvas) {
        if (!_canvasRect) _canvasRect = canvas.getBoundingClientRect();
        const r = _canvasRect;
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function stopLongPress() { clearTimeout(longPressTimer); }
    function startLongPress(sx, sy, delay, callback) {
        clearTimeout(longPressTimer);
        longPressFired = false;
        longPressTimer = setTimeout(() => {
            longPressFired = true;
            dragging = null;
            callback(sx, sy);
        }, delay);
    }

    function handlePointerDown(e, canvas, opts) {
        const { view, hitPoint, findTowerAt, openMenuAt, hideMenu, LONG_PRESS_MS, utils, worldSize, renderMap } = opts;
        const p = canvasPos(e, canvas);
        if (e.pointerType !== 'mouse') lastTouchTs = performance.now();
        try { canvas.setPointerCapture(e.pointerId); } catch { }
        pointers.set(e.pointerId, p);
        if (e.button === 1) {
            e.preventDefault();
            stopLongPress();
            if (window.AppDraw) window.AppDraw.cancelStroke();
            dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;
        if (typeof hideMenu === 'function') hideMenu();
        if (pointers.size === 2) {
            stopLongPress();
            dragging = null;
            const _it = pointers.values();
            const p1 = _it.next().value;
            const p2 = _it.next().value;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            pinch = {
                dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
                scale: view.scale,
                anchor: utils.screenToWorld(mid.x, mid.y, view),
            };
            return;
        }

        if (pointers.size > 2) return;
        if (e.pointerType !== 'mouse') {
            startLongPress(p.x, p.y, LONG_PRESS_MS, (sx, sy) => {
                openMenuAt(sx, sy);
            });
        }

        const hit = hitPoint(p.x, p.y);
        if (hit) {
            stopLongPress();
            dragging = { mode: 'point', key: hit };
            canvas.style.cursor = 'grabbing';
            return;
        }

        const towerHit = findTowerAt(p.x, p.y);
        if (towerHit) {
            dragging = { mode: 'tower-or-pan', tower: towerHit, startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            return;
        }

        const drawTool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
        if (drawTool === 'eraser') {
            stopLongPress();
            dragging = { mode: 'erase' };
            if (window.AppDraw.eraseAt(p.x, p.y, view)) renderMap();
            canvas.style.cursor = 'cell';
            return;
        }

        if (drawTool !== 'pan') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.worldToPercent(wpt.x, worldSize);
            const py = utils.worldToPercent(wpt.y, worldSize);
            window.AppDraw.startStroke(px, py);
            dragging = { mode: 'draw' };
            if (renderMap) renderMap();
            canvas.style.cursor = 'crosshair';
            return;
        }
        dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
        canvas.style.cursor = 'grabbing';
    }

    function handlePointerMove(e, canvas, opts) {
        const { view, scheduleRender, debouncedSaveView, hitPoint, findTowerAt, setPoint, utils, TAP_THRESHOLD, worldSize, coordScale } = opts;
        const p = canvasPos(e, canvas);
        const tracked = pointers.has(e.pointerId);
        if (tracked) {
            pointers.set(e.pointerId, p);
            if (e.pointerType !== 'mouse') lastTouchTs = performance.now();
        }

        if (pinch && pointers.size >= 2) {
            const _it = pointers.values();
            const p1 = _it.next().value;
            const p2 = _it.next().value;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
            const newScale = utils.clamp(pinch.scale * dist / pinch.dist, MIN_SCALE, MAX_SCALE);
            view.scale = newScale;
            view.ox = mid.x - pinch.anchor.x * newScale;
            view.oy = mid.y + pinch.anchor.y * newScale;
            scheduleRender();
            debouncedSaveView();
            return;
        }

        ensureTooltipCache();
        if (_cursorCoords) {
            const wpt = utils.screenToWorld(p.x, p.y, view);
            _cxSpan.textContent = `x${utils.fmtCoord(wpt.x, coordScale)}`;
            _cySpan.textContent = `y${utils.fmtCoord(wpt.y, coordScale)}`;
            const wrap = getWrapRect(canvas);
            let lx = p.x + 14;
            let ly = p.y + 18;
            if (lx + 80 > wrap.width) lx = p.x - 90;
            if (ly + 44 > wrap.height) ly = p.y - 50;
            _cursorCoords.style.transform = `translate(${lx}px, ${ly}px)`;
            _cursorCoords.classList.add('visible');
        }

        if (dragging && dragging.mode === 'erase') {
            stopLongPress();
            if (window.AppDraw.eraseAt(p.x, p.y, view)) scheduleRender();
            return;
        }

        if (dragging && dragging.mode === 'draw') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.worldToPercent(wpt.x, worldSize);
            const py = utils.worldToPercent(wpt.y, worldSize);
            window.AppDraw.continueStroke(px, py);
            scheduleRender();
            return;
        }

        if (!tracked) {
            if (e.pointerType === 'mouse' && !dragging) {
                const overPoint = hitPoint(p.x, p.y);
                const overTower = !overPoint && findTowerAt(p.x, p.y);
                if (overPoint) {
                    canvas.style.cursor = 'grab';
                } else if (overTower) {
                    canvas.style.cursor = 'pointer';
                } else {
                    const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
                    canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
                }
            }
            return;
        }

        if (!dragging) return;
        if (dragging.mode === 'tower-or-pan') {
            const moved = Math.hypot(p.x - dragging.startX, p.y - dragging.startY) > TAP_THRESHOLD;
            if (!moved) return;
            stopLongPress();
            dragging = { mode: 'pan', startX: dragging.startX, startY: dragging.startY, ox: dragging.ox, oy: dragging.oy };
            canvas.style.cursor = 'grabbing';
        }

        if (dragging.mode === 'pan') {
            stopLongPress();
            view.ox = dragging.ox + (p.x - dragging.startX);
            view.oy = dragging.oy + (p.y - dragging.startY);
            scheduleRender();
            debouncedSaveView();
        }

        else if (dragging.mode === 'point') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            setPoint(dragging.key, wpt.x, wpt.y);
        }
    }

    function handlePointerUp(e, canvas, opts) {
        const { view, renderMap, findTowerAt, selectedTower, setSelectedTower } = opts;
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        try { canvas.releasePointerCapture(e.pointerId); } catch { }
        stopLongPress();
        const cc = getCursorCoordsEl();
        if (cc) cc.classList.remove('visible');

        if (pinch) {
            if (pointers.size >= 2) return;
            pinch = null;
            if (pointers.size === 1) {
                const rest = pointers.values().next().value;
                dragging = { mode: 'pan', startX: rest.x, startY: rest.y, ox: view.ox, oy: view.oy };
            } else {
                dragging = null;
            }
            return;
        }

        if (dragging && dragging.mode === 'erase') {
            dragging = null;
            canvas.style.cursor = 'cell';
            return;
        }

        if (dragging && dragging.mode === 'draw') {
            window.AppDraw.finishStroke();
            dragging = null;
            renderMap();
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
            return;
        }

        if (dragging && dragging.mode === 'tower-or-pan' && !longPressFired && e.button === 0) {
            const p = canvasPos(e, canvas);
            if (findTowerAt(p.x, p.y) === dragging.tower) {
                setSelectedTower((selectedTower === dragging.tower) ? null : dragging.tower);
                renderMap();
            }
        }

        longPressFired = false;
        if (pointers.size === 0) {
            dragging = null;
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
        }
    }

    function handleBlur(canvas) {
        pointers.clear();
        pinch = null;
        dragging = null;
        stopLongPress();
        longPressFired = false;
        invalidateCanvasRect();
        const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
        canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
        if (window.AppDraw) window.AppDraw.cancelStroke();
    }

    function handleWheel(e, canvas, opts) {
        const { view, scheduleRender, debouncedSaveView, utils } = opts;
        e.preventDefault();
        const p = canvasPos(e, canvas);
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newScale = utils.clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
        const wpt = utils.screenToWorld(p.x, p.y, view);
        view.scale = newScale;
        view.ox = p.x - wpt.x * view.scale;
        view.oy = p.y + wpt.y * view.scale;
        scheduleRender();
        debouncedSaveView();
    }

    function handleContextMenu(e, canvas, opts) {
        const { openMenuAt } = opts;
        e.preventDefault();
        const fromTouch = performance.now() - lastTouchTs < 1000;
        if (fromTouch && longPressFired) return;
        stopLongPress();
        const p = canvasPos(e, canvas);
        openMenuAt(p.x, p.y);
    }

    function getCursorCoordsEl() {
        ensureTooltipCache();
        return _cursorCoords;
    }

    return {
        handlePointerDown, handlePointerMove, handlePointerUp,
        handleBlur, handleWheel, handleContextMenu,
        invalidateWrapRect, invalidateCanvasRect, getCursorCoordsEl
    };
})();

window.MapViewport = (function () {
    const view = { scale: 0.05, ox: 0, oy: 0 };
    let canvas = null, renderMap = null, saveState = null;
    let worldSize = 160, saveTimer = null;
    let bounds = null;
    let resizeRafId = 0;

    function init(opts) {
        canvas = opts.canvas;
        renderMap = opts.renderMap;
        saveState = opts.saveState;
        worldSize = opts.worldSize;
        bounds = opts.bounds || null;
        window.addEventListener('resize', resize);
    }

    function get() { return view; }
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
            resizeRafId = 0;
            renderMap();
        });
    }

    function resetView() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (bounds) {
            const worldWidth = bounds.maxX - bounds.minX;
            const worldHeight = bounds.maxY - bounds.minY;
            view.scale = Math.min(w / worldWidth, h / worldHeight) * 0.9;
            const centerX = (bounds.minX + bounds.maxX) / 2;
            const centerY = (bounds.minY + bounds.maxY) / 2;
            view.ox = w / 2 - centerX * view.scale;
            view.oy = h / 2 + centerY * view.scale;
        } else {
            view.scale = Math.min(w, h) / worldSize * 0.9;
            view.ox = w / 2 - (worldSize / 2) * view.scale;
            view.oy = h / 2 + (worldSize / 2) * view.scale;
        }
        renderMap();
        debouncedSave();
    }

    function debouncedSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { if (saveState) saveState(); }, 200);
    }

    function restore(v) {
        if (v) { view.scale = v.scale; view.ox = v.ox; view.oy = v.oy; }
    }

    function setMap(worldSizeNew, _coordScaleNew, boundsNew) {
        worldSize = worldSizeNew;
        if (boundsNew) bounds = boundsNew;
    }

    return { init, get, resize, resetView, debouncedSave, restore, setMap };
})();