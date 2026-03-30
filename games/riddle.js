const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const activeChannels = new Set();

const RIDDLES = [
  { q: 'شيء كلما أخذت منه كبر، ما هو؟', a: ['الحفرة', 'حفرة'] },
  { q: 'شيء يمشي بلا رجلين ولا يدخل إلا بالأذنين، ما هو؟', a: ['الصوت'] },
  { q: 'له أسنان ولا يعض، ما هو؟', a: ['المشط', 'مشط'] },
  { q: 'شيء إذا غليته جمد، ما هو؟', a: ['البيض', 'بيضة', 'البيضة'] },
  { q: 'بيت بلا أبواب ولا نوافذ، ما هو؟', a: ['البيضة', 'بيضة'] },
  { q: 'شيء يوجد في القرن مرة وفي الدقيقة مرتين ولا يوجد في الساعة، ما هو؟', a: ['حرف القاف', 'القاف', 'ق'] },
  { q: 'ما الشيء الذي لا يبتل حتى لو دخل الماء؟', a: ['الضوء'] },
  { q: 'شيء تراه في الليل ثلاث مرات وفي النهار مرة واحدة، ما هو؟', a: ['حرف اللام', 'اللام', 'ل'] },
  { q: 'شيء يكتب ولا يقرأ، ما هو؟', a: ['القلم', 'قلم'] },
  { q: 'شيء كلما زاد نقص، ما هو؟', a: ['العمر'] },
  { q: 'شيء إذا لمسته صاح، ما هو؟', a: ['الجرس', 'جرس'] },
  { q: 'شيء له رقبة وليس له رأس، ما هو؟', a: ['الزجاجة', 'زجاجة'] },
  { q: 'أخضر في الأرض وأسود في السوق وأحمر في البيت، ما هو؟', a: ['الشاي', 'شاي'] },
  { q: 'شيء يطير بلا جناح ويبكي بلا عين، ما هو؟', a: ['السحاب', 'الغيم', 'سحابة'] },
  { q: 'شيء إذا وضعته في الثلاجة لا يبرد، ما هو؟', a: ['الفلفل', 'فلفل'] },
  { q: 'شيء كل الناس يشربونه لكن لا أحد يأكله، ما هو؟', a: ['الماء'] },
  { q: 'ما هو الشيء الذي يسمع بلا أذن ويتكلم بلا لسان؟', a: ['الهاتف', 'التليفون', 'موبايل'] },
  { q: 'شيء له عين واحدة ولا يرى، ما هو؟', a: ['الإبرة', 'ابرة', 'إبرة'] },
  { q: 'شيء له أوراق وليس شجرة، ما هو؟', a: ['الكتاب', 'كتاب', 'دفتر'] },
  { q: 'شيء ينام ولا يستيقظ، ما هو؟', a: ['الميت', 'الموت'] }
];

function pickRandomRiddle() {
  return RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
}

function createRiddleImageBuffer(text) {
  const width = 900;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const paddingX = 50;
  const maxWidth = width - paddingX * 2;

  // break lines roughly by words
  const words = String(text).split(/\s+/).filter(Boolean);

  let fontSize = 64;
  while (fontSize > 28) {
    ctx.font = `800 ${fontSize}px ${FONT_FAMILY}`;

    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);

    const lineHeight = fontSize * 1.25;
    const totalH = lines.length * lineHeight;
    if (totalH <= height - 80) {
      // draw
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
      ctx.lineJoin = 'round';

      const startY = height / 2 - totalH / 2 + lineHeight / 2;
      for (let i = 0; i < lines.length; i++) {
        const y = startY + i * lineHeight;
        ctx.strokeText(lines[i], width / 2, y);
        ctx.fillText(lines[i], width / 2, y);
      }
      return canvas.toBuffer('image/png');
    }

    fontSize -= 4;
  }

  // fallback single line
  ctx.font = `700 32px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, width / 2, height / 2);
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
    if (content !== prefix + 'لغز') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'riddle')) return;

    const channelId = message.channel.id;
    if (activeChannels.has(channelId)) {
      await message.reply('هناك لغز شغال بالفعل في هذه القناة، انتظر حتى ينتهي.');
      return;
    }

    activeChannels.add(channelId);

    const r = pickRandomRiddle();
    const accepted = Array.isArray(r.a) ? r.a : [r.a];
    const acceptedNorm = new Set(accepted.map(normalize));

    const buffer = createRiddleImageBuffer(r.q);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_riddle.png' });

    const embed = new EmbedBuilder()
      .setTitle('🧠 لغز')
      .setDescription('أول شخص يكتب الإجابة الصحيحة يفوز!')
      .setImage('attachment://SPOILER_riddle.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      return acceptedNorm.has(normalize(m.content));
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
      await message.channel.send(`⏰ انتهى الوقت! الإجابة كانت: **${accepted[0]}**`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
