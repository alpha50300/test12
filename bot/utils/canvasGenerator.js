const Canvas = require('canvas');
const path = require('path');

module.exports = {
    generateFeedbackImage: async (user, comment, stars, imageSettings) => {
        const width = 800;
        const height = 400;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Defaults
        const settings = imageSettings || {
            enabled: true,
            background: null,
            avatar: { x: 50, y: 50, size: 100 },
            username: { x: 170, y: 90, size: 32, color: '#ffffff' },
            rating: { x: 170, y: 130, size: 40, color: '#ffd700' },
            comment: { x: 50, y: 180, size: 24, color: '#ffffff' },
            elements: []
        };

        // Background
        if (settings.background) {
            try {
                let bgPath = settings.background;
                if (bgPath.startsWith('/')) {
                    bgPath = path.join(process.cwd(), 'public', bgPath);
                }
                const background = await Canvas.loadImage(bgPath);
                ctx.drawImage(background, 0, 0, width, height);
            } catch (e) {
                console.error("Failed to load feedback background", e);
                ctx.fillStyle = '#23272A';
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            ctx.fillStyle = '#23272A';
            ctx.fillRect(0, 0, width, height);
        }

        // Helper
        ctx.textBaseline = 'top';

        // Avatar
        if (settings.avatar) {
            try {
                const avatarURL = user.displayAvatarURL({ extension: 'png' });
                const avatar = await Canvas.loadImage(avatarURL);
                const { x, y } = settings.avatar;
                const size = settings.avatar.size || 100;

                ctx.save();
                ctx.beginPath();
                ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, x, y, size, size);
                ctx.restore();
                // Border
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
                ctx.stroke();
            } catch (e) { console.error("Avatar error", e); }
        }

        // Username
        if (settings.username) {
            ctx.font = `bold ${settings.username.size}px Arial`;
            ctx.fillStyle = settings.username.color;
            ctx.fillText(user.username, settings.username.x, settings.username.y);
        }

        // Helper to draw star
        const drawStar = (ctx, cx, cy, outerRadius, innerRadius, color) => {
            const spikes = 5;
            let rot = Math.PI / 2 * 3;
            let x = cx;
            let y = cy;
            let step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#2c2f33';
            ctx.stroke();
        }

        // Stars
        if (settings.rating) {
            const starCount = Math.min(Math.max(parseInt(stars) || 0, 0), 5);
            const size = settings.rating.size || 40;
            const x = settings.rating.x;
            const y = settings.rating.y;
            const gap = 10;

            for (let i = 0; i < 5; i++) {
                const cx = x + (size / 2) + (i * (size + gap));
                const cy = y + (size / 2);
                const isFilled = i < starCount;
                const color = isFilled ? (settings.rating.color || '#ffd700') : '#444444';

                drawStar(ctx, cx, cy, size / 2, size / 4, color);
            }
        }

        // Comment
        if (settings.comment) {
            ctx.font = `${settings.comment.size}px Arial`;
            ctx.fillStyle = settings.comment.color;
            const maxLineWidth = 700;
            const words = comment.split(' ');
            let line = '';
            let y = settings.comment.y;
            const lineHeight = settings.comment.size + 10;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxLineWidth && n > 0) {
                    ctx.fillText(line, settings.comment.x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, settings.comment.x, y);
        }

        // Extra Elements
        if (settings.elements && Array.isArray(settings.elements)) {
            for (const el of settings.elements) {
                try {
                    if (el.type === 'extra-avatar') {
                        const avatarURL = user.displayAvatarURL({ extension: 'png' });
                        const avatar = await Canvas.loadImage(avatarURL);
                        const size = 80; // Default or make configurable?
                        const x = parseInt(el.x);
                        const y = parseInt(el.y);

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatar, x, y, size, size);
                        ctx.restore();
                    } else if (el.type === 'server-icon') {
                        if (user.guild && user.guild.iconURL()) {
                            const iconURL = user.guild.iconURL({ extension: 'png' });
                            const icon = await Canvas.loadImage(iconURL);
                            const size = 80;
                            const x = parseInt(el.x);
                            const y = parseInt(el.y);

                            ctx.save();
                            ctx.beginPath();
                            ctx.roundRect(x, y, size, size, 12);
                            ctx.closePath();
                            ctx.clip();
                            ctx.drawImage(icon, x, y, size, size);
                            ctx.restore();
                        }
                    } else if (el.type === 'custom-text') {
                        ctx.font = `24px Arial`;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(el.content || 'Text', parseInt(el.x), parseInt(el.y));
                    }
                } catch (e) {
                    console.error("Error drawing dynamic element", e);
                }
            }
        }

        return canvas.toBuffer();
    },

    generateWelcomeImage: async (member, imageSettings) => {
        // ProBot-style: 1024 x 300 px
        const W = 1024, H = 300;
        const canvas = Canvas.createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        const s = imageSettings || {};

        // ── 1. Background ──────────────────────────────────────────────
        // Support both `url` (new) and `background` (old) field names
        const bgPath = s.url || s.background;
        let bgLoaded = false;

        if (bgPath) {
            try {
                let p = bgPath.startsWith('/') ? path.join(process.cwd(), 'public', bgPath) : bgPath;
                const bg = await Canvas.loadImage(p);
                ctx.drawImage(bg, 0, 0, W, H);
                bgLoaded = true;
            } catch (e) { /* fall through */ }
        }

        if (!bgLoaded) {
            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, '#1a1c2e');
            grad.addColorStop(0.5, '#2d1b69');
            grad.addColorStop(1, '#11998e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        // ── 2. Dark overlay ────────────────────────────────────────────
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, W, H);

        // ── 3. Side bars ───────────────────────────────────────────────
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(0, 0, 4, H);
        ctx.fillRect(W - 4, 0, 4, H);

        // ── 4. Avatar — position from settings or default centred ──────
        const avatarSize = 120;
        const avX = (s.avatar?.x !== undefined) ? s.avatar.x : (W - avatarSize) / 2;
        const avY = (s.avatar?.y !== undefined) ? s.avatar.y : 30;
        const cx = avX + avatarSize / 2;
        const cy = avY + avatarSize / 2;

        try {
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);

            // Glow ring
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#7289da';
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2 + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#7289da';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            // White border
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2 + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Clip & draw avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, avX, avY, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#40444b';
            ctx.fill();
        }

        // ── 5. "WELCOME" label ─────────────────────────────────────────
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('W E L C O M E', W / 2, avY + avatarSize + 18);

        // ── 6. Username — position from settings ───────────────────────
        const unX = (s.username?.x !== undefined) ? s.username.x : W / 2;
        const unY = (s.username?.y !== undefined) ? s.username.y : avY + avatarSize + 44;
        const unFont = s.username?.size || '36px';
        const unColor = s.username?.color || '#ffffff';

        const username = member.user.username;
        let fontSize = parseInt(unFont) || 36;
        ctx.font = `bold ${fontSize}px Arial`;
        while (ctx.measureText(username).width > W - 200 && fontSize > 18) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px Arial`;
        }
        ctx.fillStyle = unColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#7289da';
        ctx.fillText(username, unX, unY);
        ctx.shadowBlur = 0;

        // ── 7. Server line ─────────────────────────────────────────────
        const txX = (s.text?.x !== undefined) ? s.text.x : W / 2;
        const txY = (s.text?.y !== undefined) ? s.text.y : unY + 34;
        const txColor = s.text?.color || 'rgba(255,255,255,0.75)';

        const serverName = member.guild.name;
        ctx.font = '20px Arial';
        ctx.fillStyle = txColor;
        let wLine = `You are now a member of ${serverName}`;
        while (ctx.measureText(wLine).width > W - 60 && wLine.length > 10) {
            wLine = wLine.slice(0, -4) + '…';
        }
        ctx.fillText(wLine, txX, txY);

        // ── 8. Member count badge ──────────────────────────────────────
        const ftX = (s.footer?.x !== undefined) ? s.footer.x : W / 2;
        const ftY = (s.footer?.y !== undefined) ? s.footer.y : txY + 34;
        const memberText = `Member #${member.guild.memberCount}`;
        ctx.font = 'bold 14px Arial';
        const tw = ctx.measureText(memberText).width + 26;
        const badgeX = ftX - tw / 2;

        ctx.fillStyle = 'rgba(114, 137, 218, 0.25)';
        ctx.beginPath();
        ctx.roundRect(badgeX, ftY - 13, tw, 26, 13);
        ctx.fill();
        ctx.strokeStyle = 'rgba(114,137,218,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#7289da';
        ctx.fillText(memberText, ftX, ftY);

        return canvas.toBuffer('image/png');
    },

    generateColorImage: async (user, hexColor, roleName, userCount) => {

        const width = 400;
        const height = 200;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Dark)
        ctx.fillStyle = '#2C2F33';
        ctx.fillRect(0, 0, width, height);

        // Color Circle
        const circleRadius = 50;
        const circleX = 80;
        const circleY = 100;

        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = hexColor;
        ctx.fill();

        // Border
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Color Name
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = hexColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(roleName, 150, 70);

        // User Count
        ctx.font = '20px Arial';
        ctx.fillStyle = '#99AAB5';
        ctx.fillText(`${userCount} users have this color`, 150, 110);

        // User Avatar (small)
        try {
            const avatarURL = user.displayAvatarURL({ extension: 'png', size: 64 });
            const avatar = await Canvas.loadImage(avatarURL);
            const avatarSize = 40;
            const avatarX = 150;
            const avatarY = 130;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // "Your new color!" text
            ctx.font = '16px Arial';
            ctx.fillStyle = '#57F287';
            ctx.fillText('Your new color!', avatarX + avatarSize + 10, avatarY + avatarSize / 2 + 5);
        } catch (e) {
            console.error('Avatar error in color image:', e);
        }

        return canvas.toBuffer();
    },

    generateColorOverview: async (colors, guild) => {
        // colors = array of { name, hex }
        // For each color, we check the role member count
        const colorsPerRow = 4;
        const colorBoxSize = 80;
        const gap = 20;
        const padding = 30;
        const textHeight = 40;

        const rows = Math.ceil(colors.length / colorsPerRow);
        const width = padding * 2 + (colorBoxSize + gap) * colorsPerRow - gap;
        const height = padding * 2 + (colorBoxSize + textHeight + gap) * rows - gap;

        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2C2F33';
        ctx.fillRect(0, 0, width, height);

        // Draw each color box
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const row = Math.floor(i / colorsPerRow);
            const col = i % colorsPerRow;

            const x = padding + col * (colorBoxSize + gap);
            const y = padding + row * (colorBoxSize + textHeight + gap);

            // Get role member count
            const role = guild.roles.cache.find(r => r.name === color.name);
            const count = role ? role.members.size : 0;

            // Draw circle
            const radius = colorBoxSize / 2;
            ctx.beginPath();
            ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fillStyle = color.hex;
            ctx.fill();

            // Border
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();

            // Color name
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(color.name, x + radius, y + colorBoxSize + 15);

            // User count
            ctx.font = '10px Arial';
            ctx.fillStyle = '#99AAB5';
            ctx.fillText(`${count} users`, x + radius, y + colorBoxSize + 30);
        }

        return canvas.toBuffer();
    }
};
