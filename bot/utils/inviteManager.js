const { Collection, Events } = require('discord.js');
const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');

// In-memory cache for invites: GuildID -> Map<InviteCode, InviteObj>
const invitesCache = new Map();

module.exports = {
    // Initialize Cache
    init: async (client) => {
        // Wait for ready
        client.on(Events.ClientReady, async () => {
            console.log('[InviteManager] Caching invites...');
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const invites = await guild.invites.fetch();
                    invitesCache.set(guildId, new Map(invites.map(invite => [invite.code, invite.uses])));
                } catch (err) {
                    console.error(`[InviteManager] Failed to fetch invites for ${guild.name}:`, err);
                }
            }
        });

        // Listen for Invite Create
        client.on('inviteCreate', (invite) => {
            const guildInvites = invitesCache.get(invite.guild.id) || new Map();
            guildInvites.set(invite.code, invite.uses);
            invitesCache.set(invite.guild.id, guildInvites);
        });

        // Listen for Invite Delete
        client.on('inviteDelete', (invite) => {
            const guildInvites = invitesCache.get(invite.guild.id);
            if (guildInvites) {
                guildInvites.delete(invite.code);
            }
        });

        // Listen for Member Join (The core logic)
        client.on('guildMemberAdd', async (member) => {
            const guildInvites = invitesCache.get(member.guild.id);
            if (!guildInvites) return;

            try {
                const newInvites = await member.guild.invites.fetch();
                // Find the invite that incremented
                const usedInvite = newInvites.find(inv => {
                    const cachedUses = guildInvites.get(inv.code) || 0;
                    return inv.uses > cachedUses;
                });

                // Update Cache
                newInvites.each(inv => guildInvites.set(inv.code, inv.uses));
                invitesCache.set(member.guild.id, guildInvites);

                if (usedInvite && usedInvite.inviter) {
                    // Update DB
                    const adapter = new FileSync('data/invites.json');
                    const db = low(adapter);
                    db.defaults({ users: [] }).write();

                    const inviterId = usedInvite.inviter.id;
                    const userRecord = db.get('users').find({ id: inviterId }).value();

                    if (userRecord) {
                        db.get('users').find({ id: inviterId })
                            .assign({
                                real: (userRecord.real || 0) + 1,
                                total: (userRecord.total || 0) + 1,
                                lastUpdated: Date.now()
                            })
                            .write();
                    } else {
                        db.get('users').push({
                            id: inviterId,
                            real: 1,
                            fake: 0,
                            leave: 0,
                            total: 1,
                            lastUpdated: Date.now()
                        }).write();
                    }

                    console.log(`[InviteManager] ${member.user.tag} joined via ${usedInvite.inviter.tag} (${usedInvite.code})`);
                }
            } catch (err) {
                console.error('[InviteManager] Error processing join:', err);
            }
        });

        // Listen for Member Leave (Optional: Increment 'leave' count)
        // client.on('guildMemberRemove', ...) 
        // We'll skip complex leave tracking for now to keep it simple unless requested.
    }
};
