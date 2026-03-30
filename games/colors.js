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

// 60 لون مختلف (اسماء بالعربي + انجليزي + كود اللون)
const COLORS = [
  { hex: '#FF0000', names: ['أحمر', 'احمر', 'red'] },
  { hex: '#00FF00', names: ['أخضر', 'اخضر', 'green'] },
  { hex: '#0000FF', names: ['أزرق', 'ازرق', 'blue'] },
  { hex: '#FFFF00', names: ['أصفر', 'اصفر', 'yellow'] },
  { hex: '#FFA500', names: ['برتقالي', 'orange'] },
  { hex: '#800080', names: ['بنفسجي', 'purple', 'violet'] },
  { hex: '#FFC0CB', names: ['وردي', 'زهري', 'pink'] },
  { hex: '#00FFFF', names: ['سماوي', 'تركواز', 'cyan', 'aqua'] },
  { hex: '#FFFFFF', names: ['أبيض', 'ابيض', 'white'] },
  { hex: '#000000', names: ['أسود', 'اسود', 'black'] },

  { hex: '#808080', names: ['رمادي', 'رمادى', 'gray', 'grey'] },
  { hex: '#A52A2A', names: ['بني', 'بنى', 'brown'] },
  { hex: '#FFD700', names: ['ذهبي', 'ذهبي', 'gold'] },
  { hex: '#C0C0C0', names: ['فضي', 'فضى', 'silver'] },
  { hex: '#4B0082', names: ['نيلي', 'indigo'] },
  { hex: '#008000', names: ['أخضر غامق', 'اخضر غامق', 'dark green'] },
  { hex: '#006400', names: ['أخضر داكن', 'اخضر داكن', 'deep green'] },
  { hex: '#ADD8E6', names: ['أزرق فاتح', 'ازرق فاتح', 'light blue'] },
  { hex: '#00008B', names: ['أزرق داكن', 'ازرق داكن', 'dark blue'] },
  { hex: '#8B0000', names: ['أحمر داكن', 'احمر داكن', 'dark red'] },

  { hex: '#FF4500', names: ['برتقالي محمر', 'برتقالي غامق', 'dark orange'] },
  { hex: '#2E8B57', names: ['أخضر بحري', 'اخضر بحري', 'sea green'] },
  { hex: '#20B2AA', names: ['تركواز فاتح', 'light sea', 'light sea green'] },
  { hex: '#40E0D0', names: ['فيروزي', 'turquoise'] },
  { hex: '#DA70D6', names: ['بنفسجي فاتح', 'orchid'] },
  { hex: '#BA55D3', names: ['بنفسجي متوسط', 'medium purple'] },
  { hex: '#7B68EE', names: ['أزرق بنفسجي', 'blue violet'] },
  { hex: '#CD5C5C', names: ['أحمر باهت', 'indian red'] },
  { hex: '#F08080', names: ['وردي فاتح', 'light coral'] },
  { hex: '#FF69B4', names: ['وردي ساطع', 'hot pink'] },

  { hex: '#B22222', names: ['أحمر ناري', 'firebrick'] },
  { hex: '#228B22', names: ['أخضر عشبي', 'forest green'] },
  { hex: '#708090', names: ['رمادي مزرق', 'slate gray'] },
  { hex: '#6A5ACD', names: ['بنفسجي مزرق', 'slate blue'] },
  { hex: '#D2691E', names: ['بني شوكولا', 'chocolate'] },
  { hex: '#FF7F50', names: ['برتقالي مرجاني', 'coral'] },
  { hex: '#6495ED', names: ['أزرق ذرة', 'cornflower blue'] },
  { hex: '#DC143C', names: ['قرمزي', 'crimson'] },
  { hex: '#008B8B', names: ['تركواز داكن', 'dark cyan'] },
  { hex: '#B8860B', names: ['ذهبي داكن', 'dark goldenrod'] },

  { hex: '#00688B', names: ['أزرق محيطي', 'deep sky', 'deep sky blue'] },
  { hex: '#8FBC8F', names: ['أخضر باهت', 'dark sea green'] },
  { hex: '#556B2F', names: ['أخضر زيتوني داكن', 'dark olive', 'dark olive green'] },
  { hex: '#9932CC', names: ['بنفسجي داكن', 'dark orchid'] },
  { hex: '#FF1493', names: ['وردي عميق', 'deep pink'] },
  { hex: '#1E90FF', names: ['أزرق سماوي', 'dodger blue'] },
  { hex: '#ADFF2F', names: ['ليموني', 'lime green', 'lime'] },
  { hex: '#7FFF00', names: ['أخضر ليموني', 'chartreuse'] },
  { hex: '#F0E68C', names: ['كاكي', 'khaki'] },
  { hex: '#E6E6FA', names: ['لافندر', 'lavender'] },

  { hex: '#FFFACD', names: ['أصفر باهت', 'lemon chiffon'] },
  { hex: '#90EE90', names: ['أخضر فاتح', 'light green'] },
  { hex: '#87CEFA', names: ['سماوي فاتح', 'light sky blue'] },
  { hex: '#778899', names: ['رمادي فاتح مزرق', 'light slate gray'] },
  { hex: '#B0C4DE', names: ['أزرق فولادي فاتح', 'light steel blue'] },
  { hex: '#FFFFE0', names: ['أصفر فاتح جداً', 'light yellow'] }
];

