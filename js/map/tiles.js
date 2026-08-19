// js/map/tiles.js — Загрузка и кэширование тайлов карты

window.MapTiles = (function() {
    const tileCache = new Map();
    let cacheMax = 500;

    function configure(max) {
        cacheMax = max;
    }

    function getTile(z, x, y, tilesConfig, onLoaded) {
        const key = `${z}/${x}_${y}`;
        let t = tileCache.get(key);
        if (t) {
            tileCache.delete(key);
            tileCache.set(key, t);
            return t;
        }

        const img = new Image();
        t = { img, loaded: false, error: false };
        img.onload = () => { t.loaded = true; onLoaded && onLoaded(); };
        img.onerror = () => { t.error = true; };
        img.src = tilesConfig.path(z, x, y);
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

    function drawTiles(ctx, canvas, view, mapConfig, tilesConfig, themeColors, onTileLoaded) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const utils = window.AppUtils;

        const z = Math.max(0, Math.min(tilesConfig.maxZoom,
            Math.round(Math.log2((view.scale * mapConfig.size) / tilesConfig.size))));
        const tps = 2 ** z;
        const tileScale = (tps * tilesConfig.size) / mapConfig.size;
        const drawSize = tilesConfig.size * (view.scale / tileScale);

        const a = utils.screenToWorld(0, 0, view);
        const b = utils.screenToWorld(w, h, view);
        const x0 = Math.max(0, Math.floor((a.x / mapConfig.size) * tps));
        const x1 = Math.min(tps - 1, Math.floor((b.x / mapConfig.size) * tps));
        const y0 = Math.max(0, Math.floor(((mapConfig.size - a.y) / mapConfig.size) * tps));
        const y1 = Math.min(tps - 1, Math.floor(((mapConfig.size - b.y) / mapConfig.size) * tps));

        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const wx0 = (tx / tps) * mapConfig.size;
                const wy0 = mapConfig.size - (ty / tps) * mapConfig.size;
                const s = utils.worldToScreen(wx0, wy0, view);
                const t = getTile(z, tx, ty, tilesConfig, onTileLoaded);
                if (t.loaded) {
                    ctx.drawImage(t.img, s.x, s.y, drawSize + 0.5, drawSize + 0.5);
                } else if (!t.error) {
                    ctx.fillStyle = themeColors.mapBg;
                    ctx.fillRect(s.x, s.y, drawSize, drawSize);
                }
            }
        }
    }

    return { configure, getTile, drawTiles };
})();