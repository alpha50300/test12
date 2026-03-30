module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        const db = client.db;
        const settings = db.get('settings').value();

        if (settings.leaveChannel) {
            const channel = member.guild.channels.cache.get(settings.leaveChannel);
            if (channel) {
                let msg = settings.leaveMessage || '{user} has left the server.';
                msg = msg.replace(/{user}/g, member.user.tag)
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{memberCount}/g, member.guild.memberCount);

                channel.send({ content: msg }).catch(console.error);
            }
        }
    }
};
