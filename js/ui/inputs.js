// js/ui/inputs.js — Координатные поля (ax, ay, bx, by)

window.UIInputs = (function(points, utils) {
    let inputs = null;
    let timer = null;
    let debounceMs = 80;
    let mapSize = 16000;

    function init(opts) {
        inputs = opts.inputs;
        debounceMs = opts.debounceMs || 80;
        mapSize = opts.mapSize;
        bind();
    }

    function setField(el, val) {
        if (document.activeElement !== el) el.value = val;
    }

    function sync() {
        const A = points.getA(), B = points.getB();
        if (A) {
            setField(inputs.ax, utils.formatPercent(utils.metersToPercent(A.x, mapSize)));
            setField(inputs.ay, utils.formatPercent(utils.metersToPercent(A.y, mapSize)));
        } else {
            setField(inputs.ax, ''); setField(inputs.ay, '');
        }
        if (B) {
            setField(inputs.bx, utils.formatPercent(utils.metersToPercent(B.x, mapSize)));
            setField(inputs.by, utils.formatPercent(utils.metersToPercent(B.y, mapSize)));
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