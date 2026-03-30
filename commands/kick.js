const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for kicking'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User needs to be in the server to be kicked via this command.', flags: 64 });
        }

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user (missing permissions or higher role).', flags: 64 });
        }

        try {
            await member.kick(reason);
            await interaction.reply(`✅ **${target.tag}** has been kicked. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to kick user.', flags: 64 });
        }
    },
};
