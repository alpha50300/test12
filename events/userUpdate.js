const { Events } = require('discord.js');
const { logEvent } = require('../utils/logger');

module.exports = {
    name: Events.UserUpdate,
    execute(oldUser, newUser) {
        if (newUser.bot) return;

        // Avatar Change
        if (oldUser.avatar !== newUser.avatar) {
            const details = `Avatar changed. [View New](${newUser.displayAvatarURL()})`;
            logEvent('User', 'Avatar Update', newUser.tag, details, 'fas fa-image', '#3BA55C');
        }

        // Username Change
        if (oldUser.username !== newUser.username) {
            const details = `Username changed: ${oldUser.username} ➔ ${newUser.username}`;
            logEvent('User', 'Name Update', newUser.tag, details, 'fas fa-id-card', '#5865F2');
        }
    },
};
