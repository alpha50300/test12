const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setnick')
        .setDescription('Sets a nickname for a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nickname')
                .setDescription('The new nickname')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const nickname = interaction.options.getString('nickname');
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User needs to be in the server.', flags: 64 });
        }

        try {
            await member.setNickname(nickname);
            await interaction.reply(`✅ Updated nickname for **${target.tag}**.`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to set nickname. Ensure my role is higher than the target user.', flags: 64 });
        }
    },
};
