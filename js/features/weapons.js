// js/features/weapons.js — Выбор оружия

window.AppWeapons = (function(storage) {
    let currentWeapon = null;

    function init(defaultWeapon, onChange) {
        currentWeapon = storage.loadWeapon(defaultWeapon);
        bind(onChange);
    }

    function get() { return currentWeapon; }

    function set(w) {
        currentWeapon = w;
        storage.saveWeapon(w);
        document.querySelectorAll('input[name="weapon"]').forEach(r => {
            r.checked = r.value === w;
        });
    }

    function bind(onChange) {
        const radios = document.querySelectorAll('input[name="weapon"]');
        radios.forEach(radio => {
            if (radio.value === currentWeapon) radio.checked = true;
            radio.addEventListener('change', (e) => {
                currentWeapon = e.target.value;
                storage.saveWeapon(currentWeapon);
                if (onChange) onChange();
            });
        });
    }

    return { init, get, set };
})(window.AppStorage);