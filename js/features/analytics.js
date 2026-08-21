// js/features/analytics.js — Трекинг событий

window.AppAnalytics = (function() {
    function sendDiscordEvent(source) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'select_promotion',
            ecommerce: {
                creative_name: source,
                creative_slot: 'panel',
                promotion_id: 'discord_invite',
            },
        });
        if (typeof ym === 'function') ym(111625912, 'reachGoal', 'discord_qr_click');
    }
    function init() {
        document.getElementById('discordQr').addEventListener('click', () => {
            sendDiscordEvent('Discord QR');
        });
        document.getElementById('discordBtn').addEventListener('click', () => {
            sendDiscordEvent('Discord Button');
        });
    }
    return { init, sendDiscordEvent };
})();