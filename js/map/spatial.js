window.MapSpatial = (function () {
    let _world = [];
    let _screen = [];
    const _grid = new Map();
    let _cellSize = 64;
    let _vScale = 0;
    let _vOx = 0;
    let _vOy = 0;
    function _cellKey(cx, cy) {
        return (cx << 16) | (cy & 0xFFFF);
    }

    function configure(towers) {
        _world = new Array(towers.length);
        _screen = [];
        for (let i = 0; i < towers.length; i++) {
            _world[i] = {
                wx: towers[i].x,
                wy: towers[i].y,
                data: towers[i]
            };
        }
        _grid.clear();
        _vScale = 0;
        _vOx = 0;
        _vOy = 0;
    }

    function rebuild(view, halfSize) {
        if (view.scale === _vScale && view.ox === _vOx && view.oy === _vOy) return;
        _vScale = view.scale;
        _vOx = view.ox;
        _vOy = view.oy;
        const n = _world.length;
        const scale = view.scale;
        const ox = view.ox;
        const oy = view.oy;
        _screen = new Array(n);

        for (let i = 0; i < n; i++) {
            const t = _world[i];
            _screen[i] = {
                x: t.wx * scale + ox,
                y: -(t.wy * scale) + oy
            };
        }
        _cellSize = Math.max(32, halfSize * 2);
        _grid.clear();

        for (let i = 0; i < n; i++) {
            const s = _screen[i];
            const minCX = Math.floor((s.x - halfSize) / _cellSize);
            const maxCX = Math.floor((s.x + halfSize) / _cellSize);
            const minCY = Math.floor((s.y - halfSize) / _cellSize);
            const maxCY = Math.floor((s.y + halfSize) / _cellSize);
            for (let cx = minCX; cx <= maxCX; cx++) {
                for (let cy = minCY; cy <= maxCY; cy++) {
                    const key = _cellKey(cx, cy);
                    let bucket = _grid.get(key);
                    if (!bucket) { bucket = []; _grid.set(key, bucket); }
                    bucket.push(i);
                }
            }
        }
    }

    function findTowerAt(sx, sy, halfSize) {
        const cx = Math.floor(sx / _cellSize);
        const cy = Math.floor(sy / _cellSize);
        const bucket = _grid.get(_cellKey(cx, cy));
        if (!bucket) return null;
        for (let j = 0; j < bucket.length; j++) {
            const s = _screen[bucket[j]];
            if (s && Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
                return _world[bucket[j]].data;
            }
        }
        return null;
    }
    
    function getTowerScreenPos(index) {
        return _screen[index] || null;
    }
    return { configure, rebuild, findTowerAt, getTowerScreenPos };
})();
