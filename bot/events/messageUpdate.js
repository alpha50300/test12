const { Events } = require('discord.js');
const messageCreate = require('./messageCreate');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        if (oldMessage.partial) return; // Skip partials if we want to save complexity, or fetch them.
        if (newMessage.partial) await newMessage.fetch();

        if (newMessage.author.bot || !newMessage.guild) return;

        // Reuse the logic from messageCreate, treating the edited message as a "new" message for AutoMod purposes
        // We only care about AutoMod parts, but messageCreate puts them at the top.
        // Caveat: This triggers command handler and AI again? 
        // We should extract AutoMod logic or just copy-paste relevant check.
        // For safety and speed, let's call execute but we might want to flag it as 'edit' to avoid re-triggering commands/AI/XP if we had XP.
        // Actually, re-triggering commands on edit is a feature some like (e.g. fixing a typo in !ban).
        // Let's allow it for now.

        await messageCreate.execute(newMessage, client);
    }
};
