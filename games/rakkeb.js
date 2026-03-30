const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const activeChannels = new Set();

const WORDS = [
  'حارة',
  'مطر',
  'شمس',
  'قمر',
  'بحر',
  'نيل',
  'جبل',
  'زهرة',
  'طيارة',
  'سيارة',
  'مفتاح',
  'باب',
  'شباك',
  'كرسي',
  'ترابيزة',
  'مدرسة',
  'جامعة',
  'امتحان',
  'مذاكرة',
  'صاحب',
  'مكالمة',
  'رسالة',
  'تليفون',
  'شاحن',
  'سماعة',
  'قهوة',
  'شاي',
  'عصير',
  'مكرونة',
  'بطاطس',
  'كشري',
  'طعمية',
  'فول',
  'عيش',
  'جبنة',
  'بسكوت',
  'شوكولاتة',
  'هدية',
  'عيد',
  'مغامرة',
  'تحدي',
  'ضحكة',
  'حكاية',
  'مسرح',
  'فيلم',
  'مسلسل',
  'كورة',
  'ماتش',
  'هدف',
  'جمهور'
];

function pickRandomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleWord(word) {
  const chars = Array.from(word);
  if (chars.length <= 1) return word;

  let shuffled = chars;
  let tries = 0;
  while (tries < 10) {
    shuffled = shuffleArray(chars);
    if (shuffled.join('') !== word) break;
    tries++;
  }

  return shuffled.join('');
}

function createRakkebImageBuffer(scrambledWithSpaces) {
  const width = 900;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const paddingX = 40;
  const maxWidth = width - paddingX * 2;

  let fontSize = 120;
  while (fontSize > 36) {
    ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(scrambledWithSpaces).width <= maxWidth) break;
    fontSize -= 6;
  }

  ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
  ctx.lineJoin = 'round';

  ctx.strokeText(scrambledWithSpaces, width / 2, height / 2);
  ctx.fillText(scrambledWithSpaces, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

function normalize(s) {
  return String(s || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\s\-_.،,؛;:!?]+/g, '')
    .toLowerCase();
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'ركب') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'rakkeb')) return;

    const channelId = message.channel.id;
    if (activeChannels.has(channelId)) {
      await message.reply('هناك لعبة ركب شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const word = pickRandomWord();
    const scrambled = shuffleWord(word);
    const scrambledWithSpaces = Array.from(scrambled).join(' ');

    const expectedNorm = normalize(word);

    const buffer = createRakkebImageBuffer(scrambledWithSpaces);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_rakkeb.png' });

    const embed = new EmbedBuilder()
      .setTitle('🧱 لعبة ركب')
      .setDescription('رتّب الحروف واكتب الكلمة الصحيحة!')
      .setImage('attachment://SPOILER_rakkeb.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      return normalize(m.content) === expectedNorm;
    };

    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 20000,
        errors: ['time']
      });

      const winnerMsg = collected.first();
      await message.channel.send({
        content: `👑 - <@${winnerMsg.author.id}>, فاز باللعبة!`
      });
    } catch {
      await message.channel.send(`⏰ انتهى الوقت! الكلمة كانت: **${word}**`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
