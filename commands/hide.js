const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hide')
        .setDescription('Hides the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
            await interaction.reply('🙈 Channel hidden.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to hide channel.', flags: 64 });
        }
    },
};
