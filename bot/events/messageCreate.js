const { Events, EmbedBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../utils/canvasGenerator');
const gamesList = require('../utils/gamesList');
const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');
const adapter = new FileSync('data/automod.json');
const db = low(adapter);

// Simple Spam Cache
const spamCache = new Map(); // Map<userId, {count, lastMsgTime}>

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Reload DB to get fresh settings (or move to client buffer if performance issue)
        db.read();
        const settings = db.value();
        const member = message.member;

        // --- 1. Global Blacklist Check (Ignored Channels/Roles) ---
        if (settings.ignoredChannels && settings.ignoredChannels.includes(message.channel.id)) return;
        if (settings.ignoredRoles && member && member.roles.cache.some(r => settings.ignoredRoles.includes(r.id))) return;

        // --- 2. Check Exemptions (For AutoMod only) ---
        let isAutoModIgnored = false;
        // if (settings.ignoredChannels.includes(message.channel.id)) isAutoModIgnored = true; // Handled globally now

        // Admin bypass AutoMod but NOT Global Blacklist (unless we want admins to bypass blacklist too? User said "everything" gets deleted)
        // Usually blacklist prevents bot from responding even to admins if explicitly set. 
        // But let's check: "if I click on room name it gets deleted in everything... commands everything... blacklist administrative commands everything"
        // So yes, return early.

        if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) isAutoModIgnored = true; // Admin bypass AutoMod

        // Skip AutoMod if ignored, but allow Commands/AI to proceed (unless globally ignored above)


        // --- AutoMod Warning Cooldown ---
        if (!client.warningCooldowns) client.warningCooldowns = new Map();

        // --- 2. Bad Words ---
        if (settings.badwords.enabled) {
            const content = message.content.toLowerCase();
            const foundWord = settings.badwords.words.find(word => content.includes(word.toLowerCase()));

            if (foundWord) {
                await performAction(message, settings.badwords.action, 'Bad Words Detected', client);
                return;
            }
        }

        // --- 3. Anti-Invite ---
        if (settings.invites.enabled) {
            const inviteRegex = /(discord.gg\/|discord.com\/invite\/)/i;
            if (inviteRegex.test(message.content)) {
                await performAction(message, settings.invites.action, 'Discord Invite Detected', client);
                return;
            }
        }

        // --- 4. Link Filter ---
        if (settings.links.enabled) {
            const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
            if (linkRegex.test(message.content)) {
                // Check Whitelist
                const isWhitelisted = settings.links.whitelist.some(domain => message.content.includes(domain));
                if (!isWhitelisted) {
                    await performAction(message, settings.links.action, 'Unauthorized Link Detected', client);
                    return;
                }
            }
        }

        // --- 5. Mass CAPS ---
        if (settings.caps.enabled && message.content.length > 10) {
            const capsCount = message.content.replace(/[^A-Z]/g, "").length;
            const percentage = (capsCount / message.content.length) * 100;

            if (percentage >= settings.caps.percentage) {
                await performAction(message, settings.caps.action, 'Excessive Caps Detected', client);
                return;
            }
        }

        // --- 6. Mass Mentions ---
        if (settings.mentions.enabled) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount >= settings.mentions.threshold) {
                await performAction(message, settings.mentions.action, 'Mass Mention Detected', client);
                return;
            }
        }

        // --- 7. Spam Detection ---
        if (settings.spam.enabled) {
            const now = Date.now();
            const userData = spamCache.get(message.author.id) || { count: 0, lastMsgTime: now };

            if (now - userData.lastMsgTime < 5000) { // 5 Seconds Window
                userData.count++;
                userData.lastMsgTime = now;
            } else {
                userData.count = 1;
                userData.lastMsgTime = now;
            }

            spamCache.set(message.author.id, userData);

            if (userData.count >= settings.spam.threshold) {
                await performAction(message, settings.spam.action, 'Spam Detected', client);
                spamCache.delete(message.author.id); // Reset
                return;
            }
        }



        // --- 7.5 Auto Line System ---
        // Use main DB for AutoLine settings
        if (client.db) client.db.read(); // Ensure fresh data
        const mainSettings = client.db ? client.db.get('settings').value() : {};

        if (mainSettings.autoLineEnabled && mainSettings.autoLines && mainSettings.autoLines.length > 0) {
            const lineConfig = mainSettings.autoLines.find(l => l.channelId === message.channel.id);
            if (lineConfig && lineConfig.imageUrl) {
                // Send line image
                await message.channel.send({ content: lineConfig.imageUrl }).catch(e => console.error("Failed to send AutoLine:", e));
            }
        }


        // --- 7.6 Auto Reaction System ---
        if (client.db) client.db.read(); // Ensure fresh
        const autoReactions = client.db ? (client.db.get('autoReactions').value() || []) : [];

        const arConfig = autoReactions.find(ar => ar.channelId === message.channel.id);
        if (arConfig && arConfig.emojis && arConfig.emojis.length > 0) {
            // React with all emojis
            for (const emoji of arConfig.emojis) {
                try {
                    await message.react(emoji);
                } catch (e) {
                    console.error(`Failed to react with ${emoji} in ${message.channel.name}:`, e);
                }
            }
        }

        // --- 8. Auto-Replies ---
        // Load from main DB (passed via client.db or read fresh)
        // Since we are separated, let's try to read key 'autoReplies' from main DB file if possible
        // Or assume client.db is available and updated.
        // client.db is set in index.js, but lowdb instances might not sync automatically if updated via web.
        // Ideally we re-read. For now let's try to trust client.db or re-read if needed.
        // To be safe, let's read the main db.json here.

        // Use shared DB to avoid conflicts
        const mainDb = client.db;
        mainDb.read(); // Ensure fresh data
        const autoReplies = mainDb.get('autoReplies').value() || [];

        // Fix: Allow execution even if no auto-replies
        if (true) {
            const content = message.content;
            const contentLower = content.toLowerCase();

            for (const reply of autoReplies) {
                let match = false;
                const trigger = reply.trigger;
                const mode = reply.matchMode || 'contains';

                if (mode === 'exact') {
                    if (content === trigger || contentLower === trigger.toLowerCase()) match = true;
                } else if (mode === 'startswith') {
                    if (contentLower.startsWith(trigger.toLowerCase())) match = true;
                } else {
                    // Contains (Fuzzy-ish)
                    if (contentLower.includes(trigger.toLowerCase())) match = true;
                }

                if (match) {
                    // --- Check Filters ---
                    // Channels
                    if (reply.allowedChannels && reply.allowedChannels.length > 0) {
                        if (!reply.allowedChannels.includes(message.channel.id)) continue; // Skip if channel not allowed
                    }

                    // Roles
                    if (reply.allowedRoles && reply.allowedRoles.length > 0) {
                        const hasRole = message.member.roles.cache.some(r => reply.allowedRoles.includes(r.id));
                        if (!hasRole) continue; // Skip if user doesn't have allowed role
                    }

                    // Process Placeholders
                    let responseText = reply.response;

                    // [user] -> Mention
                    responseText = responseText.replace(/\[user\]/g, `<@${message.author.id}>`);

                    // [userName] -> Name
                    responseText = responseText.replace(/\[userName\]/g, message.author.username);

                    // [server] -> Server Name
                    responseText = responseText.replace(/\[server\]/g, message.guild.name);

                    // [invites] -> Async fetch
                    if (responseText.includes('[invites]')) {
                        try {
                            const invites = await message.guild.invites.fetch();
                            const userInvites = invites.filter(i => i.inviter && i.inviter.id === message.author.id);
                            const count = userInvites.reduce((acc, inv) => acc + inv.uses, 0);
                            responseText = responseText.replace(/\[invites\]/g, count.toString());
                        } catch (e) {
                            responseText = responseText.replace(/\[invites\]/g, "0");
                        }
                    }

                    // Send Response
                    try {
                        if (reply.replyMode === 'reply') {
                            await message.reply({ content: responseText, allowedMentions: { repliedUser: true } });
                        } else {
                            await message.channel.send(responseText);
                        }
                    } catch (e) {
                        console.error('Failed to send auto-reply:', e);
                    }

                    // Stop after first match? Or continue? Usually stop.
                    break;
                }
            }

            // --- 8.5 Feedbacks ---
            const mainSettings = mainDb.get('settings').value() || {};
            const feedbackChannels = mainSettings.feedbackChannels || [];

            if (feedbackChannels.includes(message.channel.id)) {
                // Delete original message
                await message.delete().catch(() => { });

                const feedbackMode = mainSettings.feedbackMode || 'embed'; // Fixed Source
                const { ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require('discord.js');

                // Create Star Buttons
                const starButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('star_1').setLabel('⭐ 1').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('star_2').setLabel('⭐ 2').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('star_3').setLabel('⭐ 3').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('star_4').setLabel('⭐ 4').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('star_5').setLabel('⭐ 5').setStyle(ButtonStyle.Primary)
                );

                // Send Prompt
                const promptMsg = await message.channel.send({
                    content: `${message.author}, please select a rating for your feedback:`,
                    components: [starButtons]
                });

                // Collector
                const filter = i => i.user.id === message.author.id && i.customId.startsWith('star_');
                const collector = promptMsg.createMessageComponentCollector({ filter, time: 30000, max: 1, componentType: ComponentType.Button });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    const stars = parseInt(i.customId.split('_')[1]);

                    // Generate Final Feedback
                    try {
                        if (feedbackMode === 'image') {
                            const imageBuffer = await canvasGenerator.generateFeedbackImage(message.author, message.content, stars, mainSettings.feedbackImage);
                            const attachment = new AttachmentBuilder(imageBuffer, { name: 'feedback.png' });
                            const sent = await message.channel.send({ content: `**Feedback from ${message.author}**`, files: [attachment] });
                            await sent.react('❤️');
                            await sent.react('👎');
                        } else {
                            // Embed Mode
                            const starStr = '⭐'.repeat(stars);
                            const embed = new EmbedBuilder()
                                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                                .setDescription(`**Rating:** ${starStr}\n\n${message.content}`)
                                .setColor('#2b2d31')
                                .setFooter({ text: 'Feedback System' })
                                .setTimestamp();

                            const sent = await message.channel.send({ embeds: [embed] });
                            await sent.react('❤️');
                            await sent.react('👎');
                        }
                    } catch (err) {
                        console.error("Feedback Generation Error:", err);
                    }
                });

                collector.on('end', async collected => {
                    // Delete prompt
                    await promptMsg.delete().catch(() => { });
                    if (collected.size === 0) {
                        // Optional: notify timeout?
                    }
                });

                return; // Stop processing
            }

            // --- 8.6 Suggestions ---
            const suggestionsChannels = mainSettings.suggestionsChannels || [];
            if (suggestionsChannels.includes(message.channel.id)) {
                // Auto Delete?
                if (mainSettings.autoDeleteSuggestions !== false) { // Default true
                    await message.delete().catch(() => { });
                }

                const lang = require('../utils/lang')[mainSettings.language || 'en'];
                const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

                const embed = new EmbedBuilder()
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .setDescription(message.content)
                    .setColor('#FEE75C') // Yellowish for ideas
                    .setFooter({ text: `${lang.suggestion_footer} • ID: ${message.author.id}` }) // Store ID in footer
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('accept_suggestion').setLabel(lang.btn_accept).setStyle(ButtonStyle.Success).setEmoji('✅'),
                        new ButtonBuilder().setCustomId('reject_suggestion').setLabel(lang.btn_reject).setStyle(ButtonStyle.Danger).setEmoji('❌')
                    );

                try {
                    await message.channel.send({ embeds: [embed], components: [row] });
                } catch (err) {
                    console.error("Suggestion Error:", err);
                }
                return; // Stop processing
            }

            // --- 10. AI Chat (Mistral) ---
            const aiSettings = mainDb.get('ai').value();
            const lang = require('../utils/lang')[mainSettings.language || 'en']; // Load lang for AI errors

            if (aiSettings && aiSettings.enabled && aiSettings.channelId === message.channel.id) {
                await message.channel.sendTyping();

                try {
                    // Custom AI Response for Creator
                    const lowerContent = message.content.toLowerCase();
                    if (lowerContent.includes('مين الي عاملك') || lowerContent.includes('مين الي اخترعك') || lowerContent.includes('مين الي دربك')) {
                        await message.reply('[Roberto](https://discord.com/users/1289581696995561495) شكرا ليه تعب علي كتير و كده');
                        return;
                    }

                    const apiKey = aiSettings.apiKey;
                    if (!apiKey) {
                        console.warn('AI enabled but no API Key found.');
                        await message.reply(lang.ai_error_no_key);
                    } else {
                        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: "mistral-tiny",
                                messages: [
                                    { role: "system", content: aiSettings.systemPrompt || "You are a helpful assistant." },
                                    { role: "user", content: message.content }
                                ]
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error("AI API Error:", errorText);
                            await message.reply(`${lang.ai_error_server} ${response.status}.`);
                            return;
                        }

                        const data = await response.json();
                        if (data.choices && data.choices[0]) {
                            await message.reply({
                                content: data.choices[0].message.content,
                                allowedMentions: { repliedUser: false }
                            });
                            return; // Stop processing commands
                        } else {
                            console.error("Mistral API Error (No choices):", data);
                            await message.reply(lang.ai_error_invalid);
                        }
                    }
                } catch (error) {
                    console.error("AI Chat Error:", error);
                    await message.reply(lang.ai_error_connect);
                }
            }

            // --- 9. Command Handler ---
            const mainSettingsForPrefix = mainDb.get('settings').value() || {};
            const prefix = mainSettingsForPrefix.prefix || '!';
            const cmdLang = require('../utils/lang')[mainSettingsForPrefix.language || 'en'];

            // --- Auto React Logic ---
            const autoReactions = mainDb.get('autoReactions').value() || [];
            const channelReact = autoReactions.find(ar => ar.channelId === message.channel.id);
            if (channelReact && channelReact.emojis && channelReact.emojis.length > 0) {
                // React with all configured emojis
                channelReact.emojis.forEach(emoji => {
                    // Check if it's a custom emoji ID or unicode
                    // Simple try/catch block to avoid crashing on invalid emojis
                    message.react(emoji).catch(e => console.error(`Failed to react with ${emoji}:`, e.message));
                });
            }

            // Debug Log
            // console.log(`[Message] Content: ${message.content} | Prefix: ${prefix}`);

            if (!message.content.startsWith(prefix)) return;

            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            const commandsSettings = mainDb.get('commands').value() || {};

            // Helper to find command config
            let commandConfig = null;
            let finalCommand = null;


            // Check exact match or aliases
            for (const [key, config] of Object.entries(commandsSettings)) {
                if (key === commandName || (config.aliases && config.aliases.includes(commandName))) {
                    commandConfig = config;
                    finalCommand = key;
                    break;
                }
            }

            // --- Check Custom Jail Aliases ---
            const jailAliases = mainSettings.jailAliases || {};
            if (jailAliases.jail && jailAliases.jail.includes(commandName)) {
                finalCommand = 'jail';
                commandConfig = { enabled: mainSettings.jailEnabled !== false };
            }
            if (jailAliases.unjail && jailAliases.unjail.includes(commandName)) {
                finalCommand = 'unjail';
                commandConfig = { enabled: mainSettings.jailEnabled !== false };
            }

            // If not found in DB, check if it's a default command not yet saved?
            // For now, assume we rely on DB settings or hardcoded defaults if not in DB?
            // Better: Define the map of executable functions.

            // Check Enabled
            if (commandConfig && commandConfig.enabled === false) return; // Explicitly disabled

            // Check Permissions (Roles/Channels)
            if (commandConfig) {
                // Channel Blacklist (Denied Channels)
                if (commandConfig.deniedChannels && commandConfig.deniedChannels.length > 0) {
                    if (commandConfig.deniedChannels.includes(message.channel.id)) return; // Stop if channel is denied
                }
                /* Whitelist Logic Removed in favor of Blacklist as requested
                if (commandConfig.allowedChannels && commandConfig.allowedChannels.length > 0) {
                    if (!commandConfig.allowedChannels.includes(message.channel.id)) return;
                }
                */
                // Role Whitelist
                if (commandConfig.allowedRoles && commandConfig.allowedRoles.length > 0) {
                    const hasRole = message.member.roles.cache.some(r => commandConfig.allowedRoles.includes(r.id));
                    // Also Check Admin
                    if (!hasRole && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
                }
            }

            // Execute Command
            try {
                // Determine the command name to use in switch
                const commandToRun = finalCommand || commandName;

                switch (commandToRun) {
                    case 'ban':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
                        const userBan = message.mentions.members.first();
                        if (userBan) {
                            await userBan.ban({ reason: args.slice(1).join(' ') || 'No reason provided' });
                            message.reply(cmdLang.cmd_ban_success.replace('{user}', userBan.user.tag));
                        } else message.reply(cmdLang.cmd_ban_usage);
                        break;

                    case 'kick':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
                        const userKick = message.mentions.members.first();
                        if (userKick) {
                            await userKick.kick(args.slice(1).join(' ') || 'No reason provided');
                            message.reply(cmdLang.cmd_kick_success.replace('{user}', userKick.user.tag));
                        } else message.reply(cmdLang.cmd_kick_usage);
                        break;

                    case 'clear':
                    case 'purge':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
                        const amount = parseInt(args[0]);
                        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply(cmdLang.cmd_clear_usage);
                        await message.channel.bulkDelete(amount, true);
                        const msg = await message.channel.send(cmdLang.cmd_clear_success.replace('{amount}', amount));
                        setTimeout(() => msg.delete().catch(() => { }), 3000);
                        break;

                    case 'lock':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
                        message.reply(cmdLang.cmd_lock);
                        break;

                    case 'unlock':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
                        message.reply(cmdLang.cmd_unlock);
                        break;

                    case 'timeout':
                    case 'mute':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
                        const userTimeout = message.mentions.members.first();
                        const time = parseInt(args[1]); // minutes
                        if (userTimeout && time) {
                            await userTimeout.timeout(time * 60 * 1000, args.slice(2).join(' '));
                            message.reply(cmdLang.cmd_timeout_success.replace('{user}', userTimeout.user.tag).replace('{time}', time));
                        } else message.reply(cmdLang.cmd_timeout_usage);
                        break;

                    case 'untimeout':
                    case 'unmute':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
                        const userUnTimeout = message.mentions.members.first();
                        if (userUnTimeout) {
                            await userUnTimeout.timeout(null);
                            message.reply(cmdLang.cmd_untimeout_success.replace('{user}', userUnTimeout.user.tag));
                        }
                        break;

                    case 'role':
                        // !role @user @role
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
                        const targetMember = message.mentions.members.first();
                        const targetRole = message.mentions.roles.first();
                        if (targetMember && targetRole) {
                            if (targetMember.roles.cache.has(targetRole.id)) {
                                await targetMember.roles.remove(targetRole);
                                message.reply(cmdLang.cmd_role_remove.replace('{role}', targetRole.name).replace('{user}', targetMember.user.tag));
                            } else {
                                await targetMember.roles.add(targetRole);
                                message.reply(cmdLang.cmd_role_add.replace('{role}', targetRole.name).replace('{user}', targetMember.user.tag));
                            }
                        } else message.reply(cmdLang.cmd_role_usage);
                        break;

                    case 'hide':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                        await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
                        message.reply(cmdLang.cmd_hide);
                        break;

                    case 'show':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
                        await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: true });
                        message.reply(cmdLang.cmd_show);
                        break;

                    case 'setnick':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) return;
                        const userNick = message.mentions.members.first();
                        const newNick = args.slice(1).join(' ');
                        if (userNick) {
                            await userNick.setNickname(newNick);
                            message.reply(cmdLang.cmd_nick_success.replace('{user}', userNick.user.tag));
                        }
                        break;

                    case 'games':
                    case 'العاب':
                        // Use mainSettings which is already defined in the scope
                        const gamesLang = mainSettings.language || 'en';

                        const gameEmbed = new EmbedBuilder()
                            .setColor(mainSettings.colors?.primary || '#5865F2')
                            .setTitle(gamesLang === 'ar' ? '🎮 قائمة الألعاب' : '🎮 Games List')
                            .setThumbnail(message.guild.iconURL({ dynamic: true }));

                        let description = '';
                        gamesList.forEach(game => {
                            const cmd = gamesLang === 'en' ? game.commandEn : game.commandAr;
                            const name = game.name;
                            description += `**${name}**\n\`${prefix}${cmd}\`\n\n`;
                        });

                        gameEmbed.setDescription(description);
                        gameEmbed.setFooter({ text: gamesLang === 'ar' ? `استخدم ${prefix} قبل الأمر` : `Use ${prefix} before command` });

                        message.reply({ embeds: [gameEmbed] });
                        break;

                    case 'jail':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
                        const jailUser = message.mentions.members.first();
                        const timeStr = args[1]; // duration
                        const reason = args.slice(2).join(' ') || 'No reason provided';

                        // Parse duration
                        const duration = require('../commands/jail').parseDuration(timeStr);

                        if (jailUser && duration) {
                            const jailManager = require('../utils/jailManager');
                            await jailManager.jailUser(client, message.guild, jailUser, duration, reason, message.author);
                            message.reply(cmdLang.cmd_jail_success.replace('{user}', jailUser.user.tag).replace('{time}', timeStr));
                        } else {
                            message.reply(cmdLang.cmd_jail_usage);
                        }
                        break;

                    case 'unjail':
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
                        const unjailUser = message.mentions.members.first();

                        if (unjailUser) {
                            const jailManager = require('../utils/jailManager');
                            await jailManager.unjailUser(client, message.guild, unjailUser, unjailUser.id);
                            message.reply(cmdLang.cmd_unjail_success.replace('{user}', unjailUser.user.tag));
                        } else {
                            message.reply(cmdLang.cmd_unjail_usage);
                        }
                        break;
                }

                // Auto-delete user message if configured
                if (commandConfig && commandConfig.deleteAlias) {
                    setTimeout(() => message.delete().catch(() => { }), 1000);
                }

            } catch (error) {
                console.error('Command Error:', error);
                message.reply(cmdLang.cmd_error);
            }

        }
    }
};

