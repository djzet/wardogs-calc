// js/ui/contextMenu.js — Контекстное меню карты

window.UIContextMenu = (function(utils) {
    let menu = null;
    let menuWorld = null;
    let menuPointKey = null;
    let deps = null;

    function init(d) {
        deps = d;
        menu = document.getElementById('ctxMenu');
        bind();
    }

    function openMenuAt(sx, sy) {
        const view = deps.getView();
        menuWorld = utils.screenToWorld(sx, sy, view);
        menuPointKey = deps.hitPoint(sx, sy);
        document.getElementById('menuDelete').classList.toggle('hidden', !menuPointKey);
        menu.classList.remove('hidden');

        const wrap = deps.getWrapRect();
        let left = sx, top = sy;
        if (left + menu.offsetWidth > wrap.width) left -= menu.offsetWidth;
        if (top + menu.offsetHeight > wrap.height) top -= menu.offsetHeight;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    function hideMenu() { menu.classList.add('hidden'); }

    function bind() {
        menu.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (!action) return;
            if (action === 'setA') deps.setPoint('A', menuWorld.x, menuWorld.y);
            if (action === 'setB') deps.setPoint('B', menuWorld.x, menuWorld.y);
            if (action === 'delete') deps.setPoint(menuPointKey, null);
            hideMenu();
        });
    }

    return { init, openMenuAt, hideMenu };
})(window.AppUtils);