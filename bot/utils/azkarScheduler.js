const { EmbedBuilder } = require('discord.js');
const { readFileSync } = require('fs');
const path = require('path');

// Expanded Azkar/Hadith List
const defaultAzkar = [
    "Subhan Allah (سبحان الله)",
    "Alhamdulillah (الحمد لله)",
    "La ilaha illallah (لا إله إلا الله)",
    "Allahu Akbar (الله أكبر)",
    "Subhan Allah wa bihamdihi (سبحان الله وبحمده)",
    "Subhan Allah al-Azim (سبحان الله العظيم)",
    "Astaghfirullah (أستغفر الله)",
    "La hawla wa la quwwata illa billah (لا حول ولا قوة إلا بالله)",
    "Allahumma salli ala Muhammad (اللهم صل على محمد)",
    "Hasbunallahu wa ni'mal wakil (حسبنا الله ونعم الوكيل)",
    "قال رسول الله ﷺ: «كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن: سبحان الله وبحمده، سبحان الله العظيم»",
    "قال رسول الله ﷺ: «من صلى عليّ صلاة صلى الله عليه بها عشراً»",
    "قال رسول الله ﷺ: «تبسمك في وجه أخيك صدقة»",
    "قال رسول الله ﷺ: «الدال على الخير كفاعله»",
    "اللهم إنك عفو تحب العفو فاعف عنا",
    "رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً",
    "يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله، ولا تكلني إلى نفسي طرفة عين"
];

let intervalId = null;

module.exports = {
    start: (client) => {
        if (intervalId) clearInterval(intervalId);

        const db = client.db;
        db.read();
        const settings = db.get('settings').value();

        if (!settings || !settings.azkarEnabled || !settings.azkarChannel) return;

        // Determine Interval (Default 30 mins)
        const minutes = settings.azkarInterval || 30;
        const intervalMs = minutes * 60 * 1000;

        // Combine Default and Custom Lists
        const customList = settings.customAzkar || [];
        const combinedList = [...defaultAzkar, ...customList];

        console.log(`[Azkar] Started. Interval: ${minutes}m, Total Items: ${combinedList.length}`);

        // Immediate first run? Optional. Let's stick to interval.

        intervalId = setInterval(async () => {
            // Re-read settings inside interval to check enabled/disabled status without full restart
            // But usually start/stop is called on save. 
            // We'll trust the running process for now, or minimal check.

            const currentSettings = client.db.get('settings').value();
            if (!currentSettings.azkarEnabled) {
                // If disabled mid-flight without restart (shouldn't happen with our API logic, but safe guard)
                clearInterval(intervalId);
                return;
            }

            const channel = client.channels.cache.get(currentSettings.azkarChannel);
            if (!channel) return;

            // Pick Random
            const randomZikr = combinedList[Math.floor(Math.random() * combinedList.length)];
            const color = currentSettings.azkarColor || '#00e676';

            const embed = new EmbedBuilder()
                .setDescription(`**${randomZikr}**`)
                .setColor(color)
                .setFooter({ text: 'Azkar System', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            try {
                await channel.send({ embeds: [embed] });
            } catch (err) {
                console.error('[Azkar] Failed to send message:', err);
            }

        }, intervalMs);
    },

    stop: () => {
        if (intervalId) clearInterval(intervalId);
        console.log('[Azkar] Scheduler stopped.');
    }
};
