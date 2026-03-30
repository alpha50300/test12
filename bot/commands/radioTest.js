const { SlashCommandBuilder } = require('discord.js');
const radioManager = require('../utils/radioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radio-test')
        .setDescription('Force start the radio'),
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            await radioManager.start(client);
            await interaction.editReply('Radio start triggered. Check console for logs.');
        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to start radio: ' + error.message);
        }
    },
};
