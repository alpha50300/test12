const { isGameAllowed } = require('../utils/gameChecks');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  EmbedBuilder,
  Events
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const QUESTION_PAIRS = [
  ['نت مش بيخلص', 'شحن تليفون مش بيخلص'],
  ['فلوس كتير بس من غير صحاب', 'صحاب كتير بس فلوس على القد'],
  ['تسافر كل شهر بلد جديدة', 'تقعد في بلدك بس تعيش ملك'],
  ['تبقى مشهور جدًا', 'تبقى غني جدًا'],
  ['تنسى الماضي', 'تعرف المستقبل'],
  ['تتكلم كل اللغات', 'تعزف كل الآلات'],
  ['تعيش من غير سوشيال', 'تعيش من غير نت خالص'],
  ['تسافر لوحدك', 'تسافر مع صحابك'],
  ['تاكل كشري كل يوم', 'تاكل بيتزا كل يوم'],
  ['تفضل في الشتاء دايمًا', 'تفضل في الصيف دايمًا'],
  ['تسكن جنب البحر', 'تسكن جنب النيل'],
  ['تعيش في القاهرة', 'تعيش في إسكندرية'],
  ['تشتغل من البيت', 'تشتغل من المكتب'],
  ['تتجوز حد بتحبه', 'حد بيحبك'],
  ['تعيش من غير قهوة', 'تعيش من غير شاي'],
  ['تكون دايمًا صريح', 'تكون دايمًا دبلوماسي'],
  ['تكون اجتماعي جدًا', 'تكون هادي ومختار صحابك'],
  ['تلاقي ريموت التلفزيون دايمًا', 'تلاقي فردة الشراب دايمًا'],
  ['تتعلم برمجة بسرعة', 'تتعلم تصميم بسرعة'],
  ['تتفرج فيلم كوميدي', 'فيلم أكشن'],
  ['تسمع راب', 'تسمع طرب'],
  ['تروح كافيه هادي', 'كافيه زحمة'],
  ['تعيش من غير حلويات', 'تعيش من غير شيبسي'],
  ['تسهر مع صحابك', 'تقعد مع عيلتك'],
  ['تعيش بسيط', 'تعيش فخم']
];

const EXTRA_LEFT = [
  'تنام بدري كل يوم',
  'تنام 12 ساعة',
  'تشتغل شيفت صباح',
  'تتعلم سواقة',
  'تعيش من غير زحمة',
  'تشتري أي حاجة من غير ما تبص للسعر',
  'تعيش من غير ميمز',
  'تعيش من غير سماعات',
  'تعيش من غير سفر',
  'تكون سريع في الرد',
  'تكون دايمًا صبور'
];

const EXTRA_RIGHT = [
  'تسهر براحتك كل يوم',
  'تنام 4 ساعات بس تكون نشيط',
  'تشتغل شيفت ليل',
  'تتعلم سباحة',
  'تعيش من غير صوت',
  'تبقى مقتصد بس مرتاح',
  'تعيش من غير سوشيال',
  'تعيش من غير شاحن',
  'تعيش من غير خروجات',
  'تكون سريع في الفعل',
  'تكون دايمًا حاسم'
];

function buildQuestions150() {
  const out = [];
  for (const [a, b] of QUESTION_PAIRS) out.push(`${a} / ${b}`);

  for (let i = 0; i < EXTRA_LEFT.length; i++) {
    out.push(`${EXTRA_LEFT[i]} / ${EXTRA_RIGHT[i]}`);
  }

  const topicsA = ['موبايل جديد', 'لابتوب قوي', 'بيت كبير', 'عربية أحلامك', 'وقت كتير', 'طاقة كتير', 'فلوس أكتر', 'راحة بال', 'سفر أكتر', 'نوم أكتر'];
  const topicsB = ['كل سنة', 'ثابت', 'مرتب', 'سوشيال', 'نجاح', 'ضحك', 'صحاب', 'خصوصية', 'مغامرة', 'استقرار'];
  const topicsC = ['على طول', 'في الويك اند', 'في الشغل', 'في البيت', 'وقت الزحمة', 'بالليل', 'الصبح', 'مع الناس', 'لوحدك', 'في الصيف'];
  const topicsD = ['تاكل حلو', 'تاكل حادق', 'تسمع أغاني', 'تتفرج أفلام', 'تلعب جيمينج', 'تقرأ كتب', 'تروح جيم', 'تتمشى', 'تسافر', 'تقعد'];

  for (let i = 0; i < topicsA.length; i++) {
    for (let j = 0; j < topicsD.length; j++) {
      out.push(`${topicsA[i]} ${topicsB[i % topicsB.length]} ${topicsC[j % topicsC.length]} / ${topicsD[j]} ${topicsC[i % topicsC.length]}`);
      if (out.length >= 150) return out.slice(0, 150);
    }
  }

  while (out.length < 150) {
    out.push('تختار 1 / تختار 2');
  }
  return out.slice(0, 150);
}

