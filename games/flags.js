const { isGameAllowed } = require('../utils/gameChecks');
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// قائمة أعلام (بدون إسرائيل)
// يمكنك إضافة المزيد حسب الحاجة
const FLAGS = [
  { emoji: '🇸🇦', names: ['السعودية', 'المملكة العربية السعودية', 'Saudi Arabia', 'saudi arabia'] },
  { emoji: '🇪🇬', names: ['مصر', 'Egypt', 'egypt'] },
  { emoji: '🇦🇪', names: ['الامارات', 'الإمارات', 'الإمارات العربية المتحدة', 'United Arab Emirates', 'uae', 'UAE'] },
  { emoji: '🇶🇦', names: ['قطر', 'Qatar', 'qatar'] },
  { emoji: '🇰🇼', names: ['الكويت', 'Kuwait', 'kuwait'] },
  { emoji: '🇧🇭', names: ['البحرين', 'Bahrain', 'bahrain'] },
  { emoji: '🇴🇲', names: ['عمان', 'عُمان', 'سلطنة عمان', 'Oman', 'oman'] },
  { emoji: '🇾🇪', names: ['اليمن', 'Yemen', 'yemen'] },
  { emoji: '🇱🇧', names: ['لبنان', 'Lebanon', 'lebanon'] },
  { emoji: '🇸🇾', names: ['سوريا', 'Syrian', 'Syria', 'syria'] },
  { emoji: '🇮🇶', names: ['العراق', 'Iraq', 'iraq'] },
  { emoji: '🇯🇴', names: ['الأردن', 'الاردن', 'Jordan', 'jordan'] },
  { emoji: '🇵🇸', names: ['فلسطين', 'Palestine', 'palestine', 'State of Palestine'] },
  { emoji: '🇹🇳', names: ['تونس', 'Tunisia', 'tunisia'] },
  { emoji: '🇩🇿', names: ['الجزائر', 'Algeria', 'algeria'] },
  { emoji: '🇲🇦', names: ['المغرب', 'Morocco', 'morocco'] },
  { emoji: '🇱🇾', names: ['ليبيا', 'Libya', 'libya'] },
  { emoji: '🇸🇩', names: ['السودان', 'Sudan', 'sudan'] },
  { emoji: '🇹🇷', names: ['تركيا', 'Turkey', 'turkey'] },
  { emoji: '🇩🇪', names: ['المانيا', 'ألمانيا', 'Germany', 'germany'] },
  { emoji: '🇫🇷', names: ['فرنسا', 'France', 'france'] },
  { emoji: '🇮🇹', names: ['ايطاليا', 'إيطاليا', 'Italy', 'italy'] },
  { emoji: '🇪🇸', names: ['اسبانيا', 'إسبانيا', 'Spain', 'spain'] },
  { emoji: '🇬🇧', names: ['بريطانيا', 'المملكة المتحدة', 'United Kingdom', 'uk', 'UK', 'England', 'england'] },
  { emoji: '🇺🇸', names: ['امريكا', 'أمريكا', 'الولايات المتحدة', 'United States', 'usa', 'USA', 'US', 'America'] },
  { emoji: '🇧🇷', names: ['البرازيل', 'Brazil', 'brazil'] },
  { emoji: '🇦🇷', names: ['الارجنتين', 'Argentina', 'argentina'] },
  { emoji: '🇲🇽', names: ['المكسيك', 'Mexico', 'mexico'] },
  { emoji: '🇨🇦', names: ['كندا', 'Canada', 'canada'] },
  { emoji: '🇯🇵', names: ['اليابان', 'Japan', 'japan'] },
  { emoji: '🇨🇳', names: ['الصين', 'China', 'china'] },
  { emoji: '🇰🇷', names: ['كوريا الجنوبية', 'كوريا', 'South Korea', 'south korea', 'korea'] },
  { emoji: '🇮🇳', names: ['الهند', 'India', 'india'] },
  { emoji: '🇵🇰', names: ['باكستان', 'Pakistan', 'pakistan'] },
  { emoji: '🇮🇩', names: ['اندونيسيا', 'إندونيسيا', 'Indonesia', 'indonesia'] },
  { emoji: '🇲🇾', names: ['ماليزيا', 'Malaysia', 'malaysia'] },
  { emoji: '🇦🇺', names: ['استراليا', 'أستراليا', 'Australia', 'australia'] },
  { emoji: '🇿🇦', names: ['جنوب افريقيا', 'جنوب أفريقيا', 'South Africa', 'south africa'] }
];

// حالة اللعبة لكل قناة حتى لا تتكرر
const activeChannels = new Set();

function normalize(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pickRandomFlag() {
  const idx = Math.floor(Math.random() * FLAGS.length);
  return FLAGS[idx];
}

function getTwemojiUrl(emoji) {
  const codepoints = Array.from(emoji)
    .map((c) => c.codePointAt(0).toString(16))
    .join('-');
  return `https://twemoji.maxcdn.com/v/latest/72x72/${codepoints}.png`;
}

async function createFlagImage(emoji) {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const res = await fetch(getTwemojiUrl(emoji));
  if (!res.ok) throw new Error(`Failed to fetch flag image: ${res.status}`);
  const ab = await res.arrayBuffer();
  const img = await loadImage(Buffer.from(ab));

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const padding = 24;
  const targetSize = size - padding * 2;
  ctx.drawImage(img, padding, padding, targetSize, targetSize);

  return canvas.toBuffer('image/png');
}

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    const prefix = client.db.get('settings.prefix').value() || '!';
    if (content !== prefix + 'اعلام') return;

    if (!isGameAllowed(client, message.guild.id, message.channel.id, 'flags')) return;

    const channelId = message.channel.id;

    if (activeChannels.has(channelId)) {
      await message.reply('هناك جولة أعلام شغالة بالفعل في هذه القناة، انتظر حتى تنتهي.');
      return;
    }

    activeChannels.add(channelId);

    const flag = pickRandomFlag();

    let buffer;
    try {
      buffer = await createFlagImage(flag.emoji);
    } catch (err) {
      console.error('flags.js:+اعلام => failed to create image:', err);
      buffer = null;
    }

    const files = [];
    if (buffer) files.push(new AttachmentBuilder(buffer, { name: 'SPOILER_flag.png' }));

    const embed = new EmbedBuilder()
      .setTitle('🚩 لعبة الأعلام')
      .setDescription('اكتب اسم الدولة الصحيحة لهذا العلم في الشات!\nأول شخص يجاوب صح خلال **8 ثواني** يفوز.')
      .setColor(0x1f2937)
      .setTimestamp();

    if (buffer) {
      embed.setImage('attachment://SPOILER_flag.png');
    } else {
      embed.addFields({ name: 'العلم', value: flag.emoji, inline: true });
    }

    await message.channel.send({ embeds: [embed], files });

    const filter = (m) => {
      if (m.author.bot) return false;
      const normalized = normalize(m.content);
      return flag.names.some((name) => normalize(name) === normalized);
    };

    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 8000,
        errors: ['time']
      });

      const winnerMsg = collected.first();
      await message.channel.send({
        content: `👑 - <@${winnerMsg.author.id}>, فاز باللعبة!`
      });
    } catch (err) {
      await message.channel.send('⏰ انتهى الوقت! لم يجب أحد إجابة صحيحة.');
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = { register };
