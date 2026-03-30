const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Locks the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            await interaction.reply('🔒 Channel locked.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to lock channel.', flags: 64 });
        }
    },
};
