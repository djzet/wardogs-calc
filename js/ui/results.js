// js/ui/results.js — Отображение панели результатов

window.UIResults = (function (calc, points, utils) {
    let out = null, getWeapons = null, getCurrentWeapon = null, STR = null;
    function init(opts) {
        out = opts.out;
        getWeapons = opts.getWeapons;
        getCurrentWeapon = opts.getCurrentWeapon;
        STR = opts.STR;
    }
    function update() {
        out.el.classList.remove('oor', 'warn');
        out.dist.classList.remove('oor', 'warn');
        const weapon = getWeapons()[getCurrentWeapon()];
        const r = calc.calculate(points.getA(), points.getB(), weapon);
        if (r.status === 'noPoints') {
            out.dist.textContent = out.az.textContent = out.el.textContent = '—';
            if (out.time) out.time.textContent = '—';
            return;
        }
        out.dist.textContent = utils.fmtDist(r.dist, STR);
        out.az.textContent = r.azimuth.toFixed(1) + '°';
        switch (r.status) {
            case 'coincide':
                out.el.textContent = STR.zero;
                out.el.classList.add('warn');
                if (out.time) out.time.textContent = '—';
                break;
            case 'tooClose':
                out.el.textContent = STR.tooClose || 'слишком близко';
                out.el.classList.add('warn');
                if (out.time) out.time.textContent = '—';
                break;
            case 'outOfRange':
            case 'noSolution':
                out.el.textContent = STR.oor;
                out.el.classList.add('oor');
                if (out.time) out.time.textContent = '—';
                break;
            case 'ok':
                out.el.textContent = r.mils + utils.NBSP + STR.u_mil;
                if (out.time) {
                    out.time.textContent = (typeof r.flightTime === 'number'
                        ? r.flightTime.toFixed(1)
                        : '—') + utils.NBSP + STR.u_s;
                }
                break;
        }
    }
    return { init, update };
})(window.AppCalculator, window.AppPoints, window.AppUtils);