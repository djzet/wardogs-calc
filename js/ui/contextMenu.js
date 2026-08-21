// js/ui/contextMenu.js — Контекстное меню карты

window.UIContextMenu = (function (utils) {
    let menu = null;
    let menuWorld = null;
    let menuPointKey = null;
    let deps = null;
    function init(d) {
        deps = d;
        menu = document.getElementById('ctxMenu');
        if (!menu) return;
        bind();
    }
    function openMenuAt(sx, sy) {
        if (!menu) return;
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
    function hideMenu() { if (menu) menu.classList.add('hidden'); }
    function bind() {
        menu.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            const action = btn ? btn.dataset.action : null;
            if (!action) return;
            if (action === 'setA') deps.setPoint('A', menuWorld.x, menuWorld.y);
            if (action === 'setB') deps.setPoint('B', menuWorld.x, menuWorld.y);
            if (action === 'delete') deps.setPoint(menuPointKey, null);
            hideMenu();
        });
    }
    return { init, openMenuAt, hideMenu };
})(window.AppUtils);