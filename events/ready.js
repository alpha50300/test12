const { Events } = require('discord.js');
const inviteTracker = require('../utils/inviteTracker');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Logged in as ${client.user.tag}!`);
        inviteTracker.init(client);
    }
};
