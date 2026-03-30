const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlocks the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
            await interaction.reply('🔓 Channel unlocked.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to unlock channel.', flags: 64 });
        }
    },
};
