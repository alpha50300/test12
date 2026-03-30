const { isGameAllowed } = require('../utils/gameChecks');
const {
  Events,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

const QUESTIONS = [
  'لو معاك زرار تمسح بيه موقف محرج حصل لك.. هتمسح إيه؟',
  'إيه أكتر أكلة بتاكلها وإنت واقف قدام التلاجة؟',
  'مين أكتر حد في صحابك بيعرف يقلب أي خناقة لضحك؟',
  'إيه أسوأ قرار خدته وإنت جعان؟',
  'لو هتعيش يوم كامل من غير نت.. هتعمل إيه؟',
  'إيه الحاجة اللي بتعملها في البيت ومش بتحب حد يشوفك بتعملها؟',
  'مين أكتر واحد في الشلة بيقول “آخر مرة” وهي مش آخر مرة؟',
  'إيه أكتر كلمة بتقولها لما تفتكر إنك نسيت حاجة؟',
  'لو هتبدّل اسمك يوم.. هتسمي نفسك إيه؟',
  'مين أكتر حد ممكن يضحكك وإنت زعلان؟',

  'إيه أكتر حاجة بتكرهها في الزحمة؟',
  'لو حياتك فيلم مصري.. مين الممثل اللي هيمثّلك؟',
  'إيه أكتر حاجة بتقولها لنفسك قبل ما تنام؟',
  'مين أكتر واحد في العيلة “بيفهم في كل حاجة”؟',
  'إيه أكتر حاجة بتخليك تقول: “يا نهار أبيض”؟',
  'لو هتختار سوبر باور.. تختار إيه عشان تتفادى الإحراج؟',
  'إيه أكتر عادة مصرية بتضحكك بس بتعملها؟',
  'لو هتعيش بدون شاي ولا بدون سكر.. تختار إيه؟',
  'إيه أكتر تطبيق بتفتحه من غير ما تحس؟',
  'مين أكتر حد عنده “ضحكة معدية”؟',

  'لو هتمنع كلمة من القاموس.. هتمنع إيه وليه؟',
  'إيه أكتر حاجة بتخليك تتأخر عن ميعادك؟',
  'مين أكتر واحد بيقول “أنا جاي” وهو لسه في السرير؟',
  'إيه أكتر موقف يثبت إن الحظ مش في صفك؟',
  'لو هتختار أغنية تفضل في دماغك طول اليوم.. هتكون إيه؟',
  'إيه أكتر حاجة بتعملها وإنت متوتر؟',
  'مين أكتر واحد بيعمل نفسه مش شايف الرسالة؟',
  'لو هتسافر سفرية واحدة بس.. تروح فين ومع مين؟',
  'إيه أكتر “كذبة بيضا” بتقولها عادي؟',
  'إيه أكتر كلمة بتقولها لما النت يقطع؟',

  'لو هتعيش من غير فراخ ولا من غير مكرونة.. تختار إيه؟',
  'مين أكتر واحد عنده موهبة “يبوّظ أي خطة”؟',
  'إيه أكتر حاجة بتعملها عشان تفتكر أسماء الناس؟',
  'لو معاك 100 جنيه زيادة فجأة.. أول حاجة هتجيبها إيه؟',
  'إيه أكتر موقف تضحك عليه لما تفتكره دلوقتي؟',
  'مين أكتر واحد “بيزوّق الكلام”؟',
  'إيه أكتر إفيه بتقوله من غير قصد؟',
  'لو هتختار تبقى مشهور في إيه؟',
  'إيه أكتر حاجة بتخليك تقول “مش فاضي” وإنت فاضي؟',
  'إيه أكتر حاجة بتستحملها عشان متزعلش حد؟',

  'إيه أكتر حاجة بتعملها وإنت مستني حد؟',
  'لو هتبدّل حياتك مع حد يوم.. تختار مين؟',
  'مين أكتر واحد بيستفزك بطريقة لطيفة؟',
  'إيه أكتر “اختراع” نفسك يكون موجود عشان يسهل حياتك؟',
  'لو هتعمل قانون في مصر.. أول قانون هيبقى إيه؟',
  'إيه أكتر حاجة بتخليك تحس إنك كبرت؟',
  'مين أكتر واحد بيحسدك على إيه؟',
  'إيه أكتر أكلة لما تتعمل في البيت بتحس إن الدنيا تمام؟',
  'لو هتكتب نصيحة على الحيطة.. هتكتب إيه؟',
  'إيه أكتر حاجة بتخاف تنساها؟',

  'لو هتعيش يوم من غير كلام.. هتقدر؟',
  'مين أكتر واحد في الشلة “بياخد اللقطة”؟',
  'إيه أكتر موقف تحب يتعاد عشان تغيّر رد فعلك؟',
  'لو هتختار لون يعبّر عن شخصيتك.. إيه هو؟',
  'إيه أكتر حاجة بتتكسف تطلبها؟',
  'مين أكتر واحد بيزوّدها في الحكاية؟',
  'إيه أكتر حاجة بتخليك تضحك لوحدك؟',
  'لو هتختار تبقى شاطر في حاجة جديدة فورًا.. إيه هي؟',
  'إيه أكتر جملة بتسمعها من أمك/أبوك؟',
  'مين أكتر واحد بيقول “أنا مالي” وهو أول واحد داخل؟',

  'لو هتختار تبقى غني بس مفيش صحاب.. ولا متوسط ومعاك صحاب؟',
  'إيه أكتر موقف كان لازم تسكت فيه بس اتكلمت؟',
  'مين أكتر واحد عنده “ضحكة شريرة”؟',
  'إيه أكتر عادة بتحاول تبطلها ومش عارف؟',
  'لو هتبدّل موبايلك بأي حاجة.. هتبدّله بإيه؟',
  'إيه أكتر حاجة بتتخانق عليها وأنت عارف إنك غلطان؟',
  'مين أكتر واحد بتثق فيه في الشلة؟',
  'إيه أكتر حاجه لما تحصل تقول “الحمد لله”؟',
  'لو هتختار تعيش في زمن تاني.. تختار أنهي زمن؟',
  'إيه أكتر “حركة” بتفهم منها إن حد متضايق؟',

  'إيه أكتر حاجة بتستفزك في السوشيال؟',
  'مين أكتر واحد بيضحك في الجنازة؟ (على سبيل الهزار يعني)',
  'إيه أكتر سؤال بتكرهه يتسألك؟',
  'لو هتعمل قناة يوتيوب.. هتتكلم عن إيه؟',
  'إيه أكتر موقف اتقالك فيه “إنت فاهم غلط”؟',
  'مين أكتر واحد بيحب يطلع صح في الآخر؟',
  'إيه أكتر حاجة بتخليك تقول “أنا مستحيل أعمل كده” وبعدين تعملها؟',
  'لو هتختار تطلع من دماغك فكرة واحدة مزعجة.. إيه هي؟',
  'إيه أكتر حاجة بتخليك تحس إنك محظوظ؟',
  'مين أكتر واحد بيقول “أنا رايق” وهو متعصب؟',

  'إيه أكتر عادة بتعملها وإنت بتتفرج على ماتش؟',
  'لو هتختار أكلة تعيش عليها أسبوع.. إيه هي؟',
  'مين أكتر واحد عنده “موهبة التبرير”؟',
  'إيه أكتر موقف اتأخرت فيه وخدت على دماغك؟',
  'لو هتعمل رنّة موبايلك جملة.. هتبقى إيه؟',
  'إيه أكتر “حكمة” سمعتها وطلعت غلط؟',
  'مين أكتر واحد بيعيش دور الضحية؟',
  'إيه أكتر حاجة نفسك تقولها لحد ومش قادر؟',
  'لو هتختار تبقى مشهور في منطقتك ولا مجهول عالميًا؟',
  'إيه أكتر موقف حسّيت فيه إنك “الوحيد العاقل”؟',

  'لو هتمنع إعلان واحد للأبد.. إعلان إيه؟',
  'إيه أكتر حاجة بتخليك تفرح من قلبك؟',
  'مين أكتر واحد بيقفل الباب ويقول “نسيت حاجة” ويرجع؟',
  'إيه أكتر “إدمان” عندك بس بسيط؟',
  'لو هتختار تبقى عندك ذاكرة قوية ولا نوم مريح؟',
  'إيه أكتر موقف اتعلمت منه درس جامد؟',
  'مين أكتر واحد في الشلة بيعرف يهدّي أي خناقة؟',
  'إيه أكتر حاجة بتخليك تقول “يا ريتني ما فتحت”؟',
  'لو هتختار تقابل نفسك زمان.. هتقول لنفسك إيه؟',
  'إيه أكتر حاجة بتحسها “مصرية أوي”؟'
];

function pickRandomQuestion(prevIndex = null) {
  if (QUESTIONS.length === 0) return { text: 'مفيش أسئلة.', index: -1 };
  if (QUESTIONS.length === 1) return { text: QUESTIONS[0], index: 0 };

  let idx = Math.floor(Math.random() * QUESTIONS.length);
  if (prevIndex !== null) {
    let guard = 0;
    while (idx === prevIndex && guard < 10) {
      idx = Math.floor(Math.random() * QUESTIONS.length);
      guard++;
    }
  }
  return { text: QUESTIONS[idx], index: idx };
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = ctx.measureText(test).width;
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function createQuestionImageBuffer(text) {
  const width = 900;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 52;
  const maxWidth = width - 80;
  const maxHeight = height - 80;

  while (fontSize > 28) {
    ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.floor(fontSize * 1.25);
    const blockHeight = lines.length * lineHeight;
    if (blockHeight <= maxHeight) break;
    fontSize -= 2;
  }

  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = Math.max(6, Math.floor(fontSize / 10));
  ctx.lineJoin = 'round';

  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = Math.floor(fontSize * 1.25);
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.strokeText(lines[i], width / 2, y);
    ctx.fillText(lines[i], width / 2, y);
  }

  return canvas.toBuffer('image/png');
}

function register(client) {
  const lastQuestionByMessage = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'كت') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'kat')) return;

    const picked = pickRandomQuestion();
    const buffer = createQuestionImageBuffer(picked.text);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_kat.png' });

    const embed = new EmbedBuilder()
      .setTitle('📝 كت')
      .setDescription('اضغط على زر **كت جديد** عشان يطلع كت جديد.')
      .setImage('attachment://SPOILER_kat.png')
      .setColor(0x1f2937)
      .setTimestamp();

    const sent = await message.channel.send({
      embeds: [embed],
      files: [attachment],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('kat_new')
            .setLabel('كت جديد')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    lastQuestionByMessage.set(sent.id, picked.index);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'kat_new') return;

    // Acknowledge immediately to avoid DiscordAPIError[10062] (Unknown interaction)
    // if generating the image / sending the message takes time.
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
    } catch {
      // If the interaction already expired, continue without failing.
    }

    const msgId = interaction.message.id;
    const prevIndex = lastQuestionByMessage.get(msgId) ?? null;
    const picked = pickRandomQuestion(prevIndex);

    const buffer = createQuestionImageBuffer(picked.text);
    const attachment = new AttachmentBuilder(buffer, { name: 'SPOILER_kat.png' });

    const embed = new EmbedBuilder()
      .setTitle('📝 كت')
      .setDescription('اضغط على زر **كت جديد** عشان يطلع كت جديد.')
      .setImage('attachment://SPOILER_kat.png')
      .setColor(0x1f2937)
      .setTimestamp();

    const sent = await interaction.channel.send({
      embeds: [embed],
      files: [attachment],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('kat_new')
            .setLabel('كت جديد')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    lastQuestionByMessage.set(sent.id, picked.index);
  });
}

module.exports = { register };
