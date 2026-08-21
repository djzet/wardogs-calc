// js/ui/inputs.js — Координатные поля (ax, ay, bx, by) в игровых координатах

window.UIInputs = (function (points, utils) {
    let inputs = null;
    let timer = null;
    let debounceMs = 80;
    let mapSize = 16000;
    function init(opts) {
        inputs = opts.inputs;
        debounceMs = opts.debounceMs || 80;
        mapSize = opts.mapSize;
        const maxGame = String(mapSize / 100);
        Object.values(inputs).forEach(i => {
            i.min = '0';
            i.max = maxGame;
            i.step = '0.01';
        });
        bind();
    }
    function setField(el, val) {
        if (document.activeElement !== el) el.value = val;
    }
    function sync() {
        const A = points.getA(), B = points.getB();
        if (A) {
            setField(inputs.ax, utils.gameCoord(A.x));
            setField(inputs.ay, utils.gameCoord(A.y));
        } else {
            setField(inputs.ax, ''); setField(inputs.ay, '');
        }
        if (B) {
            setField(inputs.bx, utils.gameCoord(B.x));
            setField(inputs.by, utils.gameCoord(B.y));
        } else {
            setField(inputs.bx, ''); setField(inputs.by, '');
        }
    }
    function onInput() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
        }, debounceMs);
    }
    function onBlur() {
        clearTimeout(timer);
        points.applyFromInputs(inputs.ax, inputs.ay, inputs.bx, inputs.by);
    }
    function bind() {
        Object.values(inputs).forEach(i => i.addEventListener('input', onInput));
        Object.values(inputs).forEach(i => i.addEventListener('blur', onBlur));
    }
    return { init, sync };
})(window.AppPoints, window.AppUtils);