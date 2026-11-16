/**
 * 角色 32×32 精修像素画（v5.2）。
 *
 * 相对旧 24×24：
 *  - 头部缩到 10×8，肩、腰、下摆分层，比例不再大头娃娃；
 *  - 每个角色 3 层衣料明暗 + 1px 深色描边，五官只占 6×4；
 *  - 发冠、兜帽、兽耳、伞冠、官帽等轮廓独立，远看也能分辨；
 *  - 2 帧步态 + 发饰/衣摆轻微摆动。
 *
 * 仍然全部由 Canvas 2D 程序化绘制，不依赖图片；运行时接管
 * `char:*` 精灵与 `Art.drawPortrait`，供游戏、选人页与图鉴共用。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const Art = Ink.Art;
  const OUT = '#08070d';
  const SIZE = 32;
  const cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function px(c, x, y, w, h, color) {
    if (!color || w <= 0 || h <= 0) return;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  }

  /** 带 1px 外描边的矩形，像素画最重要的“读轮廓”手段。 */
  function box(c, x, y, w, h, fill, outline) {
    px(c, x - 1, y - 1, w + 2, h + 2, outline || OUT);
    px(c, x, y, w, h, fill);
  }

  function dot(c, x, y, color) {
    px(c, x, y, 1, 1, color);
  }

  function hline(c, x, y, w, color) {
    px(c, x, y, w, 1, color);
  }

  function vline(c, x, y, h, color) {
    px(c, x, y, 1, h, color);
  }

  /**
   * 32×32 共用骨架。
   * o 字段：robe/robeHi/robeDark/sleeve/trim/belt/boot/bootHi/
   *        skin/skinHi/skinDark/hair/hairHi/hairDark/eye/eyeGlow/
   *        accent/cloak/hood
   */
  function base(c, o, frame) {
    const step = frame ? 1 : 0;
    const sway = frame ? 1 : 0;

    // 背后的长发/披风，先把外轮廓撑开。
    if (o.hairBack) {
      px(c, 8, 7, 3, 12, o.hairBack);
      px(c, 21, 7, 3, 12, o.hairBack);
      px(c, 9, 18, 2, 5, o.hairBack);
      px(c, 21, 18, 2, 5, o.hairBack);
    }
    if (o.cloak) {
      px(c, 5, 16, 3, 12, o.cloak);
      px(c, 24, 16, 3, 12, o.cloak);
      px(c, 4, 26, 4, 3, o.cloak);
      px(c, 24, 26, 4, 3, o.cloak);
      px(c, 6, 17, 1, 8, o.cloakHi || o.cloak);
    }

    // 双腿与厚底靴：只错开 1px，避免走路像跳。
    box(c, 11 + step, 27, 4, 3, o.leg || o.robeDark);
    box(c, 17 - step, 27, 4, 3, o.leg || o.robeDark);
    box(c, 9 + step, 29, 6, 2, o.boot);
    box(c, 17 - step, 29, 6, 2, o.boot);
    hline(c, 10 + step, 30, 4, o.bootHi || o.boot);

    // 外袍下摆：内深外亮，中间留一道开衩。
    box(c, 8, 20, 16, 9, o.robeDark);
    px(c, 9, 20, 14, 7, o.robe);
    px(c, 10, 21, 12, 1, o.robeHi || o.robe);
    vline(c, 15 + sway, 23, 5, o.robeDark);
    px(c, 9, 26, 5, 2, o.robeDark);
    px(c, 18, 26, 5, 2, o.robeDark);
    px(c, 9, 20, 2, 5, o.trim);
    px(c, 21, 20, 2, 5, o.trim);

    // 躯干、交领、腰带。
    box(c, 10, 16, 12, 7, o.robe);
    px(c, 11, 16, 10, 1, o.robeHi || o.robe);
    px(c, 14, 16, 2, 5, o.trim);
    px(c, 17, 16, 1, 4, o.robeDark);
    px(c, 12, 18, 2, 1, o.robeDark);
    px(c, 19, 18, 2, 1, o.robeDark);
    hline(c, 10, 22, 12, o.belt || o.robeDark);
    px(c, 15, 22, 2, 1, o.accent);
    dot(c, 18, 23, o.accent);

    // 双臂、袖口和手。
    box(c, 6, 18, 4, 7, o.sleeve || o.robe);
    box(c, 22, 18, 4, 7, o.sleeve || o.robe);
    px(c, 7, 19, 2, 5, o.robeHi || o.robe);
    px(c, 23, 19, 2, 5, o.robeHi || o.robe);
    px(c, 6, 24, 4, 1, o.trim);
    px(c, 22, 24, 4, 1, o.trim);
    box(c, 6, 25, 4, 3, o.skin);
    box(c, 22, 25, 4, 3, o.skin);
    px(c, 6, 25, 1, 3, o.skinDark);
    px(c, 25, 25, 1, 3, o.skinDark);

    // 脖子和头。
    px(c, 13, 14, 6, 3, o.skinDark || o.skin);
    box(c, 10, 7, 12, 9, o.skin);
    px(c, 10, 7, 2, 9, o.skinHi || o.skin);
    px(c, 20, 8, 2, 8, o.skinDark || o.skin);
    px(c, 11, 8, 10, 1, o.skinHi || o.skin);

    // 两侧头发与刘海；发际线压住额头，脸只留中间。
    px(c, 8, 5, 3, 12, o.hairDark || o.hair);
    px(c, 21, 5, 3, 12, o.hairDark || o.hair);
    px(c, 9, 4, 14, 3, o.hair);
    px(c, 10, 6, 12, 2, o.hair);
    px(c, 10, 8, 3, 1, o.hair);
    px(c, 19, 8, 3, 1, o.hair);
    px(c, 11, 4, 6, 1, o.hairHi || o.hair);
    px(c, 8, 5, 3, 1, o.hairHi || o.hair);

    // 五官：小眼睛 + 眼高光，鼻子和嘴只用 1–2px。
    px(c, 12, 11, 2, 2, o.eye);
    px(c, 18, 11, 2, 2, o.eye);
    dot(c, 12 + (frame ? 0 : 1), 11, o.eyeGlow || '#ffffff');
    dot(c, 18 + (frame ? 1 : 0), 11, o.eyeGlow || '#ffffff');
    hline(c, 12, 10, 2, o.hairDark || o.hair);
    hline(c, 18, 10, 2, o.hairDark || o.hair);
    dot(c, 15, 13, o.skinDark || o.skin);
    // 嘴缩成 2px，和 1px 鼻子之间留 1px 肤色，避免连成“胡子”。
    px(c, 15, 14, 2, 1, o.lip || o.skinDark || o.skin);

    // 前襟下摆的纹样，最后画，避免被腰带盖住。
    px(c, 11, 23, 2, 3, o.robeDark);
    px(c, 19, 23, 2, 3, o.robeDark);
    dot(c, 12, 25, o.accent);
    dot(c, 20, 25, o.accent);
  }

  const BUILDERS = {
    qiyun(c, f) {
      base(c, {
        robe: '#243b53', robeHi: '#355773', robeDark: '#152635', sleeve: '#20384e',
        trim: '#c9a35a', belt: '#101c28', boot: '#182737', bootHi: '#3f6078',
        skin: '#f0d0aa', skinHi: '#ffe1bd', skinDark: '#b98563',
        hair: '#1b2029', hairHi: '#3c4655', hairDark: '#0d1116',
        eye: '#10141b', eyeGlow: '#8fd6ff', accent: '#e8c170'
      }, f);
      // 弈者高冠与簪
      px(c, 9, 1, 14, 2, '#0d1116');
      px(c, 10, 0, 12, 2, '#1b2029');
      px(c, 11, 0, 8, 1, '#3c4655');
      px(c, 15, -1, 2, 2, '#e8c170');
      px(c, 22, 3, 3, 2, '#e8c170');
      // 交领与棋纹
      hline(c, 13, 17, 6, '#c9a35a');
      px(c, 11, 24, 2, 2, '#e8c170');
      px(c, 13, 24, 2, 2, '#243b53');
      px(c, 15, 24, 2, 2, '#e8c170');
      px(c, 17, 24, 2, 2, '#243b53');
      // 腰间棋笥
      box(c, 23, 21, 4, 3, '#5d4630', '#1c120c');
      px(c, 24, 21, 1, 1, '#e8c170');
    },

    xiaoying(c, f) {
      base(c, {
        robe: '#2a2033', robeHi: '#463050', robeDark: '#17121e', sleeve: '#33263e',
        trim: '#b74d6b', belt: '#0d0912', boot: '#17121e', bootHi: '#54344a',
        skin: '#efc9a5', skinHi: '#ffdcb8', skinDark: '#b27c60',
        hair: '#17121e', hairHi: '#3b2b45', hairDark: '#08060b',
        eye: '#0b080d', eyeGlow: '#ff8fb3', accent: '#ff5c7a', cloak: '#1f1729'
      }, f);
      // 兜帽轮廓
      px(c, 7, 4, 18, 2, '#0d0912');
      px(c, 8, 5, 16, 2, '#33263e');
      px(c, 9, 7, 2, 6, '#0d0912');
      px(c, 21, 7, 2, 6, '#0d0912');
      // 面罩与红围巾
      px(c, 11, 13, 10, 3, '#17121e');
      px(c, 12, 13, 8, 1, '#3b2b45');
      px(c, 7, 16, 18, 2, '#7f2b40');
      px(c, 8, 17, 13, 1, '#ff8fb3');
      px(c, 23, 17, 3, 4, '#7f2b40');
      // 长发辫
      px(c, 7, 9, 2, 13, '#17121e');
      px(c, 6, 21, 3, 2, '#3b2b45');
      // 双刃
      px(c, 26, 10, 1, 12, '#d9e4f3');
      px(c, 25, 9, 1, 3, '#8fd6ff');
      px(c, 4, 20, 1, 7, '#d9e4f3');
      px(c, 3, 26, 2, 2, '#ff8fb3');
    },

    xinyue(c, f) {
      base(c, {
        robe: '#d9c7b8', robeHi: '#f7e8da', robeDark: '#9f8178', sleeve: '#cfb6ad',
        trim: '#d77f99', belt: '#7a4b58', boot: '#8b6970', bootHi: '#e9c9c4',
        skin: '#f1cfad', skinHi: '#ffe0bd', skinDark: '#bc896c',
        hair: '#2a1c24', hairHi: '#573845', hairDark: '#120a10',
        eye: '#241319', eyeGlow: '#ffd36b', accent: '#ff9bb0', hairBack: '#1d1119'
      }, f);
      // 长发与花簪
      px(c, 8, 9, 2, 18, '#2a1c24');
      px(c, 22, 9, 2, 18, '#2a1c24');
      px(c, 9, 26, 2, 3, '#573845');
      px(c, 21, 26, 2, 3, '#573845');
      box(c, 6, 7, 3, 3, '#ff9bb0', '#4b1e2c');
      box(c, 23, 9, 2, 2, '#ffd36b', '#4b3a14');
      // 心形护符
      px(c, 12, 18, 2, 1, '#ff9bb0');
      px(c, 15, 18, 2, 1, '#ff9bb0');
      px(c, 13, 19, 3, 2, '#ff9bb0');
      dot(c, 14, 20, '#fff3e8');
      // 宽袖
      px(c, 5, 20, 5, 4, '#e9d4c8');
      px(c, 22, 20, 5, 4, '#e9d4c8');
      hline(c, 5, 23, 5, '#d77f99');
      hline(c, 22, 23, 5, '#d77f99');
    },

    ziyu(c, f) {
      base(c, {
        robe: '#302a25', robeHi: '#4c4034', robeDark: '#1a1714', sleeve: '#29241f',
        trim: '#b03a34', belt: '#0e0c0b', boot: '#171412', bootHi: '#5b4a3a',
        skin: '#e6c39f', skinHi: '#f6d7b2', skinDark: '#a87455',
        hair: '#17120f', hairHi: '#3d2c23', hairDark: '#080605',
        eye: '#0c0907', eyeGlow: '#ffd36b', accent: '#e8c170', cloak: '#221c18'
      }, f);
      // 官帽：双层黑翅
      px(c, 8, 2, 16, 3, '#0e0c0b');
      px(c, 10, 0, 12, 3, '#29241f');
      px(c, 11, 0, 10, 1, '#4c4034');
      px(c, 4, 4, 5, 2, '#0e0c0b');
      px(c, 23, 4, 5, 2, '#0e0c0b');
      px(c, 14, 3, 4, 1, '#b03a34');
      // 铁面与短须
      px(c, 11, 12, 10, 2, '#3b2b22');
      px(c, 13, 13, 6, 1, '#17120f');
      // 朱笔
      px(c, 25, 8, 2, 13, '#8b5b3a');
      px(c, 25, 6, 2, 3, '#e8c170');
      px(c, 25, 5, 2, 1, '#f6f0dc');
      // 狱字腰牌
      box(c, 12, 23, 8, 5, '#3a1414', '#0e0c0b');
      px(c, 14, 24, 4, 1, '#e8c170');
      px(c, 15, 25, 2, 2, '#b03a34');
    },

    smartdog(c, f) {
      base(c, {
        robe: '#3d4b2f', robeHi: '#5d7048', robeDark: '#242d1c', sleeve: '#344127',
        trim: '#c29b5e', belt: '#1b2114', boot: '#2c2418', bootHi: '#8a6b3e',
        skin: '#e9c19c', skinHi: '#ffdcb5', skinDark: '#b47f5f',
        hair: '#2a2118', hairHi: '#5a4430', hairDark: '#120d09',
        eye: '#17120d', eyeGlow: '#ffd36b', accent: '#e8c170', cloak: '#2b3321'
      }, f);
      // 狼耳
      px(c, 8, 1, 5, 5, '#2a2118');
      px(c, 19, 1, 5, 5, '#2a2118');
      px(c, 9, 2, 3, 3, '#5a4430');
      px(c, 20, 2, 3, 3, '#5a4430');
      px(c, 9, 5, 3, 2, '#e9c19c');
      px(c, 20, 5, 3, 2, '#e9c19c');
      // 毛领
      px(c, 7, 15, 18, 3, '#6d5437');
      px(c, 8, 16, 16, 1, '#c29b5e');
      // 兽牙项链
      for (let i = 0; i < 5; i++) px(c, 11 + i * 2, 19 + (i % 2), 1, 2, '#f2e4c9');
      // 唤犬骨哨
      px(c, 25, 20, 2, 6, '#efe1c3');
      px(c, 24, 24, 4, 2, '#efe1c3');
      dot(c, 26, 22, '#5a4430');
    },

    mouse(c, f) {
      base(c, {
        robe: '#5b4433', robeHi: '#80654c', robeDark: '#33251c', sleeve: '#4c3729',
        trim: '#d8b08a', belt: '#201711', boot: '#2b2119', bootHi: '#8a6b4b',
        skin: '#f0cba7', skinHi: '#ffe0bb', skinDark: '#b98665',
        hair: '#2b2119', hairHi: '#5a4433', hairDark: '#130d09',
        eye: '#15100c', eyeGlow: '#8ef0c8', accent: '#8ef0c8', cloak: '#3a2b21'
      }, f);
      // 圆鼠耳
      box(c, 7, 2, 6, 6, '#5b4433', '#130d09');
      box(c, 19, 2, 6, 6, '#5b4433', '#130d09');
      px(c, 9, 3, 2, 3, '#d8b08a');
      px(c, 21, 3, 2, 3, '#d8b08a');
      // 额前小护目镜
      px(c, 9, 6, 5, 1, '#8ef0c8');
      px(c, 18, 6, 5, 1, '#8ef0c8');
      px(c, 14, 6, 4, 1, '#201711');
      // 短尾
      px(c, 27, 23, 2, 2, '#b98665');
      px(c, 28, 24, 2, 2, '#b98665');
      // 穿地爪
      px(c, 24, 24, 3, 1, '#d8e4da');
      px(c, 24, 26, 5, 1, '#d8e4da');
      px(c, 24, 28, 4, 1, '#d8e4da');
    },

    autumn(c, f) {
      base(c, {
        robe: '#315a68', robeHi: '#4f8292', robeDark: '#1c3842', sleeve: '#2b4e5a',
        trim: '#9fe0ff', belt: '#132a32', boot: '#1d3037', bootHi: '#6f9aa3',
        skin: '#f2d3ae', skinHi: '#ffe6c4', skinDark: '#b88769',
        hair: '#20353f', hairHi: '#496877', hairDark: '#0d1920',
        eye: '#102228', eyeGlow: '#b7d9ff', accent: '#8fd6ff', cloak: '#254851'
      }, f);
      // 伞冠
      px(c, 4, 0, 24, 2, '#9fe0ff');
      px(c, 2, 2, 28, 2, '#4f8292');
      px(c, 5, 2, 22, 1, '#b7d9ff');
      px(c, 15, 3, 2, 7, '#5b4532');
      px(c, 3, 3, 2, 2, '#8fd6ff');
      px(c, 27, 3, 2, 2, '#8fd6ff');
      // 雨滴
      px(c, 2, 9, 1, 3, '#8fd6ff');
      px(c, 28, 12, 1, 2, '#b7d9ff');
      px(c, 7, 17, 1, 2, '#8fd6ff');
      px(c, 24, 18, 1, 3, '#8fd6ff');
      // 雨披肩
      px(c, 7, 15, 18, 2, '#4f8292');
      px(c, 8, 15, 16, 1, '#9fe0ff');
      // 伞柄
      px(c, 27, 13, 1, 12, '#6b4f36');
      px(c, 26, 24, 3, 1, '#6b4f36');
    },

    sanrui(c, f) {
      base(c, {
        robe: '#5b2b38', robeHi: '#7d4050', robeDark: '#351722', sleeve: '#4a2330',
        trim: '#e8c170', belt: '#1f0d14', boot: '#2b151c', bootHi: '#95604e',
        skin: '#f0cca6', skinHi: '#ffe2ba', skinDark: '#b98565',
        hair: '#28161b', hairHi: '#543039', hairDark: '#11090b',
        eye: '#1a0d10', eyeGlow: '#ffd36b', accent: '#ffe1a6', cloak: '#3e1d28'
      }, f);
      // 三枚瑞印悬浮
      box(c, 1, 6, 5, 5, '#ffd36b', '#3a2a10');
      box(c, 26, 6, 5, 5, '#8ef0c8', '#0f2e25');
      box(c, 13, 0, 6, 4, '#ff9bb0', '#34121c');
      px(c, 2, 7, 3, 1, '#5b2b38');
      px(c, 27, 7, 3, 1, '#1f5a45');
      px(c, 14, 1, 4, 1, '#5b2b38');
      // 三色腰带
      px(c, 9, 22, 14, 1, '#e8c170');
      px(c, 10, 23, 12, 1, '#8ef0c8');
      px(c, 11, 24, 10, 1, '#ff9bb0');
      // 瑞兽面纹
      px(c, 11, 17, 10, 4, '#e8c170');
      dot(c, 12, 18, '#5b2b38');
      dot(c, 19, 18, '#5b2b38');
      px(c, 15, 20, 2, 1, '#5b2b38');
      // 三支发簪
      px(c, 8, 2, 1, 3, '#ffd36b');
      px(c, 15, 1, 1, 4, '#8ef0c8');
      px(c, 22, 2, 1, 3, '#ff9bb0');
    }
  };

  function sprite(id, frame, tint) {
    const key = id + '|' + (frame ? 1 : 0) + '|' + (tint || '');
    const hit = cache.get(key);
    if (hit) return hit;
    const cv = makeCanvas(SIZE, SIZE);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const builder = BUILDERS[id];
    if (builder) {
      builder(c, frame ? 1 : 0);
    } else {
      box(c, 8, 8, 16, 16, '#ff00ff');
      px(c, 11, 12, 10, 1, '#ffffff');
      px(c, 11, 17, 10, 1, '#ffffff');
    }
    if (tint) {
      const t = makeCanvas(SIZE, SIZE);
      const tc = t.getContext('2d');
      tc.drawImage(cv, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = tint;
      tc.fillRect(0, 0, SIZE, SIZE);
      cache.set(key, t);
      return t;
    }
    cache.set(key, cv);
    return cv;
  }

  const originalDraw = Art.drawSprite;
  Art.drawSprite = function (ctx, keyName, x, y, scale, opt) {
    if (!keyName || keyName.indexOf('char:') !== 0) {
      return originalDraw.call(Art, ctx, keyName, x, y, scale, opt);
    }
    opt = opt || {};
    const cv = sprite(keyName.slice(5), opt.frame || 0, opt.tint || null);
    const w = SIZE * scale;
    const bob = opt.bob ? Math.sin((opt.time || 0) * 6.5 + x * 0.03) * opt.bob : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    if (opt.glow) {
      ctx.shadowColor = opt.glow;
      ctx.shadowBlur = 14;
    }
    ctx.translate(x, y + bob);
    if (opt.rotation) ctx.rotate(opt.rotation);
    if (opt.flip) ctx.scale(-1, 1);
    ctx.drawImage(cv, -w / 2, -w / 2, w, w);
    ctx.restore();
  };

  Art.drawPortrait = function (ctx, charId, cx, cy, scale, frame) {
    const cv = sprite(charId, frame || 0, null);
    const w = SIZE * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.62);
    grad.addColorStop(0, 'rgba(232,193,112,.18)');
    grad.addColorStop(1, 'rgba(232,193,112,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w, cy - w, w * 2, w * 2);
    ctx.drawImage(cv, cx - w / 2, cy - w / 2, w, w);
    ctx.restore();
  };

  Art.heroSprite = sprite;
})();
