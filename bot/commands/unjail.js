const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jailManager = require('../utils/jailManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Unjails a user and restores their roles.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unjail')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        // Fix for when client is not passed as 2nd arg
        if (!client) client = interaction.client;

        // Check if enabled
        const settings = client.db ? client.db.get('settings').value() : {};
        if (settings.jailEnabled === false) return interaction.reply({ content: 'Jail system is currently disabled.', ephemeral: true });

        const user = interaction.options.getUser('user');

        await interaction.deferReply();

        try {
            const success = await jailManager.unjailUser(client, interaction.guild, interaction.guild.members.cache.get(user.id), user.id);

            if (success) {
                await interaction.editReply({ content: `✅ **${user.tag}** has been released from jail.` });
            } else {
                await interaction.editReply({ content: `User **${user.tag}** is not currently in jail.` });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `Failed to unjail user: ${error.message}` });
        }
    }
};
