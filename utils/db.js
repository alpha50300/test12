const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);

// Set some defaults (required if your JSON file is empty)
db.defaults({
    stats: { totalSuggestions: 0, accepted: 0, rejected: 0, totalFeedbacks: 0 },
    settings: {
        feedbackMode: 'embed', // 'embed' or 'image'
        feedbackBg: null, // path to image
        suggestionsChannel: null,
        feedbackChannels: [],
        autoDeleteSuggestions: true,
        welcomeChannel: null,
        // Welcome Image Settings
        welcomeMode: 'image', // 'image', 'embed', or 'text'
        welcomeEmbed: {
            title: "Welcome {user}!",
            description: "Welcome to {server}. We now have {memberCount} members.",
            color: "#5865F2",
            buttons: [] // { label, url, style }
        },
        welcomeImage: {
            enabled: true,
            background: null,
            avatar: { x: 50, y: 50, size: 100 },
            username: { x: 170, y: 90, size: 36, color: '#ffffff' },
            text: { x: 170, y: 140, size: 28, color: '#ffffff' },
            footer: { x: 170, y: 180, size: 20, color: '#aaaaaa' }
        },
        // Feedback Image Settings
        feedbackImage: {
            enabled: true,
            background: null,
            avatar: { x: 50, y: 50, size: 100 },
            username: { x: 170, y: 90, size: 32, color: '#ffffff' },
            rating: { x: 170, y: 130, size: 40, color: '#ffd700' }, // Stars
            comment: { x: 50, y: 180, size: 24, color: '#ffffff' }
        },
        leaveChannel: null,
        colors: {
            primary: '#5865F2',
            success: '#57F287',
            danger: '#ED4245'
        },
        prefix: '!'
    },
    ai: {
        enabled: false,
        channelId: "",
        apiKey: "",
        systemPrompt: "You remain a helpful assistant."
    },
    rules: [], // Array of rules
    autoReplies: [], // Array of { trigger: string, response: string, id: string }
    logs: [], // Array of { action: string, date: string }
    commands: {} // Moderation command settings
}).write();

module.exports = db;
