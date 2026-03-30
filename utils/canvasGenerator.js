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
            comment: { x: 50, y: 180, size: 24, color: '#ffffff' }
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
                const { x, y, size } = settings.avatar;

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
            // Optional: Add stroke for better visibility
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#2c2f33';
            ctx.stroke();
        }

        // Stars
        if (settings.rating) {
            const starCount = Math.min(Math.max(parseInt(stars) || 0, 0), 5);
            const size = settings.rating.size || 40;
            const x = settings.rating.x;
            const y = settings.rating.y; // Top-left roughly
            const gap = 10;

            // We need to shift drawing because drawStar uses center (cx, cy)
            // If settings.rating.x/y is "top-left" of the text, we should adjust.
            // Let's assume x,y is the start position. 
            // Radius = size / 2.

            for (let i = 0; i < 5; i++) {
                const cx = x + (size / 2) + (i * (size + gap));
                const cy = y + (size / 2);

                const isFilled = i < starCount;
                const color = isFilled ? (settings.rating.color || '#ffd700') : '#444444'; // Grey for empty

                // Draw Star
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

        return canvas.toBuffer();
    },

    generateWelcomeImage: async (member, imageSettings) => {
        const width = 800;
        const height = 400;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Defaults
        const settings = imageSettings || {
            background: null,
            avatar: { x: 50, y: 50, size: 100 },
            username: { x: 170, y: 90, size: 36, color: '#ffffff' },
            text: { x: 170, y: 140, size: 28, color: '#ffffff' },
            footer: { x: 170, y: 180, size: 20, color: '#aaaaaa' }
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
                console.error("Failed to load welcome background", e);
                // Fallback
                try {
                    const fallback = await Canvas.loadImage(path.join(__dirname, '../../public/img/welcome-bg.png'));
                    ctx.drawImage(fallback, 0, 0, width, height);
                } catch (err) {
                    ctx.fillStyle = '#23272A';
                    ctx.fillRect(0, 0, width, height);
                }
            }
        } else {
            // Fallback
            try {
                const fallback = await Canvas.loadImage(path.join(__dirname, '../../public/img/welcome-bg.png'));
                ctx.drawImage(fallback, 0, 0, width, height);
            } catch (err) {
                ctx.fillStyle = '#23272A';
                ctx.fillRect(0, 0, width, height);
            }
        }

        ctx.textBaseline = 'top';

        // Avatar
        if (settings.avatar) {
            const avatarSize = settings.avatar.size || 100;
            const avatarX = settings.avatar.x || 50;
            const avatarY = settings.avatar.y || 50;

            try {
                const avatarURL = member.user.displayAvatarURL({ extension: 'png' });
                const avatar = await Canvas.loadImage(avatarURL);

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();

                // Border
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
                ctx.stroke();

            } catch (e) {
                console.error("Failed to draw avatar", e);
            }
        }

        // Username
        if (settings.username) {
            ctx.font = `bold ${settings.username.size}px Arial`;
            ctx.fillStyle = settings.username.color;
            ctx.fillText(member.user.username, settings.username.x, settings.username.y);
        }

        // Welcome Text 
        if (settings.text) {
            const text = `Welcome to ${member.guild.name}`;
            ctx.font = `bold ${settings.text.size}px Arial`;
            ctx.fillStyle = settings.text.color;
            ctx.fillText(text, settings.text.x, settings.text.y);
        }

        // Footer
        if (settings.footer) {
            const text = `Member #${member.guild.memberCount}`;
            ctx.font = `bold ${settings.footer.size}px Arial`;
            ctx.fillStyle = settings.footer.color;
            ctx.fillText(text, settings.footer.x, settings.footer.y);
        }

        // Dynamic Elements
        if (settings.elements && Array.isArray(settings.elements)) {
            for (const el of settings.elements) {
                try {
                    if (el.type === 'extra-avatar') {
                        // Same as main avatar but maybe different size/pos
                        const size = 80; // Fixed size in simulation, use el.size if added
                        const x = parseInt(el.x);
                        const y = parseInt(el.y);

                        const avatarURL = member.user.displayAvatarURL({ extension: 'png' });
                        const avatar = await Canvas.loadImage(avatarURL);

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatar, x, y, size, size);
                        ctx.restore();
                        // Border
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#ffffff';
                        ctx.stroke();

                    } else if (el.type === 'server-icon') {
                        const size = 80;
                        const x = parseInt(el.x);
                        const y = parseInt(el.y);

                        if (member.guild.iconURL()) {
                            const iconURL = member.guild.iconURL({ extension: 'png' });
                            const icon = await Canvas.loadImage(iconURL);

                            ctx.save();
                            // Rounded Rect
                            ctx.beginPath();
                            // ctx.roundRect(x, y, size, size, 12); // Node Canvas might not support roundRect yet
                            // Fallback rect
                            ctx.rect(x, y, size, size);
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
