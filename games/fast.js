const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

// 120 كلمة/جملة قصيرة (عربية + إنجليزي بسيط)
const WORDS = [
  'كمبيوتر', 'كيبورد', 'ماوس', 'الهاتف', 'سماعة', 'مايك', 'ديسكورد', 'لابتوب', 'انترنت', 'برمجة',
  'جافاسكربت', 'روبي', 'بايثون', 'جافا', 'سي شارب', 'قهوة', 'شاي', 'ماء', 'سكر', 'ملح',
  'سيارة', 'دراجة', 'طائرة', 'مطار', 'مدينة', 'قرية', 'شارع', 'مبنى', 'باب', 'نافذة',
  'كتاب', 'قلم', 'دفتر', 'ممحاة', 'مكتب', 'كرسي', 'طاولة', 'لوحة مفاتيح', 'شاشة', 'سماعة رأس',
  'قطة', 'كلب', 'طائر', 'سمكة', 'أسد', 'نمر', 'فيل', 'جمل', 'حصان', 'ببغاء',
  'شمس', 'قمر', 'نجوم', 'سماء', 'بحر', 'نهر', 'جبل', 'صحراء', 'غابة', 'جزيرة',
  'سريع', 'بطيء', 'قوي', 'ضعيف', 'ذكي', 'مرح', 'سعيد', 'حزين', 'غاضب', 'هادئ',
  'بيت', 'غرفة', 'مطبخ', 'حمام', 'سطح', 'حديقة', 'باب البيت', 'غرفة النوم', 'غرفة الجلوس', 'غرفة الضيوف',
  'كرة قدم', 'كرة سلة', 'سباحة', 'جري', 'تنس', 'كرة طائرة', 'دوري', 'مباراة', 'هدف', 'حكم',
  'سرعة الكتابة', 'اسرع لاعب', 'افضل صديق', 'وقت ممتع', 'العب معنا', 'لا تتأخر', 'ركز جيداً', 'اكتب بسرعة', 'بدون اخطاء', 'انسخ بحذر'
];

// لمنع أكثر من جولة في نفس القناة
const activeChannels = new Set();

function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx];
}

function createWordImageBuffer(text) {
  const width = 900;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // خلفية شفافة: لا نرسم أي مستطيل خلفي
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ضبط حجم الخط ليناسب النص
  const paddingX = 40;
  let fontSize = 120;
  const maxWidth = width - paddingX * 2;

  while (fontSize > 28) {
    ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) break;
    fontSize -= 6;
  }

  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
  ctx.lineJoin = 'round';

  // حدود سوداء خفيفة عشان النص يبقى واضح على أي خلفية
  ctx.strokeText(text, width / 2, height / 2);
  ctx.fillText(text, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'اسرع') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'fast')) return;

    const channelId = message.channel.id;

    if (activeChannels.has(channelId)) {
      await message.reply('هناك جولة سرعة كتابة شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const word = pickRandomWord();

    const buffer = createWordImageBuffer(word);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_word.png' });

    const embed = new EmbedBuilder()
      .setTitle('⌨️ لعبة أسرع كتابة')
      .setDescription('أول شخص يكتب الكلمة الظاهرة بالضبط يفوز!')
      .setImage('attachment://SPOILER_word.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      return m.content === word;
    };

    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 15000, // 15 ثانية للرد
        errors: ['time']
      });

      const winnerMsg = collected.first();
      await message.channel.send({
        content: `👑 - <@${winnerMsg.author.id}>, فاز باللعبة!`
      });
    } catch (err) {
      await message.channel.send(`⏰ انتهى الوقت! لم يكتب أحد الكلمة \`${word}\`.`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
