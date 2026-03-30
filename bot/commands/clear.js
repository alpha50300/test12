const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clears a specified number of messages.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to clear (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        try {
            await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `Deleted ${amount} messages.`, flags: 64 });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to clear messages. Messages older than 14 days cannot be cleared.', flags: 64 });
        }
    },
};
