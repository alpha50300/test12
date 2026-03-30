const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for banning'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User needs to be in the server to be banned via this command.', flags: 64 });
        }

        if (!member.bannable) {
            return interaction.reply({ content: 'I cannot ban this user (missing permissions or higher role).', flags: 64 });
        }

        try {
            await member.ban({ reason });
            await interaction.reply(`✅ **${target.tag}** has been banned. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to ban user.', flags: 64 });
        }
    },
};
