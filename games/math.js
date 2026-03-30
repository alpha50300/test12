const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

// لمنع أكثر من جولة في نفس القناة
const activeChannels = new Set();

function pickRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildProblem() {
  const ops = ['+', '-', '×', '÷'];
  const op = ops[pickRandomInt(0, ops.length - 1)];

  let a;
  let b;
  let answer;

  if (op === '+') {
    a = pickRandomInt(10, 200);
    b = pickRandomInt(10, 200);
    answer = a + b;
  } else if (op === '-') {
    a = pickRandomInt(10, 200);
    b = pickRandomInt(10, 200);
    if (b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (op === '×') {
    a = pickRandomInt(2, 25);
    b = pickRandomInt(2, 25);
    answer = a * b;
  } else {
    // قسمة صحيحة بدون كسور
    b = pickRandomInt(2, 20);
    answer = pickRandomInt(2, 25);
    a = b * answer;
  }

  const text = `${a} ${op} ${b} = ?`;
  return { text, answer };
}

function createProblemImageBuffer(text) {
  const width = 900;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // خلفية شفافة
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

  ctx.strokeText(text, width / 2, height / 2);
  ctx.fillText(text, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'حساب') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'math')) return;

    const channelId = message.channel.id;

    if (activeChannels.has(channelId)) {
      await message.reply('هناك جولة حساب شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const { text, answer } = buildProblem();
    const buffer = createProblemImageBuffer(text);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_math.png' });

    const embed = new EmbedBuilder()
      .setTitle('🧮 لعبة أسرع حساب')
      .setDescription('أول شخص يكتب الإجابة الصحيحة يفوز!')
      .setImage('attachment://SPOILER_math.png')
      .setColor(0x1f2937)
      .setTimestamp();

    await message.channel.send({ embeds: [embed], files: [attachment] });

    const filter = (m) => {
      if (m.author.bot) return false;
      const normalized = m.content.trim();
      return normalized === String(answer);
    };

    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 12000,
        errors: ['time']
      });

      const winnerMsg = collected.first();
      await message.channel.send({
        content: `👑 - <@${winnerMsg.author.id}>, فاز باللعبة!`
      });
    } catch (err) {
      await message.channel.send(`⏰ انتهى الوقت! الإجابة الصحيحة هي: **${answer}**`);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
