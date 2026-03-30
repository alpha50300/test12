const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const activeChannels = new Set();

const WORDS = [
  'لعب',
  'ضحك',
  'شاي',
  'قهوة',
  'سفر',
  'مزيكا',
  'مفاجأة',
  'صاحب',
  'صاحبة',
  'مدرسة',
  'جامعة',
  'فطار',
  'غدا',
  'عشا',
  'مكرونة',
  'بطاطس',
  'فراخ',
  'كشري',
  'طعمية',
  'فول',
  'عيش',
  'جبنة',
  'عسل',
  'سكر',
  'ملح',
  'فلفل',
  'تليفون',
  'شاحن',
  'واي فاي',
  'فيسبوك',
  'تيك توك',
  'يوتيوب',
  'مسلسل',
  'فيلم',
  'كورة',
  'ماتش',
  'هدف',
  'حارس',
  'جمهور',
  'زحمة',
  'مترو',
  'ميكروباص',
  'تاكسي',
  'إشارة',
  'سرينة',
  'شمس',
  'قمر',
  'نجمة',
  'بحر',
  'نيل',
  'جبل',
  'مطر',
  'هوا',
  'هدوء',
  'دوشة',
  'نوم',
  'سهر',
  'حلم',
  'مذاكرة',
  'امتحان',
  'نتيجة',
  'فلوس',
  'محفظة',
  'شنطة',
  'جزمة',
  'تيشيرت',
  'بنطلون',
  'نضارة',
  'ساعة',
  'هديه',
  'عيد',
  'أغنية',
  'رقصة',
  'مكسب',
  'خسارة',
  'مغامرة',
  'تحدي'
];

function pickRandomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function createWordImageBuffer(word) {
  const width = 900;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const paddingX = 40;
  let fontSize = 140;
  const maxWidth = width - paddingX * 2;

  while (fontSize > 36) {
    ctx.font = `800 ${fontSize}px ${FONT_FAMILY}`;
    const metrics = ctx.measureText(word);
    if (metrics.width <= maxWidth) break;
    fontSize -= 6;
  }

  ctx.font = `800 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
  ctx.lineJoin = 'round';

  ctx.strokeText(word, width / 2, height / 2);
  ctx.fillText(word, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

function normalizeAnswer(s) {
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
    if (content !== prefix + 'فكك') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'fakkak')) return;

    const channelId = message.channel.id;

    if (activeChannels.has(channelId)) {
      await message.reply('هناك جولة فكك شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const word = pickRandomWord();
    const expectedSpaced = word.split('').join(' ');
    const expectedNorm = normalizeAnswer(expectedSpaced);

    const buffer = createWordImageBuffer(word);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_fakkak.png' });

    const embed = new EmbedBuilder()
      .setTitle('🧩 لعبة فكك')
      .setDescription('أول شخص يفك الكلمة بحروف وبينها مسافات يفوز!\nمثال: **ل ع ب**')
      .setImage('attachment://SPOILER_fakkak.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      const norm = normalizeAnswer(m.content);
      return norm === expectedNorm;
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
      await message.channel.send(`⏰ انتهى الوقت! الكلمة كانت: **${expectedSpaced}**`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
