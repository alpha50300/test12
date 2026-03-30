module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const db = client.db;
        const settings = db.get('settings').value();

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
            const channel = member.guild.channels.cache.get(settings.welcomeChannel);
            if (channel) {
                // Resolve inviter
                let inviter = null;
                try {
                    // Try to finding inviter from tracker
                    // We need to import the tracker. 
                    // Since it's a singleton, require it here or pass from client if attached.
                    // Ideally we should attach it to client, but requiring is fine.
                    const tracker = require('../utils/inviteTracker');
                    // We need to fetch invites to compare. Use the tracker's method.
                    // The tracker logic inside 'getInviter' compares cached vs new.
                    // BUT: 'getInviter' is async and needs to be called.
                    // Note: My previous step created inviteTracker with 'getInviter' method.
                    // However, we need to be careful about race conditions or if tracker isn't ready.
                    // Assuming tracker works:
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
                const mode = settings.welcomeMode || 'image'; // Default to image if not set

                try {
                    if (mode === 'image') {
                        // Image Mode
                        // We assume generateWelcomeImage returns a Buffer
                        // But wait, the existing generator might return a buffer or path?
                        // Let's check canvasGenerator view. It returns `canvas.toBuffer()`.
                        if (settings.welcomeImage && settings.welcomeImage.enabled) {
                            const buffer = await canvasGenerator.generateWelcomeImage(member, settings.welcomeImage);
                            const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

                            // Send text message too if configured? Usually just the image + optional text
                            // Let's us the 'welcomeMessage' as content if present, else just image.
                            const content = replaceVars(settings.welcomeMessage);
                            await channel.send({ content: content, files: [attachment] });
                        } else {
                            // Fallback to text if image disabled but mode is image (weird state)
                            channel.send({ content: replaceVars(settings.welcomeMessage || 'Welcome!') });
                        }

                    } else if (mode === 'embed') {
                        // Embed Mode
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
                                if (i >= 5) return; // Discord limit
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
                                    button.setCustomId(`welcome_btn_${i}`); // Non-link buttons need ID
                                }
                                row.addComponents(button);
                            });
                            components.push(row);
                        }

                        await channel.send({ embeds: [embed], components });

                    } else {
                        // Text Mode
                        channel.send({ content: replaceVars(settings.welcomeMessage || 'Welcome!') });
                    }
                } catch (err) {
                    console.error('Error sending welcome:', err);
                }

            }
        }
    }
};
