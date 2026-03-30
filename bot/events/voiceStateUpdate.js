const { Events, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');

const adapter = new FileSync('data/tempvoice.json');
const db = low(adapter);

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        // Reload DB
        db.read();
        const settings = db.get('settings').value();

        // --- 0. LOGGING ---
        const { logEvent } = require('../utils/logger');
        try {
            const member = newState.member || oldState.member;
            if (member && !member.user.bot) {
                // Join
                if (!oldState.channelId && newState.channelId) {
                    logEvent('Voice', 'Join', member.user.tag, `Joined voice channel: ${newState.channel.name}`, 'fas fa-microphone', '#57F287');
                }
                // Leave
                else if (oldState.channelId && !newState.channelId) {
                    logEvent('Voice', 'Leave', member.user.tag, `Left voice channel: ${oldState.channel.name}`, 'fas fa-microphone-slash', '#ED4245');
                }
                // Move
                else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                    logEvent('Voice', 'Move', member.user.tag, `Moved: ${oldState.channel.name} ➔ ${newState.channel.name}`, 'fas fa-exchange-alt', '#5865F2');
                }
            }
        } catch (logErr) {
            console.error('Voice Log Error:', logErr);
        }

        // --- 1. JOIN TRIGGER ---
        if (newState.channelId === settings.triggerChannelId && oldState.channelId !== settings.triggerChannelId) {
            const member = newState.member;

            // Name Pattern
            let channelName = settings.defaultName.replace('{user}', member.user.username);

            try {
                // Create Voice Channel
                const newChannel = await newState.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: settings.categoryId,
                    userLimit: settings.defaultLimit,
                    permissionOverwrites: [
                        {
                            id: newState.guild.id,
                            allow: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: member.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.Connect,
                                PermissionsBitField.Flags.Speak,
                                PermissionsBitField.Flags.ManageChannels,
                                PermissionsBitField.Flags.ManageRoles,
                                PermissionsBitField.Flags.MoveMembers,
                                PermissionsBitField.Flags.MuteMembers,
                                PermissionsBitField.Flags.DeafenMembers,
                                PermissionsBitField.Flags.PrioritySpeaker,
                                PermissionsBitField.Flags.Stream
                            ]
                        }
                    ]
                });

                // Move Member
                await member.voice.setChannel(newChannel);

                // Save to DB
                db.get('activeChannels').push({
                    id: newChannel.id,
                    ownerId: member.id,
                    createdAt: Date.now(),
                    isLocked: false
                }).write();

                // Send Control Panel
                const embed = new EmbedBuilder()
                    .setTitle('🔊 Voice Control Panel')
                    .setDescription(`Welcome to your temporary channel <@${member.id}>!\nUse the buttons below to manage your room.`)
                    .setColor('#5865F2')
                    .setThumbnail(member.user.displayAvatarURL());

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('temp_edit_name').setLabel('Rename').setStyle(2).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('temp_limit').setLabel('Limit').setStyle(2).setEmoji('👥'),
                    new ButtonBuilder().setCustomId('temp_lock').setLabel('Lock/Unlock').setStyle(2).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('temp_hide').setLabel('Hide/Show').setStyle(2).setEmoji('👁️')
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('temp_permit').setLabel('Trust User').setStyle(1).setEmoji('🤝'),
                    new ButtonBuilder().setCustomId('temp_kick').setLabel('Kick User').setStyle(4).setEmoji('🚫'),
                    new ButtonBuilder().setCustomId('temp_transfer').setLabel('Transfer Owner').setStyle(2).setEmoji('👑'),
                    new ButtonBuilder().setCustomId('temp_delete').setLabel('Delete').setStyle(4).setEmoji('❌')
                );

                // Send to the *Text Chat* of the voice channel?
                // Voice channels have text now.
                await newChannel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row1, row2] });

            } catch (err) {
                console.error('TempVoice Error:', err);
            }
        }

        // --- 2. LEAVE / EMPTY CHECK ---
        if (oldState.channelId && oldState.channelId !== settings.triggerChannelId) {
            const channel = oldState.channel;
            if (!channel) return; // Fix: Ensure channel exists in cache

            const channelData = db.get('activeChannels').find({ id: channel.id }).value();

            if (channelData) {
                // If empty
                if (channel.members.size === 0) {
                    setTimeout(async () => {
                        // Check again
                        const fetchedChannel = await client.channels.fetch(channel.id).catch(() => null);
                        if (fetchedChannel && fetchedChannel.members.size === 0) {
                            await fetchedChannel.delete().catch(() => { });
                            db.get('activeChannels').remove({ id: channel.id }).write();
                        }
                    }, 3000); // 3 Seconds
                }
            }
        }
    }
};
