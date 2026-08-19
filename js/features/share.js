// js/features/share.js — Шаринг ссылок и toast-уведомления

window.AppShare = (function(utils) {
    let toastTimer = null;

    function generateUrl(pointA, pointB, currentWeapon, mapSize) {
        const params = new URLSearchParams();
        if (pointA) {
            params.set('ax', utils.metersToPercent(pointA.x, mapSize).toFixed(2));
            params.set('ay', utils.metersToPercent(pointA.y, mapSize).toFixed(2));
        }
        if (pointB) {
            params.set('bx', utils.metersToPercent(pointB.x, mapSize).toFixed(2));
            params.set('by', utils.metersToPercent(pointB.y, mapSize).toFixed(2));
        }
        params.set('w', currentWeapon);
        return location.origin + location.pathname + '?' + params.toString();
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            const input = document.createElement('input');
            input.value = text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            return true;
        }
    }

    function showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.querySelector('.map-wrap').appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'toast ' + type;
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    function parseSharedParams(mapSize) {
        const params = new URLSearchParams(location.search);
        const result = { applied: false, pointA: null, pointB: null, weapon: null };

        if (params.has('ax') && params.has('ay')) {
            const ax = parseFloat(params.get('ax'));
            const ay = parseFloat(params.get('ay'));
            if (!isNaN(ax) && !isNaN(ay)) {
                result.pointA = {
                    x: utils.percentToMeters(utils.clamp(ax, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(ay, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }

        if (params.has('bx') && params.has('by')) {
            const bx = parseFloat(params.get('bx'));
            const by = parseFloat(params.get('by'));
            if (!isNaN(bx) && !isNaN(by)) {
                result.pointB = {
                    x: utils.percentToMeters(utils.clamp(bx, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(by, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }

        if (params.has('w')) {
            const w = params.get('w');
            if (w === 'mortar' || w === 'artillery') {
                result.weapon = w;
                result.applied = true;
            }
        }

        return result;
    }

    return {
        generateUrl,
        copyToClipboard,
        showToast,
        parseSharedParams
    };
})(window.AppUtils);