// حالة اللعبة لكل قناة
const activeChannels = new Map(); // key: channelId, value: game state

async function createColorImage(color) {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // استخرج hex من الكائن وتأكد أنه نص صالح
  let hex = undefined;
  if (color && typeof color === 'object' && typeof color.hex === 'string') {
    hex = color.hex;
  }

  if (!hex) {
    console.error('colors.js:createColorImage => color.hex was invalid, using black. Got:', color);
    hex = '#000000';
  }

  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);

  return canvas.toBuffer('image/png');
}

function pickRandomColor() {
  const idx = Math.floor(Math.random() * COLORS.length);
  return COLORS[idx];
}

function buildOptions(correctColor) {
  // نستخدم الاسم الأول بالعربي كخيار صحيح إن وجد، وإلا أول اسم متاح
  const correctLabel = correctColor.names[0];

  // اختيار 3 ألوان عشوائية أخرى مختلفة عن اللون الصحيح
  const others = COLORS.filter((c) => c !== correctColor);
  const shuffled = [...others].sort(() => Math.random() - 0.5);
  const distractors = shuffled.slice(0, 3).map((c) => c.names[0]);

  const allLabels = [
    { label: correctLabel, isCorrect: true },
    ...distractors.map((label) => ({ label, isCorrect: false }))
  ];

  // خلط الخيارات
  return allLabels.sort(() => Math.random() - 0.5);
}

function buildButtons(options, chosenWrongIndexes = new Set(), correctIndex = null, ended = false) {
  const row = new ActionRowBuilder();

  options.forEach((opt, index) => {
    let style = ButtonStyle.Secondary;

    if (ended && opt.isCorrect) {
      style = ButtonStyle.Success; // الزر الصحيح أخضر عند انتهاء اللعبة
    } else if (chosenWrongIndexes.has(index)) {
      style = ButtonStyle.Danger; // الخيارات الخاطئة التي تم اختيارها أحمر
    }

    const btn = new ButtonBuilder()
      .setCustomId(`color_opt_${index}`)
      .setLabel(opt.label)
      .setStyle(style)
      .setDisabled(ended || chosenWrongIndexes.has(index));

    row.addComponents(btn);
  });

  return [row];
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'الوان') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'colors')) return;

    const channelId = message.channel.id;

    if (activeChannels.has(channelId)) {
      await message.reply('هناك جولة ألوان شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    const color = pickRandomColor();
    const options = buildOptions(color);

    const hex = (color && typeof color === 'object' && typeof color.hex === 'string' && color.hex) ? color.hex : '#000000';
    const hexNoHash = hex.replace('#', '');
    const imageUrl = `https://dummyimage.com/512x512/${hexNoHash}/${hexNoHash}.png&text=%20`;

    const embed = new EmbedBuilder()
      .setTitle('🎨 لعبة الألوان')
      .setDescription('شاهد اللون في الصورة داخل الامبيد، ثم اختر اسم اللون الصحيح من الأزرار بالأسفل.\nأول شخص يضغط على الخيار الصحيح يفوز!')
      .setImage(imageUrl)
      .setColor(0x1f2937)
      .setTimestamp();

    const components = buildButtons(options);

    const sent = await message.channel.send({ embeds: [embed], components });

    // حفظ حالة اللعبة لهذه القناة
    activeChannels.set(channelId, {
      color,
      options,
      messageId: sent.id,
      chosenWrongIndexes: new Set(),
      ended: false
    });
  });

  // تفاعل الأزرار للاختيارات
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    if (!customId.startsWith('color_opt_')) return;

    const channelId = interaction.channelId;
    const game = activeChannels.get(channelId);
    if (!game) return;

    if (game.ended) {
      await interaction.reply({
        content: 'هذه الجولة انتهت بالفعل.',
        ephemeral: true
      });
      return;
    }

    const index = parseInt(customId.replace('color_opt_', ''), 10);
    if (Number.isNaN(index) || index < 0 || index >= game.options.length) {
      await interaction.reply({ content: 'خيار غير صالح.', ephemeral: true });
      return;
    }

    const option = game.options[index];

    const originalEmbed = interaction.message.embeds[0];

    if (option.isCorrect) {
      // إنهاء الجولة مع تمييز الخيار الصحيح باللون الأخضر
      game.ended = true;
      const components = buildButtons(game.options, game.chosenWrongIndexes, index, true);

      activeChannels.delete(channelId);

      await interaction.update({
        embeds: [originalEmbed],
        components
      });

      await interaction.channel.send({
        content: `👑 - <@${interaction.user.id}>, فاز باللعبة!`
      });
    } else {
      // إجابة خاطئة: إنهاء الجولة مباشرة
      game.ended = true;
      game.chosenWrongIndexes.add(index);
      const components = buildButtons(game.options, game.chosenWrongIndexes, null, true);

      activeChannels.delete(channelId);

      await interaction.update({
        embeds: [originalEmbed],
        components
      });

      await interaction.channel.send({
        content: `🚨 - <@${interaction.user.id}>, إجابة خاطئة! انتهت الجولة.`
      });
    }
  });
}

module.exports = { register };
