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

const games = new Map(); // key: channelId

const XO_SIZE = 512;
const GRID_PADDING = 56;
const INACTIVITY_MS = 2 * 60 * 1000;

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }

  if (board.every((v) => v)) return { winner: 'draw', line: null };
  return { winner: null, line: null };
}

function renderBoard(board, winningLine) {
  const canvas = createCanvas(XO_SIZE, XO_SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, XO_SIZE, XO_SIZE);

  const boardSize = XO_SIZE - GRID_PADDING * 2;
  const cell = boardSize / 3;

  const x0 = GRID_PADDING;
  const y0 = GRID_PADDING;

  // Grid
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';

  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * cell, y0);
    ctx.lineTo(x0 + i * cell, y0 + boardSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0, y0 + i * cell);
    ctx.lineTo(x0 + boardSize, y0 + i * cell);
    ctx.stroke();
  }

  // Draw marks
  for (let i = 0; i < 9; i++) {
    const mark = board[i];
    if (!mark) continue;

    const r = Math.floor(i / 3);
    const c = i % 3;
    const cx = x0 + c * cell + cell / 2;
    const cy = y0 + r * cell + cell / 2;

    const pad = cell * 0.22;

    if (mark === 'X') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 18;

      ctx.beginPath();
      ctx.moveTo(cx - cell / 2 + pad, cy - cell / 2 + pad);
      ctx.lineTo(cx + cell / 2 - pad, cy + cell / 2 - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + cell / 2 - pad, cy - cell / 2 + pad);
      ctx.lineTo(cx - cell / 2 + pad, cy + cell / 2 - pad);
      ctx.stroke();
    }

    if (mark === 'O') {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Winning highlight
  if (Array.isArray(winningLine) && winningLine.length === 3) {
    const [a, , c] = winningLine;

    const ra = Math.floor(a / 3);
    const ca = a % 3;
    const rc = Math.floor(c / 3);
    const cc = c % 3;

    const ax = x0 + ca * cell + cell / 2;
    const ay = y0 + ra * cell + cell / 2;
    const cx = x0 + cc * cell + cell / 2;
    const cy = y0 + rc * cell + cell / 2;

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  return canvas.toBuffer('image/png');
}

function buildButtons(game, disabledAll = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const used = Boolean(game.board[idx]);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`xo_move_${idx}`)
          .setLabel('\u200B')
          .setStyle(used ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(disabledAll || used)
      );
    }

    // زر إلغاء اللعبة بجانب الأزرار (مرة واحدة فقط)
    if (r === 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('xo_cancel')
          .setLabel('إلغاء اللعبة')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabledAll)
      );
    }

    rows.push(row);
  }
  return rows;
}

function buildEmbed(game) {
  const isBotGame = game.mode === 'bot';

  let vsLine;
  if (isBotGame) {
    vsLine = `ضد البوت`;
  } else {
    vsLine = `<@${game.xId}> ضد <@${game.oId}>`;
  }

  const turnId = game.turn === 'X' ? game.xId : game.oId;

  const embed = new EmbedBuilder()
    .setTitle('❌⭕ اكس او')
    .setDescription(`${vsLine}\n\n🎯 الدور على: <@${turnId}>`)
    .setImage('attachment://xo.png')
    .setColor(0x1f2937)
    .setTimestamp();

  return embed;
}

function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < 9; i++) if (!board[i]) moves.push(i);
  return moves;
}

function computeBotMove(board) {
  // Simple strategy: win, block, center, corners, random.
  const tryWin = (mark) => {
    for (const move of getAvailableMoves(board)) {
      const copy = board.slice();
      copy[move] = mark;
      const res = checkWinner(copy);
      if (res.winner === mark) return move;
    }
    return null;
  };

  const win = tryWin('O');
  if (typeof win === 'number') return win;

  const block = tryWin('X');
  if (typeof block === 'number') return block;

  if (!board[4]) return 4;

  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

  const moves = getAvailableMoves(board);
  if (!moves.length) return null;
  return moves[Math.floor(Math.random() * moves.length)];
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
      await current.channel.send('⏳ انتهت اللعبة بسبب عدم التفاعل.');
    } catch { }

    clearGame(channelId);
  }, INACTIVITY_MS);
}

let registered = false;

