/**
 *
 * Отправляет события в:
 * - Google Tag Manager (dataLayer) для e-commerce аналитики
 * - Яндекс.Метрику (reachGoal) для отслеживания целей
 *
 * Трекаемые события: клики по Discord (QR и кнопка).
 * Экспорт: window.AppAnalytics
 */

window.AppAnalytics = (function() {

    /**
     * Отправляет событие клика по Discord в dataLayer (GTM) и Яндекс.Метрику.
     *
     * Формат dataLayer соответствует Google Merchants / GA4:
     *   event: 'select_promotion' — стандартное событие e-commerce
     *
     * @param {string} source — источник клика (например, 'Discord QR' или 'Discord Button')
     */
    function sendDiscordEvent(source) {
        /** Инициализируем dataLayer если его ещё нет */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'select_promotion',
            ecommerce: {
                creative_name: source,       /** Источник клика */
                creative_slot: 'panel',       /** Расположение в панели */
                promotion_id: 'discord_invite', /** ID акции (Discord приглашение) */
            },
        });

        /** Яндекс.Метрика: достижение цели discord_qr_click */
        if (typeof ym === 'function') ym(111625912, 'reachGoal', 'discord_qr_click');
    }

    /**
     * Инициализирует аналитику: привязывает обработчики кликов
     * к элементам Discord QR и Discord Button.
     */
    function init() {
        const qrEl = document.getElementById('discordQr');
        const btnEl = document.getElementById('discordBtn');
        if (qrEl) qrEl.addEventListener('click', () => {
            sendDiscordEvent('Discord QR');
        });
        if (btnEl) btnEl.addEventListener('click', () => {
            sendDiscordEvent('Discord Button');
        });
    }

    return { init, sendDiscordEvent };
})();
