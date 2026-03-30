const { isGameAllowed } = require('../utils/gameChecks');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} = require('discord.js');

// حالة لعبة الغميضة لكل قناة
const games = new Map(); // key: channelId, value: game state

const TOTAL_BOXES = 20;

function createInitialGame(hostId) {
  const boxes = new Map(); // key: boxNumber (1-20), value: userId أو null
  for (let i = 1; i <= TOTAL_BOXES; i++) {
    boxes.set(i, null);
  }

  return {
    hostId,
    boxes, // أماكن الاختباء
    opened: new Set(), // المربعات اللي اتفتشت
    eliminated: new Set(), // اللاعبين اللي تم اكتشافهم
    phase: 'hide', // 'hide' أو 'seek'
    messageId: null,
    currentSeekerId: null // اللاعب اللي عليه الدور في مرحلة البحث
  };
}

function buildBoxesRows(game) {
  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (let i = 1; i <= TOTAL_BOXES; i++) {
    const isOpened = game.opened.has(i);

    const btn = new ButtonBuilder()
      .setCustomId(`hide_box_${i}`)
      .setStyle(isOpened ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setLabel(isOpened ? '❌' : String(i))
      .setDisabled(isOpened);

    currentRow.addComponents(btn);

    if (currentRow.components.length === 5 || i === TOTAL_BOXES) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  return rows;
}

function buildControlRow(game) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('hide_seek_start')
      .setLabel('ابدأ البحث')
      .setStyle(ButtonStyle.Success)
      .setDisabled(game.phase !== 'hide'),
    new ButtonBuilder()
      .setCustomId('hide_cancel')
      .setLabel('إلغاء اللعبة')
      .setStyle(ButtonStyle.Secondary)
  );

  return row;
}

function buildEmbed(game, channel, client) {
  const remainingPlayers = getRemainingPlayers(game);

  const descriptionLines = [];
  descriptionLines.push('اختر مربعًا للاختباء فيه. بعد بدء البحث سيختار البوت مربعات عشوائيًا.');
  descriptionLines.push('إذا وجدك في مربعك يتم استبعادك من اللعبة.');
  descriptionLines.push('آخر لاعب لم يُكتشف هو الفائز.');
  descriptionLines.push('');
  descriptionLines.push(`🕵️‍♂️ عدد اللاعبين المتبقين: **${remainingPlayers.length}**`);

  const embed = new EmbedBuilder()
    .setTitle('🧩 لعبة الغميضة')
    .setDescription(descriptionLines.join('\n'))
    .setColor(0x1f2937)
    .setTimestamp();

  return embed;
}

function getRemainingPlayers(game) {
  const players = new Set();
  for (const userId of game.boxes.values()) {
    if (userId) players.add(userId);
  }
  for (const eliminated of game.eliminated.values()) {
    players.delete(eliminated);
  }
  return Array.from(players);
}

