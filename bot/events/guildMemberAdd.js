module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const db = client.db;
        db.read(); // Ensure fresh settings
        const settings = db.get('settings').value();

        // --- Jail Check ---
        const jailManager = require('../utils/jailManager');
        const isJailed = jailManager.isJailed(client, member.id);

        if (isJailed) {
            // Re-apply Jail Role
            const settings = db.get('settings').value();
            if (settings.jailRole) {
                try {
                    const jailRole = member.guild.roles.cache.get(settings.jailRole);
                    if (jailRole) {
                        await member.roles.add(jailRole);
                        // Ensure other roles are removed if they got any auto-assigned by Discord integration (unlikely but safe)
                        // Actually, we should SKIP auto-roles below if jailed.
                    }
                } catch (e) {
                    console.error('Failed to re-apply jail role:', e);
                }
            }
            return; // Skip Welcome & Auto-Roles
        }

        // --- Auto Roles ---
        try {
            const roleIds = member.user.bot ? settings.welcomeRolesBot : settings.welcomeRolesMember;
            if (roleIds && roleIds.length > 0) {
                // Filter out invalid roles or roles the bot can't assign (though Discord.js usually handles errors)
                // We just attempt to add valid ones
                const validRoles = roleIds.filter(id => member.guild.roles.cache.has(id));
                if (validRoles.length > 0) {
                    await member.roles.add(validRoles).catch(err => console.error(`Failed to assign auto-roles to ${member.user.tag}:`, err));
                }
            }
        } catch (err) {
            console.error('Auto-Role Error:', err);
        }

        const inviteTracker = require('../utils/inviteTracker');

        if (settings.welcomeChannel) {
            // Support Array or String
            const channels = Array.isArray(settings.welcomeChannel) ? settings.welcomeChannel : [settings.welcomeChannel];

            for (const channelId of channels) {
                if (!channelId) continue;
                const channel = member.guild.channels.cache.get(channelId);
                if (!channel) continue;

                // Resolve inviter
                let inviter = null;
                try {
                    const tracker = require('../utils/inviteTracker');
                    const possibleInviter = await tracker.getInviter(member);
                    if (possibleInviter) {
                        inviter = possibleInviter;
                    }
                } catch (e) {
                    console.error('Error fetching inviter:', e);
                }

                const inviterMention = inviter ? inviter.toString() : 'Unknown';
                const inviterName = inviter ? inviter.tag : 'Unknown';
                const inviterCount = inviter ? (await member.guild.invites.fetch().then(is => is.filter(i => i.inviter && i.inviter.id === inviter.id).reduce((a, b) => a + b.uses, 0)).catch(() => 0)) : 0;

                // Replacements Helper
                const replaceVars = (str) => {
                    if (!str) return '';
                    let s = str;
                    const replacements = {
                        '\\[user\\]': member.toString(),
                        '\\[userName\\]': member.user.username,
                        '\\[memberCount\\]': member.guild.memberCount,
                        '\\[server\\]': member.guild.name,
                        '\\[inviter\\]': inviterMention,
                        '\\[inviterName\\]': inviterName,
                        '\\[invites\\]': inviterCount,
                        '{user}': member.toString(),
                        '{server}': member.guild.name,
                        '{memberCount}': member.guild.memberCount
                    };
                    for (const [key, value] of Object.entries(replacements)) {
                        s = s.replace(new RegExp(key, 'g'), value);
                    }
                    return s;
                };

                const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const canvasGenerator = require('../utils/canvasGenerator');
                const mode = settings.welcomeMode || 'image';

                try {
                    if (mode === 'image') {
                        const buffer = await canvasGenerator.generateWelcomeImage(member, settings.welcomeImage || {});
                        const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
                        const content = replaceVars(settings.welcomeMessage || '');
                        await channel.send({ content: content || undefined, files: [attachment] });

                    } else if (mode === 'embed') {
                        const embedData = settings.welcomeEmbed || {};
                        const embed = new EmbedBuilder()
                            .setTitle(replaceVars(embedData.title))
                            .setDescription(replaceVars(embedData.description))
                            .setColor(embedData.color || '#5865F2');

                        if (member.user.displayAvatarURL()) {
                            embed.setThumbnail(member.user.displayAvatarURL());
                        }

                        const components = [];
                        if (embedData.buttons && embedData.buttons.length > 0) {
                            const row = new ActionRowBuilder();
                            embedData.buttons.forEach((btn, i) => {
                                if (i >= 5) return;
                                let style = ButtonStyle.Link;
                                if (btn.style === 'Primary') style = ButtonStyle.Primary;
                                else if (btn.style === 'Secondary') style = ButtonStyle.Secondary;
                                else if (btn.style === 'Success') style = ButtonStyle.Success;
                                else if (btn.style === 'Danger') style = ButtonStyle.Danger;

                                const button = new ButtonBuilder()
                                    .setLabel(btn.label || 'Button')
                                    .setStyle(style);

                                if (style === ButtonStyle.Link) {
                                    button.setURL(btn.url || 'https://discord.com');
                                } else {
                                    button.setCustomId(`welcome_btn_${i}`);
                                }
                                row.addComponents(button);
                            });
                            components.push(row);
                        }

                        await channel.send({ embeds: [embed], components });

                    } else {
                        channel.send({ content: replaceVars(settings.welcomeMessage || 'Welcome!') });
                    }
                } catch (err) {
                    console.error(`Error sending welcome to ${channel.name}:`, err);
                }
            } // End Loop
        }
    }
};
