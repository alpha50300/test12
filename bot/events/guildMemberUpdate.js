const { Events } = require('discord.js');
const { logEvent } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    execute(oldMember, newMember) {
        if (newMember.user.bot) return;

        // Nickname Change
        if (oldMember.nickname !== newMember.nickname) {
            const oldNick = oldMember.nickname || oldMember.user.username;
            const newNick = newMember.nickname || newMember.user.username;
            const details = `Nickname changed: ${oldNick} ➔ ${newNick}`;
            logEvent('Member', 'Nickname Update', newMember.user.tag, details, 'fas fa-signature', '#FAA61A');
        }

        // Role Changes
        // Added Roles
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            const roleNames = addedRoles.map(r => r.name).join(', ');
            const details = `Roles added: ${roleNames}`;
            logEvent('Member', 'Role Added', newMember.user.tag, details, 'fas fa-plus-circle', '#57F287');
        }

        // Removed Roles
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        if (removedRoles.size > 0) {
            const roleNames = removedRoles.map(r => r.name).join(', ');
            const details = `Roles removed: ${roleNames}`;
            logEvent('Member', 'Role Removed', newMember.user.tag, details, 'fas fa-minus-circle', '#ED4245');
        }
    },
};