function register(client) {
  if (registered) return;
  registered = true;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (!content.startsWith(prefix + 'اكس')) return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'xo')) return;

    const channelId = message.channel.id;
    if (games.has(channelId)) {
      await message.reply('في لعبة اكس او شغالة بالفعل في القناة دي.');
      return;
    }

    const mentioned = message.mentions.users.first();

    let mode = 'bot';
    let oId = client.user.id;

    if (mentioned && !mentioned.bot && mentioned.id !== message.author.id) {
      mode = 'pvp';
      oId = mentioned.id;
    }

    const game = {
      channel: message.channel,
      channelId,
      mode,
      xId: message.author.id,
      oId,
      turn: 'X',
      board: Array(9).fill(null),
      messageId: null,
      timeout: null
    };

    games.set(channelId, game);

    const buffer = renderBoard(game.board, null);
    const attachment = new AttachmentBuilder(buffer, { name: 'xo.png' });

    const sent = await message.channel.send({
      embeds: [buildEmbed(game)],
      files: [attachment],
      components: buildButtons(game, false)
    });

    game.messageId = sent.id;
    bumpTimeout(channelId);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    if (!customId.startsWith('xo_move_') && customId !== 'xo_cancel') return;

    const channelId = interaction.channelId;
    const game = games.get(channelId);
    if (!game) return;

    if (interaction.message.id !== game.messageId) {
      await interaction.reply({ content: 'دي رسالة قديمة للعبة.', ephemeral: true });
      return;
    }

    if (customId === 'xo_cancel') {
      if (interaction.user.id !== game.xId) {
        await interaction.reply({ content: 'فقط صاحب اللعبة يقدر يلغيها.', ephemeral: true });
        return;
      }

      const buffer = renderBoard(game.board, null);
      const attachment = new AttachmentBuilder(buffer, { name: 'xo.png' });

      clearGame(channelId);
      await interaction.update({
        content: '❌ تم إلغاء لعبة اكس او.',
        embeds: [
          new EmbedBuilder()
            .setTitle('❌⭕ اكس او')
            .setDescription('تم إلغاء اللعبة.')
            .setImage('attachment://xo.png')
            .setColor(0x1f2937)
            .setTimestamp()
        ],
        files: [attachment],
        components: buildButtons({ board: game.board }, true)
      });
      return;
    }

    const idx = parseInt(customId.replace('xo_move_', ''), 10);
    if (Number.isNaN(idx) || idx < 0 || idx > 8) {
      await interaction.reply({ content: 'حركة غير صالحة.', ephemeral: true });
      return;
    }

    const expectedUserId = game.turn === 'X' ? game.xId : game.oId;
    if (interaction.user.id !== expectedUserId) {
      await interaction.reply({ content: 'مش دورك.', ephemeral: true });
      return;
    }

    if (game.board[idx]) {
      await interaction.reply({ content: 'الخانة دي متاخدة.', ephemeral: true });
      return;
    }

    bumpTimeout(channelId);

    // Apply move
    game.board[idx] = game.turn;

    let res = checkWinner(game.board);

    // Bot move if needed
    if (!res.winner && game.mode === 'bot') {
      game.turn = 'O';
      const botMove = computeBotMove(game.board);
      if (typeof botMove === 'number' && !game.board[botMove]) {
        game.board[botMove] = 'O';
      }
      res = checkWinner(game.board);
      if (!res.winner) game.turn = 'X';
    } else if (!res.winner) {
      game.turn = game.turn === 'X' ? 'O' : 'X';
    }

    const buffer = renderBoard(game.board, res.line);
    const attachment = new AttachmentBuilder(buffer, { name: 'xo.png' });

    if (res.winner) {
      let content;
      if (res.winner === 'draw') {
        content = '🤝 تعادل!';
      } else {
        const winnerId = res.winner === 'X' ? game.xId : game.oId;
        content = `👑 الفائز: <@${winnerId}>`;
      }

      clearGame(channelId);

      await interaction.update({
        content,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌⭕ اكس او')
            .setDescription('انتهت اللعبة.')
            .setImage('attachment://xo.png')
            .setColor(0x1f2937)
            .setTimestamp()
        ],
        files: [attachment],
        components: buildButtons({ board: game.board }, true)
      });
      return;
    }

    await interaction.update({
      embeds: [buildEmbed(game)],
      files: [attachment],
      components: buildButtons(game, false)
    });
  });
}

module.exports = { register };
