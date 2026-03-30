const { Collection } = require('discord.js');

const invites = new Collection();

module.exports = {
    /**
     * Initialize invites for valid guilds (must have manage guild permission)
     * @param {Client} client 
     */
    init: async (client) => {
        // Wait for a bit to ensure guilds are available
        await new Promise(r => setTimeout(r, 2000));

        client.guilds.cache.forEach(async guild => {
            // check permissions
            const me = guild.members.me;
            if (me && me.permissions.has('ManageGuild')) {
                try {
                    const guildInvites = await guild.invites.fetch();
                    invites.set(guild.id, new Collection(guildInvites.map((invite) => [invite.code, invite.uses])));
                } catch (e) {
                    console.log(`Failed to cache invites for ${guild.name}: ${e.message}`);
                }
            }
        });
    },

    /**
     * Get the invite that was used
     * @param {GuildMember} member 
     */
    getInviter: async (member) => {
        const guild = member.guild;
        const me = guild.members.me;
        if (!me || !me.permissions.has('ManageGuild')) return null;

        const cachedInvites = invites.get(guild.id);
        if (!cachedInvites) return null;

        try {
            const newInvites = await guild.invites.fetch();
            let usedInvite = null;

            // Find which invite count increased
            for (const [code, invite] of newInvites) {
                const oldUses = cachedInvites.get(code) || 0;
                if (invite.uses > oldUses) {
                    usedInvite = invite;
                    break;
                }
            }

            // Update cache
            invites.set(guild.id, new Collection(newInvites.map((invite) => [invite.code, invite.uses])));

            return usedInvite ? usedInvite.inviter : null;

        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Helper to update cache on invite (create/delete)
    updateCache: async (guild) => {
        const me = guild.members.me;
        if (me && me.permissions.has('ManageGuild')) {
            try {
                const guildInvites = await guild.invites.fetch();
                invites.set(guild.id, new Collection(guildInvites.map((invite) => [invite.code, invite.uses])));
            } catch (e) { console.error(e); }
        }
    }
};
