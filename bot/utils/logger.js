const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Use a singleton approach or re-instantiate if needed
// Since lowdb sync writes synchronously, instantiation is cheap.
const adapter = new FileSync('db.json');
const db = low(adapter);

// Ensure logs array exists
db.defaults({ logs: [] }).write();

/**
 * Logs an action to the database.
 * @param {string} type - The type of event (e.g., 'Message', 'Voice', 'User', 'Member')
 * @param {string} action - Brief description (e.g., 'Delete', 'Join', 'Update')
 * @param {string} user - User tag or 'System'
 * @param {string} details - Detailed description of the event
 * @param {string} icon - Optional FontAwesome icon class (e.g., 'fas fa-trash')
 * @param {string} color - Optional color hex (e.g., '#ff0000')
 */
function logEvent(type, action, user, details, icon = 'fas fa-info-circle', color = '#ffffff') {
    try {
        // Reload DB to get latest state before writing
        db.read();

        db.get('logs')
            .push({
                type,
                action,
                user,
                details,
                icon,
                color,
                date: Date.now()
            })
            .write();

        // Optional: Trim logs if too large (keep last 1000?)
        const logCount = db.get('logs').size().value();
        if (logCount > 1000) {
            db.get('logs').shift().write();
        }

    } catch (err) {
        console.error('Failed to write log:', err);
    }
}

module.exports = { logEvent };
