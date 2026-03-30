const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('show')
        .setDescription('Unhides the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true });
            await interaction.reply('👁️ Channel visible.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to show channel.', flags: 64 });
        }
    },
};
