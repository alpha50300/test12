const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Times out a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for timeout'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User needs to be in the server to be timed out via this command.', flags: 64 });
        }

        if (!member.moderatable) {
            return interaction.reply({ content: 'I cannot timeout this user (missing permissions or higher role).', flags: 64 });
        }

        try {
            await member.timeout(duration * 60 * 1000, reason);
            await interaction.reply(`✅ **${target.tag}** has been timed out for ${duration} minutes. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to timeout user.', flags: 64 });
        }
    },
};
