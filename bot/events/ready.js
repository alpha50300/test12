const { Events } = require('discord.js');
const inviteTracker = require('../utils/inviteTracker');

const deployCommands = require('../utils/deployCommands');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}!`);

        // Deploy Slash Commands
        await deployCommands();

        inviteTracker.init(client);
    }
};
