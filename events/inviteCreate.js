const inviteTracker = require('../utils/inviteTracker');

module.exports = {
    name: 'inviteCreate',
    execute(invite, client) {
        inviteTracker.updateCache(invite.guild);
    }
};
