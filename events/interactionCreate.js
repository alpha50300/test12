const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionsBitField, AttachmentBuilder, ButtonBuilder, StringSelectMenuBuilder } = require('discord.js');
const canvasGenerator = require('../utils/canvasGenerator');
const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Check Denied Channels (Blacklist) for Slash Commands
                const db = require('lowdb');
                const FileSync = require('lowdb/adapters/FileSync');
                const adapter = new FileSync('db.json');
                const mainDb = low(adapter);
                const commandsSettings = mainDb.get('commands').value() || {};
                const commandConfig = commandsSettings[interaction.commandName];

                if (commandConfig && commandConfig.deniedChannels && commandConfig.deniedChannels.length > 0) {
                    if (commandConfig.deniedChannels.includes(interaction.channelId)) {
                        return interaction.reply({ content: '🚫 This command is disabled in this channel.', flags: 64 });
                    }
                }

                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
                }
            }
            return;
        }

        const db = client.db;
        const settings = db.get('settings').value();

        // --- TICKETS ---
        // --- TICKETS ---
        let isTicketCreate = false;
        let panelId = null;
        let ticketTopic = 'support';

        if (interaction.isButton() && interaction.customId.startsWith('ticket_create_')) {
            isTicketCreate = true;
            panelId = interaction.customId.split('_')[2];
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
            isTicketCreate = true;
            panelId = interaction.customId.split('_')[2];
            // Value format: ticket_create_PANELID_TOPIC
            const val = interaction.values[0];
            const parts = val.split('_');
            if (parts.length >= 4) ticketTopic = parts.slice(3).join('-');
        }

        if (isTicketCreate) {
            // Fix: Load tickets DB directly if not on client
            const ticketsAdapter = new FileSync('data/tickets.json');
            const ticketsDb = low(ticketsAdapter);
            // const ticketsDb = client.ticketsDb; // Original caused crash if undefined

            const panel = ticketsDb.get('panels').find({ id: panelId }).value();

            if (!panel) {
                return interaction.reply({ content: 'Ticket panel not found. It might have been deleted.', ephemeral: true });
            }

            const guild = interaction.guild;
            // Support both new (nested in config) and old (flat) structures
            const category = panel.config?.category || panel.category;
            const role = panel.config?.supportRole || panel.supportRole;

            try {
                // Create Channel
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${interaction.user.username}-${ticketTopic}`,
                    type: 0, // ChannelType.GuildText
                    parent: category,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles],
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                        }
                    ],
                });

                if (role) {
                    ticketChannel.permissionOverwrites.edit(role, {
                        ViewChannel: true,
                        SendMessages: true
                    });
                }

                // Save to DB
                const ticketData = {
                    id: ticketChannel.id,
                    ownerId: interaction.user.id,
                    panelId: panelId,
                    createdAt: Date.now(),
                    claimedBy: null,
                    members: [interaction.user.id]
                };
                ticketsDb.get('activeTickets').push(ticketData).write();

                // Send Welcome Message
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`${panel.embed.title} - Ticket`)
                    .setDescription(`Welcome <@${interaction.user.id}>!\nTopic: **${ticketTopic}**\nSupport will be with you shortly.\n\n**Panel:** ${panel.embed.title}`)
                    .setColor(panel.embed.color)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId(`ticket_close_${ticketChannel.id}`).setLabel('Close').setStyle(4).setEmoji('🔒'),
                        new ButtonBuilder().setCustomId(`ticket_claim_${ticketChannel.id}`).setLabel('Claim').setStyle(1).setEmoji('👋'),
                        new ButtonBuilder().setCustomId(`ticket_call_${ticketChannel.id}`).setLabel('Call User').setStyle(2).setEmoji('🔔'),
                        new ButtonBuilder().setCustomId(`ticket_manage_${ticketChannel.id}`).setLabel('Manage Users').setStyle(2).setEmoji('👥'),
                    );

                await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${panel.config.supportRole}>`, embeds: [welcomeEmbed], components: [row] });

                return interaction.reply({ content: `✅ Ticket created! <#${ticketChannel.id}>`, ephemeral: true });

            } catch (error) {
                console.error('Ticket Create Error:', error);
                return interaction.reply({ content: 'Failed to create ticket. Please contact an admin.', ephemeral: true });
            }
        }

        // --- TICKET ACTIONS ---
        if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
            const action = interaction.customId.split('_')[1];
            // const ticketId = interaction.customId.split('_')[2]; // Extract if needed
            // Fix: Load tickets DB directly
            const ticketsAdapter = new FileSync('data/tickets.json');
            const ticketsDb = low(ticketsAdapter);
            // const ticketsDb = client.ticketsDb; // Original caused info crash

            // Logic for Close, Claim, Call, Manage
            if (action === 'close') {
                const channelId = interaction.channel.id; // Capture ID safely
                const ticketRel = ticketsDb.get('activeTickets').find({ id: channelId }).value();
                if (ticketRel) {
                    await interaction.reply('Closing ticket in 5 seconds...');
                    setTimeout(async () => {
                        await interaction.channel.delete().catch(() => { });
                        ticketsDb.get('activeTickets').remove({ id: channelId }).write();
                    }, 5000);
                } else {
                    await interaction.reply({ content: 'This is not a registered ticket channel.', ephemeral: true });
                }
            }

            if (action === 'claim') {
                const ticket = ticketsDb.get('activeTickets').find({ id: interaction.channel.id }).value();
                if (ticket.claimedBy) return interaction.reply({ content: `Already claimed by <@${ticket.claimedBy}>`, ephemeral: true });

                ticketsDb.get('activeTickets').find({ id: interaction.channel.id }).assign({ claimedBy: interaction.user.id }).write();

                const embed = new EmbedBuilder()
                    .setDescription(`✅ Ticket claimed by ${interaction.user}`)
                    .setColor('#3BA55C');

                ticket.claimedBy = interaction.user.id;
                interaction.channel.setName(`claimed-${interaction.user.username}`);
                interaction.reply({ embeds: [embed] });
            }

            if (action === 'call') {
                // Send DM to user
                const ticket = ticketsDb.get('activeTickets').find({ id: interaction.channel.id }).value();
                if (ticket) {
                    const user = await client.users.fetch(ticket.ownerId).catch(() => null);
                    if (user) {
                        user.send(`🔔 **Support Notification**: You are being called in your ticket <#${interaction.channel.id}> in **${interaction.guild.name}**.`).catch(() => { });
                        interaction.reply({ content: 'User notified via DM.', ephemeral: true });
                    } else {
                        interaction.reply({ content: 'Could not DM user.', ephemeral: true });
                    }
                }
            }

            if (action === 'manage') {
                // Show modal to add/remove user
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_manage_modal_${interaction.channel.id}`)
                    .setTitle('Manage Ticket Users');

                const userInput = new TextInputBuilder()
                    .setCustomId('target_user_id')
                    .setLabel("User ID")
                    .setPlaceholder("Enter User ID to Add/Remove")
                    .setStyle(1); // Short

                const typeInput = new TextInputBuilder()
                    .setCustomId('action_type')
                    .setLabel("Action (add/remove)")
                    .setPlaceholder("Type 'add' or 'remove'")
                    .setStyle(1);

                modal.addComponents(new ActionRowBuilder().addComponents(userInput), new ActionRowBuilder().addComponents(typeInput));
                await interaction.showModal(modal);
            }
        }

        // --- MODAL SUBMIT FOR TICKETS ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_manage_modal_')) {
            const targetId = interaction.fields.getTextInputValue('target_user_id');
            const actionType = interaction.fields.getTextInputValue('action_type').toLowerCase();
            const channel = interaction.channel;

            if (actionType === 'add') {
                channel.permissionOverwrites.create(targetId, { ViewChannel: true, SendMessages: true });
                interaction.reply(`Added <@${targetId}> to the ticket.`);
            } else if (actionType === 'remove') {
                channel.permissionOverwrites.delete(targetId);
                interaction.reply(`Removed <@${targetId}> from the ticket.`);
            } else {
                interaction.reply({ content: 'Invalid action. Use "add" or "remove".', ephemeral: true });
            }
        }

        // --- SUGGESTION BUTTONS ---
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('rate_feedback_') || interaction.customId === 'accept_suggestion' || interaction.customId === 'reject_suggestion') {
                // ... (Existing suggestion code is fine, just wrapping properly if needed or ensuring no overlap)
            }

            // --- TEMP VOICE BUTTONS ---
            if (interaction.customId.startsWith('temp_')) {
                const tempDb = low(new FileSync('data/tempvoice.json'));
                const channelData = tempDb.get('activeChannels').find({ id: interaction.channel.id }).value();

                if (!channelData) {
                    return interaction.reply({ content: 'This is not a registered temporary voice channel.', ephemeral: true });
                }

                // Check Ownership
                if (channelData.ownerId !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: 'Only the channel owner can control this room.', ephemeral: true });
                }

                const action = interaction.customId;
                const channel = interaction.channel;

                if (action === 'temp_edit_name') {
                    const modal = new ModalBuilder().setCustomId('temp_modal_name').setTitle('Rename Channel');
                    const input = new TextInputBuilder().setCustomId('new_name').setLabel('New Name').setStyle(1).setMaxLength(100);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return; // Modals cannot be deferred
                }

                if (action === 'temp_limit') {
                    const modal = new ModalBuilder().setCustomId('temp_modal_limit').setTitle('Set User Limit');
                    const input = new TextInputBuilder().setCustomId('new_limit').setLabel('Limit (0-99)').setStyle(1).setMaxLength(2).setPlaceholder('0 for unlimited');
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                if (action === 'temp_permit') {
                    const modal = new ModalBuilder().setCustomId('temp_modal_permit').setTitle('Trust User');
                    const input = new TextInputBuilder().setCustomId('target_id').setLabel('User ID').setStyle(1);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                if (action === 'temp_kick') {
                    const modal = new ModalBuilder().setCustomId('temp_modal_kick').setTitle('Kick User');
                    const input = new TextInputBuilder().setCustomId('target_id').setLabel('User ID').setStyle(1);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                if (action === 'temp_transfer') {
                    const modal = new ModalBuilder().setCustomId('temp_modal_transfer').setTitle('Transfer Ownership');
                    const input = new TextInputBuilder().setCustomId('target_id').setLabel('User ID').setStyle(1);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                // --- Actions that can be deferred ---
                await interaction.deferReply({ ephemeral: true });

                try {
                    if (action === 'temp_lock') {
                        const isLocked = !channel.permissionsFor(interaction.guild.id).has(PermissionsBitField.Flags.Connect);
                        const newLockState = !isLocked;

                        if (newLockState) {
                            // Unlocking
                            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
                            await interaction.editReply({ content: '🔓 Channel **Unlocked**.' });
                        } else {
                            // Locking
                            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                            await interaction.editReply({ content: '🔒 Channel **Locked**.' });
                        }
                    }

                    if (action === 'temp_hide') {
                        const isHidden = !channel.permissionsFor(interaction.guild.id).has(PermissionsBitField.Flags.ViewChannel);
                        const newHideState = !isHidden;

                        if (newHideState) {
                            await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
                            await interaction.editReply({ content: '👁️ Channel **Visible**.' });
                        } else {
                            await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                            await interaction.editReply({ content: '🚫 Channel **Hidden**.' });
                        }
                    }

                    if (action === 'temp_delete') {
                        await interaction.editReply('Deleting channel...');
                        await channel.delete();
                        tempDb.get('activeChannels').remove({ id: channel.id }).write();
                    }

                } catch (error) {
                    console.error('Temp Action Error:', error);
                    await interaction.editReply('An error occurred while performing this action.');
                }
            }
        }

        // --- MODALS SUBMIT (TEMP VOICE) ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('temp_modal_')) {
            const action = interaction.customId;
            const channel = interaction.channel;

            if (action === 'temp_modal_name') {
                const name = interaction.fields.getTextInputValue('new_name');
                await channel.setName(name);
                interaction.reply({ content: `✅ Channel renamed to **${name}**`, ephemeral: true });
            }

            if (action === 'temp_modal_limit') {
                let limit = parseInt(interaction.fields.getTextInputValue('new_limit'));
                if (isNaN(limit) || limit < 0 || limit > 99) limit = 0;
                await channel.setUserLimit(limit);
                interaction.reply({ content: `✅ User limit set to **${limit === 0 ? 'Unlimited' : limit}**`, ephemeral: true });
            }

            if (action === 'temp_modal_permit') {
                const targetId = interaction.fields.getTextInputValue('target_id');
                try {
                    await channel.permissionOverwrites.create(targetId, { Connect: true, ViewChannel: true });
                    interaction.reply({ content: `✅ <@${targetId}> is now trusted.`, ephemeral: true });
                } catch (e) { interaction.reply({ content: 'Invalid ID or User not found.', ephemeral: true }); }
            }

            if (action === 'temp_modal_kick') {
                const targetId = interaction.fields.getTextInputValue('target_id');
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member && member.voice.channelId === channel.id) {
                    await member.voice.disconnect();
                    interaction.reply({ content: `🚫 <@${targetId}> has been kicked from the voice channel.`, ephemeral: true });
                } else {
                    interaction.reply({ content: 'User not found in this channel.', ephemeral: true });
                }
            }

            if (action === 'temp_modal_transfer') {
                const targetId = interaction.fields.getTextInputValue('target_id');
                const tempDb = low(new FileSync('data/tempvoice.json'));

                // Update DB
                tempDb.get('activeChannels').find({ id: channel.id }).assign({ ownerId: targetId }).write();

                // Update Permissions
                await channel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: null, MoveMembers: null }); // Remove old owner perms
                await channel.permissionOverwrites.edit(targetId, { ManageChannels: true, MoveMembers: true, Connect: true }); // Give new owner

                interaction.reply({ content: `👑 Ownership transferred to <@${targetId}>.` });
            }
        }
        // --- SUGGESTION BUTTONS & FEEDBACK ---
        if (interaction.isButton()) {
            // Check for Suggestion/Feedback IDs
            if (interaction.customId.startsWith('rate_feedback_') || interaction.customId === 'accept_suggestion' || interaction.customId === 'reject_suggestion') {
                const lang = require('../utils/lang')[settings.language || 'en']; // Load lang

                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    // Start feedback rating does not need admin, but accept/reject does.
                    // The original code checked admin for ALL suggestion buttons.
                    // However, rate_feedback is for the user who got support?
                    // Let's look at the logic:
                    if (interaction.customId !== 'accept_suggestion' && interaction.customId !== 'reject_suggestion' && !interaction.customId.startsWith('rate_feedback_')) {
                        return interaction.reply({ content: 'Only Administrators can manage suggestions.', ephemeral: true });
                    }
                }

                const { customId } = interaction;
                const message = interaction.message;
                const embed = message.embeds[0];

                // Safety check
                if (!embed) return interaction.reply({ content: 'Embed not found.', ephemeral: true });

                const userId = embed.footer && embed.footer.text.includes('ID:') ? embed.footer.text.split('ID: ')[1] : null;

                if (customId.startsWith('rate_feedback_')) {
                    // Verify ownership (User mentioned in message content)
                    const mentionedUser = message.mentions.users.first();
                    if (!mentionedUser || mentionedUser.id !== interaction.user.id) {
                        return interaction.reply({ content: 'This is not your feedback session.', ephemeral: true });
                    }

                    const rating = parseInt(customId.split('_')[2]);
                    const content = embed.description;

                    // Delete the rating request message
                    await message.delete().catch(() => { });

                    // Increment Stats
                    db.update('stats.totalFeedbacks', n => n + 1).write();

                    if (settings.feedbackMode === 'image') {
                        const buffer = await canvasGenerator.generateFeedbackImage(interaction.user, content, rating, settings.feedbackImage);
                        const attachment = new AttachmentBuilder(buffer, { name: 'feedback.png' });
                        await interaction.channel.send({ files: [attachment] });
                    } else {
                        const fullStar = '⭐';
                        const starStr = fullStar.repeat(rating);

                        const finalEmbed = new EmbedBuilder()
                            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                            .setDescription(content)
                            .addFields({ name: lang.feedback_rating_title, value: `${starStr} (${rating}/5)` })
                            .setColor(settings.colors.primary || '#5865F2')
                            .setFooter({ text: lang.feedback_footer })
                            .setTimestamp();

                        await interaction.channel.send({ embeds: [finalEmbed] });
                    }
                    return; // Stop processing
                }
                if (customId === 'accept_suggestion') {
                    // Check Admin for Accept/Reject
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({ content: 'Only Administrators can manage suggestions.', ephemeral: true });
                    }

                    db.update('stats.accepted', n => n + 1).write();

                    const newEmbed = EmbedBuilder.from(embed)
                        .setColor(settings.colors.success)
                        .setFooter({ text: `${lang.suggestion_accepted_by} ${interaction.user.tag}` })
                        .addFields({ name: 'Status', value: lang.suggestion_accepted });

                    await message.edit({ embeds: [newEmbed], components: [] });
                    await interaction.reply({ content: lang.suggestion_accepted, ephemeral: true });

                    if (userId) {
                        const user = await client.users.fetch(userId).catch(() => null);
                        if (user) user.send({ content: `${lang.suggestion_dm_accepted} ${message.url}` }).catch(() => { });
                    }

                } else if (customId === 'reject_suggestion') {
                    // Check Admin
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({ content: 'Only Administrators can manage suggestions.', ephemeral: true });
                    }

                    const modal = new ModalBuilder()
                        .setCustomId(`reject_modal_${message.id}`) // Pass Message ID here
                        .setTitle(lang.btn_reject);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('reject_reason')
                        .setLabel(lang.suggestion_reason)
                        .setStyle(TextInputStyle.Paragraph);

                    const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(firstActionRow);

                    await interaction.showModal(modal);
                }
            }
        } // End of isButton

        // --- COLOR ROLE SELECT ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'color_role_select') {
            try {
                await interaction.deferReply({ flags: 64 }); // ephemeral flag
            } catch (deferErr) {
                console.error('Color select defer error (interaction expired):', deferErr.message);
                return; // Interaction timed out, silently exit
            }
            try {
                const value = interaction.values[0]; // format: color_#HEX_Name
                const parts = value.split('_');
                const hex = parts[1];
                const name = parts.slice(2).join(' '); // Handle names with spaces
                const roleName = name; // Just use the color name as role name

                const guild = interaction.guild;
                const member = interaction.member;

                // Known color names list
                const knownColors = ['Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'Orange', 'Purple', 'Pink', 'Lime', 'Teal', 'Lavender', 'Brown', 'Beige', 'Maroon', 'Mint', 'Olive', 'Coral', 'Navy', 'Grey', 'White', 'Black', 'Gold', 'Silver'];

                // Remove previous color roles (check against known color names)
                const rolesToRemove = member.roles.cache.filter(r => {
                    if (r.name === roleName) return false; // Don't remove the one we're adding
                    return knownColors.includes(r.name); // Remove if it's a known color role
                });

                if (rolesToRemove.size > 0) {
                    await member.roles.remove(rolesToRemove);
                }

                // Check if role exists, create if not
                let role = guild.roles.cache.find(r => r.name === roleName);
                if (!role) {
                    role = await guild.roles.create({
                        name: roleName,
                        color: parseInt(hex.replace('#', ''), 16), // Fix deprecation: use number
                        reason: 'Color Role System'
                    });
                }

                // Add new role
                await member.roles.add(role);

                // Get user count for this role
                const userCount = role.members.size;

                // Simple confirmation embed (no avatar to avoid network errors)
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('🎨 Color Updated!')
                    .setDescription(`You now have the **${roleName}** color.\n\n**${userCount}** users share this color.`)
                    .setColor(hex);

                await interaction.editReply({ embeds: [confirmEmbed] });

                // --- AUTO-UPDATE THE ORIGINAL MESSAGE ---
                try {
                    const originalMessage = interaction.message;
                    if (originalMessage && originalMessage.embeds.length > 0) {
                        // Get all colors from the select menu options
                        const selectMenu = originalMessage.components[0]?.components[0];
                        if (selectMenu && selectMenu.options) {
                            const colors = selectMenu.options.map(opt => {
                                const optParts = opt.value.split('_');
                                return {
                                    name: optParts.slice(2).join(' '),
                                    hex: optParts[1]
                                };
                            });

                            // Generate updated overview image
                            const imageBuffer = await canvasGenerator.generateColorOverview(colors, guild);
                            const attachment = new AttachmentBuilder(imageBuffer, { name: 'colors.png' });

                            // Recreate embed with updated image
                            const oldEmbed = originalMessage.embeds[0];
                            const updatedEmbed = new EmbedBuilder()
                                .setTitle(oldEmbed.title || 'Color Roles')
                                .setDescription(oldEmbed.description || 'Select a color below.')
                                .setColor(oldEmbed.color || 0xFFFFFF)
                                .setImage('attachment://colors.png');

                            await originalMessage.edit({ embeds: [updatedEmbed], files: [attachment] });
                        }
                    }
                } catch (updateErr) {
                    console.error('Failed to update color panel:', updateErr);
                    // Don't fail the whole interaction if update fails
                }

            } catch (err) {
                console.error('Color Role Error:', err);
                await interaction.editReply({ content: '❌ Failed to assign color: ' + err.message });
            }
            return; // Stop further processing
        }

        // --- RULES MENU ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rule_select_')) {
            const ruleId = interaction.customId.split('_')[2];
            // Value format: rule_opt_ID_INDEX
            const selectedValue = interaction.values[0];
            const parts = selectedValue.split('_');
            const index = parseInt(parts[3]);

            const rules = db.get('rules').value() || [];
            const rule = rules.find(r => r.id === ruleId);

            if (!rule) {
                return interaction.reply({ content: 'Rule not found.', ephemeral: true });
            }

            if (rule.advancedOptions && rule.advancedOptions[index]) {
                const option = rule.advancedOptions[index];

                // Check for Nested Menu
                if (option.type === 'nested' && option.subOptions && option.subOptions.length > 0) {
                    const subMenu = new StringSelectMenuBuilder()
                        .setCustomId(`rule_sub_${ruleId}_${index}`)
                        .setPlaceholder('Select a sub-option...')
                        .addOptions(option.subOptions.map((sub, i) => ({
                            label: sub.label.substring(0, 100),
                            value: `rule_sub_val_${i}`,
                            description: sub.description ? sub.description.substring(0, 100) : undefined // Ensure description exists if mapped
                        })));

                    return interaction.reply({
                        content: option.description || 'Please select a specific option below:',
                        components: [new ActionRowBuilder().addComponents(subMenu)],
                        ephemeral: true
                    });
                }

                // Standard Reply
                const embed = new EmbedBuilder()
                    .setTitle(option.label)
                    .setDescription(option.description || 'No description provided.')
                    .setColor(rule.color || '#5865F2');

                // If response text exists, maybe add it?
                // The frontend has 'response' field for 'reply' type.
                if (option.response) {
                    embed.setDescription(option.response);
                }

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                return interaction.reply({ content: 'Option details not found.', ephemeral: true });
            }
        }

        // --- RULES SUB-MENU ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rule_sub_')) {
            const parts = interaction.customId.split('_');
            const ruleId = parts[2];
            const optionIndex = parseInt(parts[3]);

            const selectedVal = interaction.values[0]; // rule_sub_val_INDEX
            const subIndex = parseInt(selectedVal.split('_')[3]);

            const rules = db.get('rules').value() || [];
            const rule = rules.find(r => r.id === ruleId);

            if (rule && rule.advancedOptions && rule.advancedOptions[optionIndex]) {
                const option = rule.advancedOptions[optionIndex];
                if (option.subOptions && option.subOptions[subIndex]) {
                    const subOption = option.subOptions[subIndex];

                    const embed = new EmbedBuilder()
                        .setTitle(subOption.label)
                        .setDescription(subOption.response || 'No content.')
                        .setColor(rule.color || '#5865F2');

                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
            return interaction.reply({ content: 'Sub-option not found.', ephemeral: true });
        }

        // --- SUGGESTION REJECT MODAL ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('reject_modal_')) {
            const lang = require('../utils/lang')[settings.language || 'en'];
            const messageId = interaction.customId.split('_')[2];
            const channel = interaction.channel;

            try {
                const message = await channel.messages.fetch(messageId);
                if (!message) return interaction.reply({ content: 'Message not found.', ephemeral: true });

                const reason = interaction.fields.getTextInputValue('reject_reason');
                const embed = message.embeds[0];
                const userId = embed.footer.text.includes('ID:') ? embed.footer.text.split('ID: ')[1] : null;

                db.update('stats.rejected', n => n + 1).write();

                const newEmbed = EmbedBuilder.from(embed)
                    .setColor(settings.colors.danger)
                    .setFooter({ text: `${lang.suggestion_rejected_by} ${interaction.user.tag}` })
                    .addFields({ name: 'Status', value: lang.suggestion_rejected }, { name: lang.suggestion_reason, value: reason });

                await message.edit({ embeds: [newEmbed], components: [] });
                await interaction.reply({ content: lang.suggestion_rejected, ephemeral: true });

                if (userId) {
                    const user = await client.users.fetch(userId).catch(() => null);
                    if (user) user.send({ content: `${lang.suggestion_dm_rejected}\n**${lang.suggestion_reason}:** ${reason}` }).catch(() => { });
                }

            } catch (error) {
                console.error(error);
                if (!interaction.replied) interaction.reply({ content: 'Error updating suggestion.', ephemeral: true });
            }
        }
    }
};
