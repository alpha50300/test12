const inviteTracker = require('../utils/inviteTracker');

module.exports = {
    name: 'inviteDelete',
    execute(invite, client) {
        inviteTracker.updateCache(invite.guild);
    }
};
