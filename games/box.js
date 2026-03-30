const { isGameAllowed } = require('../utils/gameChecks');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} = require('discord.js');

const games = new Map(); // key: channelId

const TOTAL_BOXES = 10;
const ROUND_TIMEOUT_MS = 90 * 1000;

function buildRows(game, disabledAll = false) {
  const rows = [];

  for (let r = 0; r < 2; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 5; c++) {
      const boxNum = r * 5 + c + 1;
      const opened = game.opened.has(boxNum);

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`box_pick_${boxNum}`)
          .setLabel(String(boxNum))
          .setStyle(opened ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(disabledAll || opened)
      );
    }
    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('box_cancel')
        .setLabel('إلغاء اللعبة')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabledAll)
    )
  );

  return rows;
}

function buildEmbed(game, extraText = null) {
  const openedCount = game.opened.size;

  const embed = new EmbedBuilder()
    .setTitle('🎁 لعبة الصندوق')
    .setDescription(
      (extraText ? `${extraText}\n\n` : '') +
      `اختار صندوق من الأزرار! كل لاعب يختار مرة واحدة فقط.\n\n` +
      `المفتوح: **${openedCount}/${TOTAL_BOXES}**`
    )
    .setColor(0x1f2937)
    .setTimestamp();

  return embed;
}

function clearGame(channelId) {
  const g = games.get(channelId);
  if (!g) return;
  if (g.timeout) {
    clearTimeout(g.timeout);
    g.timeout = null;
  }
  games.delete(channelId);
}

function bumpTimeout(channelId) {
  const g = games.get(channelId);
  if (!g) return;

  if (g.timeout) clearTimeout(g.timeout);
  g.timeout = setTimeout(async () => {
    const current = games.get(channelId);
    if (!current) return;

    try {
      await current.channel.send('⏳ انتهت لعبة الصندوق بسبب عدم التفاعل.');
    } catch { }

    try {
      if (current.messageId) {
        const msg = await current.channel.messages.fetch(current.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [buildEmbed(current, '⏳ انتهت اللعبة.')],
            components: buildRows(current, true)
          });
        }
      }
    } catch { }

    clearGame(channelId);
  }, ROUND_TIMEOUT_MS);
}

let registered = false;

function register(client) {
  if (registered) return;
  registered = true;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'صندوق') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'box')) return;

    const channelId = message.channel.id;
    if (games.has(channelId)) {
      await message.reply('هناك لعبة صندوق شغالة بالفعل في هذه القناة.');
      return;
    }

    const prizeBox = Math.floor(Math.random() * TOTAL_BOXES) + 1;

    const game = {
      channel: message.channel,
      hostId: message.author.id,
      prizeBox,
      opened: new Set(),
      pickedUsers: new Set(),
      messageId: null,
      timeout: null
    };

    games.set(channelId, game);

    const sent = await message.channel.send({
      embeds: [buildEmbed(game)],
      components: buildRows(game, false)
    });

    game.messageId = sent.id;
    bumpTimeout(channelId);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    if (!customId.startsWith('box_pick_') && customId !== 'box_cancel') return;

    const channelId = interaction.channelId;
    const game = games.get(channelId);
    if (!game) return;

    if (interaction.message.id !== game.messageId) {
      await interaction.reply({ content: 'دي رسالة قديمة للعبة.', ephemeral: true });
      return;
    }

    bumpTimeout(channelId);

    if (customId === 'box_cancel') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: 'فقط صاحب اللعبة يقدر يلغيها.', ephemeral: true });
        return;
      }

      clearGame(channelId);
      await interaction.update({
        embeds: [buildEmbed(game, '❌ تم إلغاء لعبة الصندوق.')],
        components: buildRows(game, true)
      });
      return;
    }

    const boxNum = parseInt(customId.replace('box_pick_', ''), 10);
    if (Number.isNaN(boxNum) || boxNum < 1 || boxNum > TOTAL_BOXES) {
      await interaction.reply({ content: 'صندوق غير صالح.', ephemeral: true });
      return;
    }

    if (game.opened.has(boxNum)) {
      await interaction.reply({ content: 'الصندوق ده مفتوح بالفعل.', ephemeral: true });
      return;
    }

    if (game.pickedUsers.has(interaction.user.id)) {
      await interaction.reply({ content: 'أنت اخترت صندوق قبل كده في الجولة دي.', ephemeral: true });
      return;
    }

    game.pickedUsers.add(interaction.user.id);
    game.opened.add(boxNum);

    if (boxNum === game.prizeBox) {
      const winnerId = interaction.user.id;
      clearGame(channelId);

      await interaction.update({
        embeds: [buildEmbed(game, `🎉 الصندوق رقم **${boxNum}** كان فيه الجائزة!`)],
        components: buildRows(game, true)
      });

      await interaction.channel.send({
        content: `👑 - <@${winnerId}>, فاز باللعبة!`
      });
      return;
    }

    await interaction.update({
      embeds: [buildEmbed(game, `❌ الصندوق رقم **${boxNum}** فاضي.`)],
      components: buildRows(game, false)
    });
  });
}

module.exports = { register };
