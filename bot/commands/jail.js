const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jailManager = require('../utils/jailManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Jail a user')
        .addUserOption(option => option.setName('user').setDescription('The user to jail').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('Duration (e.g. 10m, 1h)').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for jailing').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        // Fix for when client is not passed as 2nd arg
        if (!client) client = interaction.client;

        // Check if enabled
        const settings = client.db ? client.db.get('settings').value() : {};
        if (settings.jailEnabled === false) return interaction.reply({ content: 'Jail system is currently disabled.', ephemeral: true });

        const user = interaction.options.getMember('user');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

        const duration = parseDuration(durationStr);
        if (!duration) return interaction.reply({ content: 'Invalid duration format. Use s/m/h/d/y (e.g. 10m).', ephemeral: true });

        // Check hierarchy
        if (user.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'You cannot jail this user due to role hierarchy.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const success = await jailManager.jailUser(client, interaction.guild, user, duration, reason, interaction.user);

            if (success) {
                const timeFormatted = jailManager.formatDuration(duration); // Or re-use durationStr if preferred
                await interaction.editReply(`✅ **${user.user.tag}** has been jailed for **${durationStr}**.\nReason: ${reason}`);
            } else {
                await interaction.editReply('Failed to jail user. Please check logs/roles.');
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `Failed to jail user: ${error.message}` });
        }
    }
};

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(s|m|h|d|y)$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'y': return value * 365 * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

module.exports.parseDuration = parseDuration;