const QUESTIONS = buildQuestions150();

function normalizeQuestion(q) {
  if (typeof q !== 'string') return '';
  return q;
}

function pickRandomQuestion(prevIndex = null) {
  if (QUESTIONS.length === 0) return { index: 0, text: '— / —' };
  if (QUESTIONS.length === 1) return { index: 0, text: normalizeQuestion(QUESTIONS[0]) };

  let idx = Math.floor(Math.random() * QUESTIONS.length);
  if (prevIndex !== null) {
    let guard = 0;
    while (idx === prevIndex && guard < 10) {
      idx = Math.floor(Math.random() * QUESTIONS.length);
      guard++;
    }
  }

  return { index: idx, text: normalizeQuestion(QUESTIONS[idx]) };
}

function splitChoices(text) {
  const parts = String(text).split('/');
  const left = (parts[0] ?? '').trim();
  const right = (parts.slice(1).join('/') ?? '').trim();
  return { left, right };
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
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
  return lines;
}

function createLoImageBuffer(text) {
  const { left, right } = splitChoices(text);

  const width = 1000;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // halves
  ctx.fillStyle = '#7f1d1d'; // red
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#14532d'; // green
  ctx.fillRect(width / 2, 0, width / 2, height);

  // divider
  ctx.fillStyle = 'rgba(17,24,39,0.6)';
  ctx.fillRect(width / 2 - 4, 0, 8, height);

  // numbers
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `900 56px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeText('1', width / 4, 60);
  ctx.fillText('1', width / 4, 60);
  ctx.strokeText('2', (width * 3) / 4, 60);
  ctx.fillText('2', (width * 3) / 4, 60);

  // choices text
  const maxWidth = width / 2 - 80;

  const drawChoice = (choiceText, centerX) => {
    let fontSize = 56;
    while (fontSize > 24) {
      ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
      const lines = wrapText(ctx, choiceText, maxWidth);
      const lineHeight = fontSize * 1.25;
      const totalH = lines.length * lineHeight;
      if (totalH <= height - 140) {
        const startY = height / 2 - totalH / 2 + lineHeight / 2 + 30;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
        ctx.lineJoin = 'round';

        for (let i = 0; i < lines.length; i++) {
          const y = startY + i * lineHeight;
          ctx.strokeText(lines[i], centerX, y);
          ctx.fillText(lines[i], centerX, y);
        }
        return;
      }
      fontSize -= 4;
    }

    ctx.font = `700 24px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(choiceText, centerX, height / 2);
  };

  drawChoice(left || '—', width / 4);
  drawChoice(right || '—', (width * 3) / 4);

  return canvas.toBuffer('image/png');
}

function buildButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('lo_pick_1')
        .setLabel('1')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('lo_pick_2')
        .setLabel('2')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    )
  ];
}

function buildEmbed() {
  return new EmbedBuilder()
    .setTitle('🤔 لو خيروك')
    .setImage('attachment://SPOILER_lo.png')
    .setColor(0x1f2937)
    .setTimestamp();
}

let registered = false;

function register(client) {
  if (registered) return;
  registered = true;

  const lastQuestionByMessage = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'لو') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'lo')) return;

    const picked = pickRandomQuestion();
    const buffer = createLoImageBuffer(picked.text);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_lo.png' });

    const sent = await message.channel.send({
      embeds: [buildEmbed()],
      files: [attachment],
      components: buildButtons(false)
    });

    lastQuestionByMessage.set(sent.id, picked.index);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'lo_pick_1' && interaction.customId !== 'lo_pick_2') return;

    const msgId = interaction.message.id;
    const prevIndex = lastQuestionByMessage.get(msgId) ?? null;

    // disable buttons on the old message (so it can't be clicked repeatedly)
    try {
      await interaction.deferUpdate(); // Acknowledge immediately to prevent timeout
      await interaction.message.edit({ components: buildButtons(true) });
    } catch (e) {
      console.error("Error handling lo interaction:", e);
      return;
    }

    const picked = pickRandomQuestion(prevIndex);
    const buffer = createLoImageBuffer(picked.text);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_lo.png' });

    const sent = await interaction.channel.send({
      embeds: [buildEmbed()],
      files: [attachment],
      components: buildButtons(false)
    });

    lastQuestionByMessage.set(sent.id, picked.index);
  });
}

module.exports = { register };
