const { Events } = require('discord.js');
const { logEvent } = require('../utils/logger'); // Adjust path as needed

module.exports = {
    name: Events.MessageDelete,
    execute(message) {
        // Ignore bot messages and partials (sometimes unavoidable if uncached)
        if (message.author && message.author.bot) return;

        let content = message.content ? message.content : '*[Content not cached or empty]*';
        // Truncate if too long
        if (content.length > 100) content = content.substring(0, 100) + '...';

        const user = message.author ? message.author.tag : 'Unknown User';
        const details = `Message deleted in #${message.channel.name}: "${content}"`;

        logEvent('Message', 'Deleted', user, details, 'fas fa-trash-alt', '#ED4245');
    },
};
