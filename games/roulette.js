const { isGameAllowed } = require('../utils/gameChecks');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  EmbedBuilder,
  Events
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { FONT_FAMILY } = require('../utils/fonts');

// تخزين حالة اللعبة لكل قناة
const games = new Map(); // key: channelId, value: game state

const MAX_SLOTS = 20;
const LOBBY_SECONDS = 20;
const LOBBY_TICK_MS = 3000;

const CENTER_ICON_URL_B64 = null;

async function loadRemoteImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const ab = await res.arrayBuffer();
  return loadImage(Buffer.from(ab));
}

async function getCenterIconImage(user) {
  if (!user) return null;
  try {
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
    return await loadRemoteImage(avatarUrl);
  } catch (err) {
    console.error('roulette.js => failed to load user avatar:', err);
    return null;
  }
}

async function createRouletteImage(hostUser, players, currentPlayer) {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // خلفية داكنة
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 200;

  // دائرة الروليت الأساسية (ألوان فقط بدون صورة خلفية)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1f2937';
  ctx.fill();

  const count = players.length;
  if (count > 0) {
    const slice = (Math.PI * 2) / count;

    // اجعل مؤشر السهم ثابتًا بالأعلى، ولفّ الروليت بحيث يأتي قطاع اللاعب الحالي تحت السهم.
    const pointerAngle = -Math.PI / 2;
    let rotationOffset = 0;
    if (currentPlayer) {
      const currentIdx = players.findIndex((p) => p.id === currentPlayer.id);
      if (currentIdx >= 0) {
        const currentCenter = currentIdx * slice + slice / 2;
        rotationOffset = pointerAngle - currentCenter;
      }
    }

    players.forEach((p, i) => {
      const start = i * slice + rotationOffset;
      const end = start + slice;

      // لون لكل قطاع
      const hue = (i * (360 / count)) % 360;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fill();

      // اسم اللاعب
      const angle = start + slice / 2;
      const nameR = radius - 95;
      const textX = centerX + nameR * Math.cos(angle);
      const textY = centerY + nameR * Math.sin(angle);

      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `20px ${FONT_FAMILY}`;
      const display = typeof p.displayName === 'string' && p.displayName ? p.displayName : p.user.username;
      const name = display.length > 10
        ? display.slice(0, 10) + '…'
        : display;
      ctx.textAlign = 'center';
      ctx.fillText(name, 0, 0);
      ctx.restore();
    });
  }

  // مؤشر على قطاع اللاعب الحالي (سهم صغير)
  if (currentPlayer && count > 0) {
    const angle = -Math.PI / 2;

    const tipR = radius - 32;
    const baseR = radius - 2;
    const halfWidth = 8;

    const tipX = centerX + tipR * Math.cos(angle);
    const tipY = centerY + tipR * Math.sin(angle);

    const baseX = centerX + baseR * Math.cos(angle);
    const baseY = centerY + baseR * Math.sin(angle);

    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    const leftX = baseX + perpX * halfWidth;
    const leftY = baseY + perpY * halfWidth;
    const rightX = baseX - perpX * halfWidth;
    const rightY = baseY - perpY * halfWidth;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();

    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // صورة الدائرة في منتصف الروليت
  const icon = await getCenterIconImage(currentPlayer ? currentPlayer.user : null);
  if (icon) {
    const iconR = 54;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, iconR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(icon, centerX - iconR, centerY - iconR, iconR * 2, iconR * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, iconR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  return canvas.toBuffer('image/png');
}

function getOrCreateGame(channelId, host) {
  let game = games.get(channelId);
  if (!game) {
    game = {
      hostId: host.id,
      players: new Map(), // key: userId, value: GuildMember
      slots: Array.from({ length: MAX_SLOTS }, () => null),
      userToSlot: new Map(),
      lobbyEndsAt: null,
      lobbyInterval: null,
      started: false,
      currentPlayerId: null,
      lobbyMessageId: null
    };
    games.set(channelId, game);
  }
  return game;
}

function formatSlotsRange(game, start, end) {
  const lines = [];
  for (let i = start; i <= end; i++) {
    const userId = game.slots[i - 1];
    lines.push(`${i} • ${userId ? `<@${userId}>` : '—'}`);
  }
  return lines.join('\n');
}

function buildLobbyEmbed(game, remainingSeconds) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 لعبة روليت')
    .setDescription('اضغط علي مربعات الارقام للمشاركة')
    .addFields(
      { name: '\u200B', value: formatSlotsRange(game, 1, 10), inline: true },
      { name: '\u200B', value: formatSlotsRange(game, 11, 20), inline: true }
    )
    .setColor(0x1f2937)
    .setTimestamp();

  if (typeof remainingSeconds === 'number') {
    embed.setFooter({ text: `البدء خلال: ${remainingSeconds} ثانية` });
  }

  return embed;
}

function buildSlotRows(game, disabled = false) {
  const rows = [];
  for (let r = 0; r < 4; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 5; c++) {
      const slot = r * 5 + c + 1;
      const occupied = Boolean(game.slots[slot - 1]);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette_slot_${slot}`)
          .setLabel(String(slot))
          .setStyle(occupied ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(disabled || occupied)
      );
    }
    rows.push(row);
  }

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roulette_leave')
      .setLabel('انسحاب')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('roulette_cancel')
      .setLabel('إلغاء اللعبة')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );

  rows.push(controlRow);
  return rows;
}

function buildLobbyButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roulette_join')
      .setLabel('انضم للعبة')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('roulette_leave')
      .setLabel('انسحاب')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('roulette_start')
      .setLabel('ابدأ الجولة')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('roulette_cancel')
      .setLabel('إلغاء اللعبة')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildKickButtons(game) {
  const players = Array.from(game.players.values());
  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const btn = new ButtonBuilder()
      .setCustomId(`roulette_kick_${p.id}`)
      .setLabel(p.user.username)
      .setStyle(ButtonStyle.Danger);

    currentRow.addComponents(btn);

    if (currentRow.components.length === 5 || i === players.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  return rows;
}

async function startRound(interaction, game) {
  const players = Array.from(game.players.values());
  if (players.length < 2) {
    await interaction.reply({
      content: 'لا يمكن بدء اللعبة بأقل من لاعبين اثنين.',
      ephemeral: true
    });
    return;
  }

  game.started = true;

  // اختيار لاعب عشوائي عليه الدور
  const randomIndex = Math.floor(Math.random() * players.length);
  const currentPlayer = players[randomIndex];
  game.currentPlayerId = currentPlayer.id;

  const buffer = await createRouletteImage(
    interaction.guild.members.me ?? interaction.member,
    players,
    currentPlayer
  );
  const attachment = new AttachmentBuilder(buffer, { name: 'roulette.png' });

  const rows = buildKickButtons(game);

  await interaction.reply({
    content: `🎯 الدور على: <@${currentPlayer.id}>\nاختر لاعبًا لطرده من اللعبة:`,
    files: [attachment],
    components: rows
  });
}

async function startRoundInChannel(channel, game) {
  const players = Array.from(game.players.values());
  if (players.length < 2) {
    games.delete(channel.id);
    await channel.send('لا يمكن بدء اللعبة بأقل من لاعبين اثنين.');
    return;
  }

  game.started = true;

  const randomIndex = Math.floor(Math.random() * players.length);
  const currentPlayer = players[randomIndex];
  game.currentPlayerId = currentPlayer.id;

  const buffer = await createRouletteImage(
    channel.guild.members.me,
    players,
    currentPlayer
  );
  const attachment = new AttachmentBuilder(buffer, { name: 'roulette.png' });
  const rows = buildKickButtons(game);

  await channel.send({
    content: `🎯 الدور على: <@${currentPlayer.id}>\nاختر لاعبًا لطرده من اللعبة:`,
    files: [attachment],
    components: rows
  });
}

async function handleKick(interaction, game, targetId) {
  const currentPlayerId = game.currentPlayerId;

  if (interaction.user.id !== currentPlayerId) {
    await interaction.reply({
      content: 'فقط اللاعب الذي عليه الدور يمكنه اختيار من يطرد.',
      ephemeral: true
    });
    return;
  }

  if (!game.players.has(targetId)) {
    await interaction.reply({
      content: 'هذا اللاعب لم يعد في اللعبة.',
      ephemeral: true
    });
    return;
  }

  if (game.players.size <= 1) {
    await interaction.reply({
      content: 'لا يوجد عدد كافٍ من اللاعبين.',
      ephemeral: true
    });
    return;
  }

  const kicked = game.players.get(targetId);
  game.players.delete(targetId);

  const remainingPlayers = Array.from(game.players.values());

  if (remainingPlayers.length === 1) {
    const winner = remainingPlayers[0];
    games.delete(interaction.channelId);

    await interaction.update({
      content: `🚨 تم طرد <@${kicked.id}> من اللعبة!\n👑 - <@${winner.id}>, فاز باللعبة!`,
      files: [],
      components: []
    });
    return;
  }

  // اختيار لاعب جديد عشوائي للدور القادم
  const randomIndex = Math.floor(Math.random() * remainingPlayers.length);
  const newCurrent = remainingPlayers[randomIndex];
  game.currentPlayerId = newCurrent.id;

  const buffer = await createRouletteImage(
    interaction.guild.members.me ?? interaction.member,
    remainingPlayers,
    newCurrent
  );
  const attachment = new AttachmentBuilder(buffer, { name: 'roulette.png' });

  const rows = buildKickButtons(game);

  await interaction.update({
    content: `🚨 تم طرد <@${kicked.id}> من اللعبة!\n🎯 الدور الآن على: <@${newCurrent.id}>\nاختر لاعبًا لطرده من اللعبة:`,
    files: [attachment],
    components: rows
  });
}

let registered = false;

function register(client) {
  if (registered) return;
  registered = true;

  // أمر الكتابة: !roulette start
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    // Prefix from DB
    const prefix = client.db.get('settings.prefix').value() || '!';

    const isArabicCommand = content === prefix + 'روليت';
    const isEnglishCommand = content.startsWith(prefix + 'roulette');
    const isStopCommand = content === prefix + 'قف';

    if (!isArabicCommand && !isEnglishCommand && !isStopCommand) return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'roulette')) return;

    const channelId = message.channel.id;

    // معالجة أمر الإيقاف
    if (isStopCommand) {
      const g = games.get(channelId);
      if (!g) {
        await message.reply('لا توجد لعبة روليت شغالة في هذه القناة.');
        return;
      }

      // التحقق من الصلاحيات: المضيف أو أدمن
      const isHost = g.hostId === message.author.id;
      const isAdmin = message.member.permissions.has('Administrator');

      if (!isHost && !isAdmin) {
        await message.reply('فقط من أنشأ اللعبة أو المشرف يمكنه إيقافها.');
        return;
      }

      games.delete(channelId);
      if (g.lobbyInterval) {
        clearInterval(g.lobbyInterval);
        g.lobbyInterval = null;
      }

      await message.reply('🛑 تم إيقاف اللعبة بنجاح.');
      return;
    }
    const game = getOrCreateGame(channelId, message.member);

    if (game.started || game.lobbyEndsAt) {
      await message.reply('هناك لعبة روليت شغالة بالفعل في هذه القناة.');
      return;
    }

    game.players.clear();
    game.slots = Array.from({ length: MAX_SLOTS }, () => null);
    game.userToSlot.clear();
    game.started = false;
    game.currentPlayerId = null;

    const now = Date.now();
    game.lobbyEndsAt = now + LOBBY_SECONDS * 1000;

    const embed = buildLobbyEmbed(game, LOBBY_SECONDS);
    const components = buildSlotRows(game, false);

    const lobbyMessage = await message.channel.send({ embeds: [embed], components });
    game.lobbyMessageId = lobbyMessage.id;

    game.lobbyInterval = setInterval(async () => {
      const g = games.get(channelId);
      if (!g) return;
      const remainingMs = g.lobbyEndsAt - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      if (remainingSeconds <= 0) {
        clearInterval(g.lobbyInterval);
        g.lobbyInterval = null;

        try {
          await lobbyMessage.edit({
            embeds: [buildLobbyEmbed(g, 0)],
            components: buildSlotRows(g, true)
          });
        } catch (e) {
          console.error('roulette.js => failed to edit lobby message on end:', e);
        }

        const channel = message.channel;
        g.lobbyEndsAt = null;
        await startRoundInChannel(channel, g);
        return;
      }

      try {
        await lobbyMessage.edit({
          embeds: [buildLobbyEmbed(g, remainingSeconds)],
          components: buildSlotRows(g, false)
        });
      } catch (e) {
        console.error('roulette.js => failed to edit lobby message:', e);
      }
    }, LOBBY_TICK_MS);
  });

  // تفاعل الأزرار
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    const channelId = interaction.channelId;
    const game = games.get(channelId);

    if (!game) return;

    if (customId.startsWith('roulette_slot_')) {
      if (game.started || !game.lobbyEndsAt) {
        await interaction.reply({ content: 'لا يمكن الاشتراك الآن.', ephemeral: true });
        return;
      }

      if (game.players.size >= MAX_SLOTS && !game.players.has(interaction.user.id)) {
        await interaction.reply({ content: 'اللعبة وصلت للحد الأقصى (20 لاعب).', ephemeral: true });
        return;
      }

      const slot = parseInt(customId.replace('roulette_slot_', ''), 10);
      if (Number.isNaN(slot) || slot < 1 || slot > MAX_SLOTS) {
        await interaction.reply({ content: 'رقم غير صالح.', ephemeral: true });
        return;
      }

      const idx = slot - 1;
      if (game.slots[idx]) {
        await interaction.reply({ content: 'هذا الرقم محجوز بالفعل.', ephemeral: true });
        return;
      }

      const prevSlot = game.userToSlot.get(interaction.user.id);
      if (typeof prevSlot === 'number') {
        game.slots[prevSlot - 1] = null;
      }

      game.slots[idx] = interaction.user.id;
      game.userToSlot.set(interaction.user.id, slot);
      game.players.set(interaction.user.id, interaction.member);

      const remainingSeconds = Math.max(0, Math.ceil((game.lobbyEndsAt - Date.now()) / 1000));
      await interaction.update({
        embeds: [buildLobbyEmbed(game, remainingSeconds)],
        components: buildSlotRows(game, false)
      });
      return;
    }

    if (customId === 'roulette_leave') {
      if (game.started || !game.lobbyEndsAt) {
        await interaction.reply({ content: 'لا يمكن الانسحاب الآن.', ephemeral: true });
        return;
      }

      if (!game.players.has(interaction.user.id)) {
        await interaction.reply({ content: 'أنت لست مشاركًا في هذه اللعبة.', ephemeral: true });
        return;
      }

      const prevSlot = game.userToSlot.get(interaction.user.id);
      if (typeof prevSlot === 'number') {
        game.slots[prevSlot - 1] = null;
        game.userToSlot.delete(interaction.user.id);
      }
      game.players.delete(interaction.user.id);

      const remainingSeconds = Math.max(0, Math.ceil((game.lobbyEndsAt - Date.now()) / 1000));
      await interaction.update({
        embeds: [buildLobbyEmbed(game, remainingSeconds)],
        components: buildSlotRows(game, false)
      });
      return;
    }

    if (customId === 'roulette_cancel') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({
          content: 'فقط من أنشأ اللعبة يمكنه إلغاء اللعبة.',
          ephemeral: true
        });
        return;
      }

      games.delete(channelId);

      if (game.lobbyInterval) {
        clearInterval(game.lobbyInterval);
        game.lobbyInterval = null;
      }

      await interaction.update({
        content: '❌ تم إلغاء لعبة الروليت.',
        embeds: [],
        components: []
      });
      return;
    }

    if (customId.startsWith('roulette_kick_')) {
      const targetId = customId.replace('roulette_kick_', '');
      await handleKick(interaction, game, targetId);
    }
  });
}

module.exports = { register };
