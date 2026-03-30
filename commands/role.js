const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manage roles for a user.')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a role to a user')
                .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('The role').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('The role').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('target');
        const role = interaction.options.getRole('role');
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User needs to be in the server.', flags: 64 });
        }

        try {
            if (sub === 'add') {
                await member.roles.add(role);
                await interaction.reply(`✅ Added **${role.name}** to **${target.tag}**.`);
            } else {
                await member.roles.remove(role);
                await interaction.reply(`✅ Removed **${role.name}** from **${target.tag}**.`);
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to manage role. Ensure my role is higher than the target role.', flags: 64 });
        }
    },
};
