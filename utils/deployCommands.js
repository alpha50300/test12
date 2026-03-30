const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

const commands = [];
const commandsPath = path.join(__dirname, '../commands');

// Ensure commands directory exists
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const rest = new REST().setToken(config.bot.token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // Use applicationGuildCommands for instant update in specific guild (dev)
        // Use applicationCommands for global updates (cached for 1hr)

        // For now, let's use global if no guildId, or guild specific if provided
        if (config.bot.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${commands.length} guild application (/) commands.`);
        } else {
            await rest.put(
                Routes.applicationCommands(config.bot.clientId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${commands.length} global application (/) commands.`);
        }

    } catch (error) {
        console.error(error);
    }
})();