function register(client) {
  // أمر +غميضة لبدء اللعبة
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'غميضة') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'hideAndSeek')) return;

    const channelId = message.channel.id;

    if (games.has(channelId)) {
      await message.reply('هناك لعبة غميضة قائمة بالفعل في هذه القناة.');
      return;
    }

    const game = createInitialGame(message.author.id);
    games.set(channelId, game);

    const embed = buildEmbed(game, message.channel, client);
    const boxRows = buildBoxesRows(game);
    const controlRow = buildControlRow(game);

    const sent = await message.channel.send({
      embeds: [embed],
      components: [...boxRows, controlRow]
    });

    game.messageId = sent.id;
  });

  // أزرار الغميضة
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    const channelId = interaction.channelId;
    const game = games.get(channelId);

    if (!game) return;

    // أزرار اختيار المربعات للاختباء / البحث
    if (customId.startsWith('hide_box_')) {
      const boxNumber = parseInt(customId.replace('hide_box_', ''), 10);
      if (Number.isNaN(boxNumber) || boxNumber < 1 || boxNumber > TOTAL_BOXES) {
        await interaction.reply({ content: 'هذا المربع غير صالح.', ephemeral: true });
        return;
      }

      if (game.opened.has(boxNumber)) {
        await interaction.reply({
          content: 'تم تفتيش هذا المربع بالفعل.',
          ephemeral: true
        });
        return;
      }

      // إذا كنا في مرحلة الاختباء: اللاعب يختار مربع يستخبّي فيه
      if (game.phase === 'hide') {
        // تأكد أن اللاعب لا يختبئ في أكثر من مربع
        for (const [num, userId] of game.boxes.entries()) {
          if (userId === interaction.user.id) {
            game.boxes.set(num, null);
          }
        }

        const currentOccupant = game.boxes.get(boxNumber);
        if (currentOccupant && currentOccupant !== interaction.user.id) {
          await interaction.reply({
            content: 'هذا المربع مستخدم بالفعل من لاعب آخر. اختر مربعًا مختلفًا.',
            ephemeral: true
          });
          return;
        }

        game.boxes.set(boxNumber, interaction.user.id);

        await interaction.reply({
          content: `👌 تم اختيار المربع رقم ${boxNumber} للاختباء فيه!`,
          ephemeral: true
        });

        const channel = interaction.channel;
        const embed = buildEmbed(game, channel, interaction.client);
        const boxRows = buildBoxesRows(game);
        const controlRow = buildControlRow(game);

        await interaction.message.edit({
          embeds: [embed],
          components: [...boxRows, controlRow]
        });
        return;
      }

      // إذا كنا في مرحلة البحث: اللاعب الذي عليه الدور هو من يختار المربع
      if (game.phase === 'seek') {
        if (interaction.user.id !== game.currentSeekerId) {
          await interaction.reply({
            content: 'ليس دورك الآن لاختيار مربع للبحث فيه.',
            ephemeral: true
          });
          return;
        }

        // فتح المربع المختار
        game.opened.add(boxNumber);
        const userId = game.boxes.get(boxNumber);

        let resultMessage;
        if (userId) {
          game.eliminated.add(userId);
          resultMessage = `🎯 تم العثور على لاعب في المربع رقم ${boxNumber}! <@${userId}> تم استبعاده.`;
        } else {
          resultMessage = `🔍 المربع رقم ${boxNumber} فارغ، لا يوجد لاعب هنا.`;
        }

        const remaining = getRemainingPlayers(game);

        if (remaining.length === 0) {
          // لا يوجد فائز (الجميع تم اكتشافهم)
          games.delete(channelId);
          const channel = interaction.channel;
          const embed = buildEmbed(game, channel, interaction.client);
          await interaction.update({
            content: `${resultMessage}\n\nانتهت اللعبة، تم اكتشاف كل اللاعبين!`,
            embeds: [embed],
            components: []
          });
          return;
        }

        let gameEnded = false;
        if (remaining.length === 1) {
          gameEnded = true;
        }

        const channel = interaction.channel;
        const embed = buildEmbed(game, channel, interaction.client);
        const boxRows = buildBoxesRows(game);
        const controlRow = buildControlRow(game);

        if (gameEnded) {
          const winnerId = remaining[0];
          games.delete(channelId);
          await interaction.update({
            content: `${resultMessage}\n\n👑 - <@${winnerId}>, فاز باللعبة!`,
            embeds: [embed],
            components: []
          });
        } else {
          // اختيار لاعب جديد عشوائي ليكون عليه الدور من بين المتبقين
          const nextIndex = Math.floor(Math.random() * remaining.length);
          const nextSeekerId = remaining[nextIndex];
          game.currentSeekerId = nextSeekerId;

          await interaction.update({
            content: `${resultMessage}\n\n🎯 الدور الآن على: <@${nextSeekerId}> لاختيار مربع للبحث فيه.`,
            embeds: [embed],
            components: [...boxRows, controlRow]
          });
        }

        return;
      }
    }

    // بدء مرحلة البحث
    if (customId === 'hide_seek_start') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({
          content: 'فقط من أنشأ اللعبة يمكنه بدء البحث.',
          ephemeral: true
        });
        return;
      }

      if (game.phase !== 'hide') {
        await interaction.reply({
          content: 'تم بدء البحث بالفعل.',
          ephemeral: true
        });
        return;
      }

      const remaining = getRemainingPlayers(game);
      if (remaining.length === 0) {
        await interaction.reply({
          content: 'لا يوجد أي لاعب مختبئ بعد!',
          ephemeral: true
        });
        return;
      }

      game.phase = 'seek';

      // اختيار أول لاعب عليه الدور من بين اللاعبين المتبقين
      const firstIndex = Math.floor(Math.random() * remaining.length);
      game.currentSeekerId = remaining[firstIndex];

      const channel = interaction.channel;
      const embed = buildEmbed(game, channel, interaction.client);
      const boxRows = buildBoxesRows(game);
      const controlRow = buildControlRow(game);

      await interaction.update({
        content: `تم بدء مرحلة البحث!\n🎯 الدور الأول على: <@${game.currentSeekerId}> لاختيار مربع للبحث فيه.`,
        embeds: [embed],
        components: [...boxRows, controlRow]
      });
      return;
    }

    // إلغاء اللعبة
    if (customId === 'hide_cancel') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({
          content: 'فقط من أنشأ اللعبة يمكنه إلغاء اللعبة.',
          ephemeral: true
        });
        return;
      }

      games.delete(channelId);

      await interaction.update({
        content: '❌ تم إلغاء لعبة الغميضة.',
        components: []
      });
      return;
    }
  });
}

module.exports = { register };