async function performAction(message, action, reason, client) {
    if (!message.deletable) return;

    try {
        await message.delete().catch(() => { });

        // Check Cooldown
        const now = Date.now();
        const lastWarn = client.warningCooldowns.get(message.author.id);

        // If warned in last 5 seconds, Silent Delete (return early)
        if (lastWarn && (now - lastWarn) < 5000) {
            return;
        }

        // Set Cooldown
        client.warningCooldowns.set(message.author.id, now);

        // Clean up map eventually (optional, but good practice)
        setTimeout(() => client.warningCooldowns.delete(message.author.id), 10000);


        const embed = new EmbedBuilder()
            .setColor('#EF4444')
            .setTitle('🛡️ Auto Moderation')
            .setDescription(`**Reason:** ${reason}\n**User:** ${message.author}`)
            .setFooter({ text: 'Protection System' });

        const sentMsg = await message.channel.send({ embeds: [embed] });
        setTimeout(() => sentMsg.delete().catch(() => { }), 5000); // Auto delete alert

        if (action === 'timeout') {
            if (message.member.moderatable) {
                await message.member.timeout(60 * 1000 * 5, reason); // 5 Minutes
                logAction('Timeout', message.author.tag, `Reason: ${reason}`);
            }
        } else if (action === 'kick') {
            if (message.member.kickable) {
                await message.member.kick(reason);
                logAction('Kick', message.author.tag, `Reason: ${reason}`);
            }
        } else if (action === 'ban') {
            if (message.member.bannable) {
                await message.member.ban({ reason: reason });
                logAction('Ban', message.author.tag, `Reason: ${reason}`);
            }
        }
        // Action 'warn' is covered by the embed
        // Action 'delete' is covered by message.delete()

    } catch (err) {
        console.error('AutoMod Action Failed:', err);
    }
}

// Helper to log to DB
function logAction(action, user, details) {
    try {
        const adapter = new FileSync('db.json');
        const db = low(adapter);
        db.read(); // Force read
        db.get('logs')
            .push({
                action: action,
                user: user,
                details: details,
                date: Date.now()
            })
            .write();
    } catch (e) {
        console.error('Failed to write log:', e);
    }
}
