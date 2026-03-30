const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const activeChannels = new Set();

// مفرد -> جمع
const PAIRS = [
  { s: 'شارع', p: ['شوارع'] },
  { s: 'كتاب', p: ['كتب'] },
  { s: 'قلم', p: ['أقلام', 'اقلام'] },
  { s: 'ولد', p: ['أولاد', 'اولاد'] },
  { s: 'بنت', p: ['بنات'] },
  { s: 'بيت', p: ['بيوت'] },
  { s: 'مفتاح', p: ['مفاتيح'] },
  { s: 'باب', p: ['أبواب', 'ابواب'] },
  { s: 'نافذة', p: ['نوافذ'] },
  { s: 'كرسي', p: ['كراسي'] },
  { s: 'طاولة', p: ['طاولات'] },
  { s: 'مدينة', p: ['مدن'] },
  { s: 'قرية', p: ['قرى'] },
  { s: 'حقيقة', p: ['حقائق'] },
  { s: 'صديق', p: ['أصدقاء', 'اصدقاء'] },
  { s: 'عدو', p: ['أعداء', 'اعداء'] },
  { s: 'سؤال', p: ['أسئلة', 'اسئلة'] },
  { s: 'إجابة', p: ['إجابات', 'اجابات'] },
  { s: 'صورة', p: ['صور'] },
  { s: 'درس', p: ['دروس'] },
  { s: 'مدرس', p: ['مدرسون', 'مدرسين'] },
  { s: 'طالب', p: ['طلاب'] },
  { s: 'جامعة', p: ['جامعات'] },
  { s: 'مدرسة', p: ['مدارس'] },
  { s: 'طبيب', p: ['أطباء', 'اطباء'] },
  { s: 'مريض', p: ['مرضى'] },
  { s: 'مرض', p: ['أمراض', 'امراض'] },
  { s: 'دواء', p: ['أدوية', 'ادوية'] },
  { s: 'رجل', p: ['رجال'] },
  { s: 'امرأة', p: ['نساء'] },
  { s: 'طفل', p: ['أطفال', 'اطفال'] },
  { s: 'أخ', p: ['إخوة', 'اخوة', 'إخوان', 'اخوان'] },
  { s: 'أخت', p: ['أخوات', 'اخوات'] },
  { s: 'أسبوع', p: ['أسابيع', 'اسابيع'] },
  { s: 'شهر', p: ['شهور', 'أشهر', 'اشهر'] },
  { s: 'سنة', p: ['سنوات', 'سنين'] },
  { s: 'يوم', p: ['أيام', 'ايام'] },
  { s: 'ساعة', p: ['ساعات'] },
  { s: 'دقيقة', p: ['دقائق'] },
  { s: 'ثانية', p: ['ثواني'] },
  { s: 'قصة', p: ['قصص'] },
  { s: 'حلم', p: ['أحلام', 'احلام'] },
  { s: 'فيلم', p: ['أفلام', 'افلام'] },
  { s: 'مباراة', p: ['مباريات'] },
  { s: 'هدف', p: ['أهداف', 'اهداف'] },
  { s: 'لاعب', p: ['لاعبون', 'لاعبين'] },
  { s: 'مشكلة', p: ['مشاكل'] },
  { s: 'فكرة', p: ['أفكار', 'افكار'] },
  { s: 'خطة', p: ['خطط'] },
  { s: 'مقال', p: ['مقالات'] },
  { s: 'برنامج', p: ['برامج'] },
  { s: 'جهاز', p: ['أجهزة', 'اجهزة'] },
  { s: 'حاسوب', p: ['حواسيب'] },
  { s: 'هاتف', p: ['هواتف'] },
  { s: 'رسالة', p: ['رسائل'] }
];

function pickRandomPair() {
  return PAIRS[Math.floor(Math.random() * PAIRS.length)];
}

function normalizeAnswer(s) {
  return String(s || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\s\-_.،,؛;:!?]+/g, '')
    .toLowerCase();
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
  const maxWidth = width - paddingX * 2;

  let fontSize = 150;
  while (fontSize > 36) {
    ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
    if (ctx.measureText(word).width <= maxWidth) break;
    fontSize -= 6;
  }

  ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
  ctx.lineJoin = 'round';

  ctx.strokeText(word, width / 2, height / 2);
  ctx.fillText(word, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'جمع') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'jam')) return;

    const channelId = message.channel.id;
    if (activeChannels.has(channelId)) {
      await message.reply('هناك لعبة جمع شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const pair = pickRandomPair();
    const acceptedNorm = new Set(pair.p.map(normalizeAnswer));

    const buffer = createWordImageBuffer(pair.s);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_jam.png' });

    const embed = new EmbedBuilder()
      .setTitle('🧠 لعبة جمع')
      .setDescription('اكتب جمع الكلمة اللي في الصورة. أول شخص يكتبها صح يفوز!')
      .setImage('attachment://SPOILER_jam.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      return acceptedNorm.has(normalizeAnswer(m.content));
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
      await message.channel.send(`⏰ انتهى الوقت! الإجابة الصحيحة: **${pair.p[0]}**`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
