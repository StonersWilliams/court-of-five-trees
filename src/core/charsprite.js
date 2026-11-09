/**
 * 角色 24×24 精修像素画。
 * 16×16 老版本仍保留在 pixelart.js 作为兼容；本文件在运行时接管
 * `char:*` 精灵与选人半身像，使轮廓、五官、衣褶和角色饰物更清晰。
 * 仍为纯程序化 Canvas 2D，不依赖外部图片。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const Art = Ink.Art;
  const OUT = '#08070d';
  const cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  function box(c, x, y, w, h, fill, outline = OUT) {
    px(c, x - 1, y - 1, w + 2, h + 2, outline);
    px(c, x, y, w, h, fill);
  }

  function dot(c, x, y, color) {
    px(c, x, y, 1, 1, color);
  }

  /**
   * 所有角色共用的 24×24 骨架：
   * 2 帧步态、双层衣摆、交领、腰带、手臂、靴子、脸部高光。
   */
  function base(c, o, frame) {
    const step = frame ? 1 : 0;

    // 披风在身体后面，增加轮廓厚度
    if (o.cloak) {
      px(c, 5, 11, 2, 9, o.cloak);
      px(c, 17, 11, 2, 9, o.cloak);
      px(c, 4, 18, 3, 2, o.cloak);
      px(c, 17, 18, 3, 2, o.cloak);
    }

    // 双腿、靴子；两帧错步
    box(c, 8 + step, 18, 3, 3, o.leg || o.robeDark);
    box(c, 13 - step, 18, 3, 3, o.leg || o.robeDark);
    box(c, 7 + step, 21, 4, 2, o.boot);
    box(c, 13 - step, 21, 4, 2, o.boot);
    px(c, 8 + step, 22, 2, 1, o.bootHi);
    px(c, 14 - step, 22, 2, 1, o.bootHi);

    // 外袍下摆
    box(c, 6, 14, 12, 5, o.robe);
    px(c, 7, 14, 4, 1, o.robeHi);
    px(c, 15, 15, 2, 3, o.robeDark);
    px(c, 8, 18, 2, 1, o.robeDark);
    px(c, 14, 18, 2, 1, o.robeDark);

    // 躯干、交领和腰带
    box(c, 7, 10, 10, 5, o.robe);
    px(c, 8, 10, 5, 1, o.robeHi);
    px(c, 15, 11, 1, 3, o.robeDark);
    px(c, 7, 15, 10, 1, o.belt || o.robeDark);
    dot(c, 11, 15, o.accent);
    dot(c, 12, 15, o.accent);
    px(c, 10, 10, 2, 4, o.trim);
    px(c, 13, 10, 1, 3, o.trim);
    px(c, 11, 13, 1, 5, o.robeDark);

    // 双臂和手
    box(c, 4, 11, 4, 6, o.sleeve || o.robe);
    box(c, 16, 11, 4, 6, o.sleeve || o.robe);
    px(c, 4, 12, 3, 1, o.robeHi);
    px(c, 17, 12, 2, 1, o.robeDark);
    px(c, 4, 17, 4, 2, o.skin);
    px(c, 16, 17, 4, 2, o.skin);
    px(c, 4, 18, 3, 1, o.skinDark);
    px(c, 17, 18, 3, 1, o.skinDark);

    // 脖颈、脸、耳
    px(c, 10, 9, 4, 2, o.skinDark);
    box(c, 8, 3, 8, 8, o.skin);
    px(c, 9, 9, 6, 1, o.skinDark);
    px(c, 7, 6, 1, 2, o.skinDark);
    px(c, 16, 6, 1, 2, o.skinDark);

    // 头发、眉眼、鼻嘴：刘海压住额头，眼睛收窄，避免“方块脸”。
    px(c, 7, 2, 10, 2, o.hair);
    px(c, 7, 4, 2, 4, o.hair);
    px(c, 15, 4, 2, 4, o.hair);
    px(c, 9, 2, 4, 1, o.hairHi);
    px(c, 9, 4, 3, 1, o.hair);
    px(c, 13, 4, 2, 1, o.hair);
    px(c, 8, 4, 1, 3, o.hair);
    px(c, 10, 4, 1, 1, o.hairHi);
    px(c, 9, 5, 2, 1, o.hair);
    px(c, 13, 5, 2, 1, o.hair);
    px(c, 10, 6, 1, 2, o.eye || OUT);
    px(c, 14, 6, 1, 2, o.eye || OUT);
    px(c, 10, 6, 1, 1, o.eyeGlow || '#fff');
    px(c, 14, 6, 1, 1, o.eyeGlow || '#fff');
    px(c, 11, 7, 1, 1, o.skinDark);
    px(c, 11, 8, 2, 1, o.skinDark);
    dot(c, 12, 8, '#7a4f47');
  }

  const BUILDERS = {
    qiyun(c, frame) {
      base(c, {
        robe: '#28465f', robeHi: '#3d6a88', robeDark: '#152a3b', sleeve: '#1e374b',
        trim: '#9fe0ff', belt: '#0c1b27', boot: '#12212d', bootHi: '#5e8ca8',
        skin: '#f2d6b2', skinDark: '#bd9070', hair: '#223243', hairHi: '#4b6a83',
        accent: '#e8c170', eye: '#12202c', eyeGlow: '#bff4ff', cloak: '#10202e'
      }, frame);
      // 棋盘冠
      px(c, 8, 0, 8, 1, '#0b1721');
      px(c, 7, 1, 10, 2, '#0b1721');
      px(c, 8, 1, 8, 1, '#e8c170');
      px(c, 9, 0, 6, 1, '#1b3042');
      dot(c, 11, 0, '#9fe0ff');
      dot(c, 13, 0, '#9fe0ff');
      px(c, 6, 2, 2, 2, '#e8c170');
      px(c, 16, 2, 2, 2, '#e8c170');
      dot(c, 6, 4, '#9fe0ff');
      dot(c, 17, 4, '#9fe0ff');
      px(c, 7, 3, 1, 4, '#9fe0ff');
      px(c, 16, 3, 1, 4, '#9fe0ff');
      // 胸前棋谱与悬浮棋子
      px(c, 9, 11, 5, 3, '#0c1b27');
      px(c, 10, 11, 3, 1, '#9fe0ff');
      px(c, 10, 13, 1, 1, '#e8c170');
      box(c, 20, 7, 2, 2, '#e8c170', '#2b2413');
      dot(c, 20, 7, '#fff1bd');
      // 腰侧卷轴
      px(c, 3, 15, 2, 4, '#d8cbb0');
      px(c, 3, 16, 2, 1, '#9fe0ff');
    },

    xiaoying(c, frame) {
      base(c, {
        robe: '#392647', robeHi: '#573b69', robeDark: '#1d1127', sleeve: '#2c1b3a',
        trim: '#e05a78', belt: '#120a18', boot: '#191020', bootHi: '#744397',
        skin: '#eac7a8', skinDark: '#a97563', hair: '#1d1424', hairHi: '#4c3260',
        accent: '#ff7f9f', eye: '#100b16', eyeGlow: '#ff8fb3', cloak: '#150c1e'
      }, frame);
      // 尖兜帽
      px(c, 6, 0, 12, 2, '#1d1127');
      px(c, 5, 2, 14, 2, '#1d1127');
      px(c, 4, 4, 2, 5, '#2c1b3a');
      px(c, 18, 4, 2, 5, '#2c1b3a');
      px(c, 7, 3, 9, 1, '#573b69');
      // 眼罩 + 异色瞳
      px(c, 8, 5, 8, 2, '#2b1835');
      px(c, 9, 5, 2, 1, '#6ef0ff');
      px(c, 13, 5, 2, 1, '#ff8fb3');
      // 红围巾与飘带
      px(c, 8, 9, 8, 2, '#c23b58');
      px(c, 14, 10, 6, 2, '#e05a78');
      px(c, 18, 11, 3, 1, '#a32d47');
      // 双刃
      px(c, 2, 9, 1, 8, '#b8c6d8');
      px(c, 3, 8, 1, 2, '#eff8ff');
      px(c, 21, 9, 1, 8, '#b8c6d8');
      px(c, 20, 8, 1, 2, '#eff8ff');
      // 红结与短刀
      px(c, 12, 15, 3, 2, '#c23b58');
      px(c, 6, 17, 1, 3, '#6b3a4d');
    },

    xinyue(c, frame) {
      base(c, {
        robe: '#ede2d2', robeHi: '#fffaf0', robeDark: '#c3b39c', sleeve: '#f7efe2',
        trim: '#f0a7bd', belt: '#d88ca4', boot: '#8a6f72', bootHi: '#f4dbe0',
        skin: '#f6ddc2', skinDark: '#c79582', hair: '#d8c9da', hairHi: '#f6edf8',
        accent: '#ffd7e3', eye: '#3a2730', eyeGlow: '#ffd7e3', cloak: '#f4e8e6'
      }, frame);
      // 长发与侧发
      px(c, 5, 3, 2, 11, '#e3d4e2');
      px(c, 17, 3, 2, 11, '#e3d4e2');
      px(c, 4, 5, 1, 7, '#bba9c0');
      px(c, 19, 5, 1, 7, '#bba9c0');
      px(c, 8, 1, 8, 2, '#e3d4e2');
      px(c, 9, 0, 5, 1, '#f6edf8');
      // 心形发饰 / 光环
      dot(c, 7, 1, '#f7df9c');
      dot(c, 8, 0, '#f7df9c');
      dot(c, 9, 1, '#f7df9c');
      dot(c, 8, 2, '#ffb7ce');
      dot(c, 15, 1, '#f7df9c');
      dot(c, 16, 0, '#f7df9c');
      dot(c, 17, 1, '#f7df9c');
      // 心形胸针
      px(c, 10, 11, 1, 1, '#ff7f9f');
      px(c, 12, 11, 1, 1, '#ff7f9f');
      px(c, 9, 12, 5, 1, '#f0a7bd');
      px(c, 10, 13, 3, 1, '#f0a7bd');
      dot(c, 11, 13, '#fff6d8');
      // 长柄心铃
      px(c, 20, 6, 1, 12, '#b58b64');
      px(c, 19, 5, 3, 2, '#ffd7e3');
      dot(c, 20, 4, '#fff6d8');
    },

    ziyu(c, frame) {
      base(c, {
        robe: '#281d23', robeHi: '#3f2e36', robeDark: '#130d11', sleeve: '#22171c',
        trim: '#c9464f', belt: '#0d080b', boot: '#130d10', bootHi: '#754848',
        skin: '#efd3b7', skinDark: '#a97663', hair: '#171017', hairHi: '#3b2b34',
        accent: '#e8c170', eye: '#140d12', eyeGlow: '#ff9b8f', cloak: '#1a1116'
      }, frame);
      // 官帽双翅
      px(c, 7, 0, 10, 2, '#0d080b');
      px(c, 8, 1, 8, 1, '#c9464f');
      px(c, 2, 2, 5, 1, '#0d080b');
      px(c, 17, 2, 5, 1, '#0d080b');
      dot(c, 3, 2, '#c9464f');
      dot(c, 20, 2, '#c9464f');
      // 胸前狱印
      px(c, 9, 10, 6, 5, '#e0d4ba');
      px(c, 10, 11, 4, 1, '#c9464f');
      px(c, 11, 12, 1, 2, '#281d23');
      px(c, 13, 12, 1, 2, '#281d23');
      px(c, 10, 13, 4, 1, '#c9464f');
      // 毛笔与朱砂
      px(c, 21, 6, 1, 9, '#7a4d30');
      px(c, 20, 15, 2, 2, '#d8cfc0');
      dot(c, 21, 17, '#281d23');
      px(c, 2, 15, 2, 2, '#c9464f');
      dot(c, 2, 14, '#ff8b83');
    },

    smartdog(c, frame) {
      base(c, {
        robe: '#3c4e57', robeHi: '#58737b', robeDark: '#243238', sleeve: '#33454c',
        trim: '#e8a34e', belt: '#182228', boot: '#2b2320', bootHi: '#967552',
        skin: '#d7a26e', skinDark: '#9d6b45', hair: '#744c32', hairHi: '#ab7b51',
        accent: '#7fe3d2', eye: '#1a1310', eyeGlow: '#9ff7e7', cloak: '#2a373c'
      }, frame);
      // 兽耳
      box(c, 5, 1, 4, 4, '#6b452f');
      box(c, 15, 1, 4, 4, '#6b452f');
      px(c, 6, 2, 2, 2, '#d9a35c');
      px(c, 16, 2, 2, 2, '#d9a35c');
      // 护目镜
      px(c, 8, 5, 8, 2, '#1a252b');
      px(c, 8, 5, 3, 2, '#7fe3d2');
      px(c, 13, 5, 3, 2, '#7fe3d2');
      px(c, 11, 5, 2, 1, '#e8a34e');
      // 毛领与红围巾
      px(c, 7, 9, 10, 2, '#b98a5a');
      px(c, 8, 10, 8, 1, '#d54f55');
      px(c, 16, 11, 4, 1, '#b53c44');
      // 尾巴
      px(c, 20, 13, 3, 2, '#8f6544');
      px(c, 22, 11, 1, 3, '#8f6544');
      dot(c, 22, 10, '#e8c79f');
      // 机械背包
      box(c, 2, 10, 4, 6, '#4a5d61');
      px(c, 3, 11, 2, 1, '#7fe3d2');
      px(c, 3, 13, 2, 1, '#e8a34e');
      dot(c, 3, 15, '#7fe3d2');
    },

    mouse(c, frame) {
      base(c, {
        robe: '#6f5138', robeHi: '#916d4c', robeDark: '#463222', sleeve: '#5c432e',
        trim: '#d9a35c', belt: '#2a1e14', boot: '#33251a', bootHi: '#a67c52',
        skin: '#e4c29d', skinDark: '#a67b58', hair: '#4a3425', hairHi: '#75553a',
        accent: '#f2ca82', eye: '#1c130d', eyeGlow: '#ffd89a', cloak: '#4a3524'
      }, frame);
      // 大圆耳
      box(c, 3, 1, 6, 6, '#8d6a49');
      box(c, 15, 1, 6, 6, '#8d6a49');
      px(c, 4, 2, 4, 3, '#d9a35c');
      px(c, 16, 2, 4, 3, '#d9a35c');
      dot(c, 5, 3, '#f2ca82');
      dot(c, 17, 3, '#f2ca82');
      // 门牙
      px(c, 10, 8, 4, 1, '#fff4df');
      px(c, 11, 9, 1, 1, '#fff4df');
      px(c, 13, 9, 1, 1, '#fff4df');
      // 拾荒围裙与爪套
      px(c, 8, 12, 8, 5, '#4a3524');
      px(c, 9, 13, 2, 3, '#d9a35c');
      px(c, 14, 13, 1, 3, '#d9a35c');
      box(c, 18, 15, 4, 3, '#c9a45c');
      px(c, 19, 15, 1, 3, '#f2ca82');
      px(c, 21, 15, 1, 3, '#f2ca82');
      // 尾巴
      px(c, 2, 18, 4, 1, '#8d6a49');
      px(c, 1, 16, 1, 3, '#8d6a49');
    },

    autumn(c, frame) {
      base(c, {
        robe: '#35606e', robeHi: '#4f8291', robeDark: '#203e48', sleeve: '#2e5360',
        trim: '#9fe0ff', belt: '#172c33', boot: '#1f3138', bootHi: '#6f9aa3',
        skin: '#f2d6b2', skinDark: '#bd9070', hair: '#223c49', hairHi: '#456b7d',
        accent: '#b7d9ff', eye: '#142329', eyeGlow: '#b7d9ff', cloak: '#284a56'
      }, frame);
      // 伞形发冠
      px(c, 4, 0, 16, 2, '#9fe0ff');
      px(c, 2, 2, 20, 1, '#5f9db3');
      px(c, 5, 2, 14, 1, '#b7d9ff');
      px(c, 11, 2, 2, 6, '#6b4f36');
      dot(c, 3, 3, '#8fd6ff');
      dot(c, 20, 3, '#8fd6ff');
      // 雨披与领口
      px(c, 6, 10, 3, 6, '#4f8291');
      px(c, 15, 10, 3, 6, '#4f8291');
      px(c, 9, 10, 6, 1, '#b7d9ff');
      // 雨滴
      px(c, 2, 9, 1, 3, '#8fd6ff');
      px(c, 21, 11, 1, 2, '#b7d9ff');
      dot(c, 19, 15, '#8fd6ff');
      px(c, 6, 17, 2, 1, '#8fd6ff');
      // 折伞
      px(c, 21, 6, 1, 11, '#6b4f36');
      px(c, 20, 5, 3, 1, '#9fe0ff');
    },

    sanrui(c, frame) {
      base(c, {
        robe: '#5c2d36', robeHi: '#7d404c', robeDark: '#371a22', sleeve: '#4a242d',
        trim: '#e8c170', belt: '#271014', boot: '#2c151a', bootHi: '#95604e',
        skin: '#f2cda9', skinDark: '#b98a65', hair: '#29181b', hairHi: '#513036',
        accent: '#ffe1a6', eye: '#1a0f11', eyeGlow: '#ffd36b', cloak: '#3f1e27'
      }, frame);
      // 三枚悬浮瑞印
      box(c, 1, 7, 4, 4, '#ffd36b', '#3a2a10');
      box(c, 19, 7, 4, 4, '#8ef0c8', '#0f2e25');
      box(c, 10, 0, 4, 4, '#ff9bb0', '#34121c');
      px(c, 2, 8, 2, 1, '#5c2d36');
      px(c, 20, 8, 2, 1, '#1f5a45');
      px(c, 11, 1, 2, 1, '#5c2d36');
      // 三色腰带
      px(c, 7, 15, 10, 1, '#e8c170');
      px(c, 8, 16, 8, 1, '#8ef0c8');
      px(c, 9, 17, 6, 1, '#ff9bb0');
      // 瑞兽面纹
      px(c, 9, 11, 6, 4, '#e8c170');
      dot(c, 10, 12, '#5c2d36');
      dot(c, 13, 12, '#5c2d36');
      px(c, 11, 14, 2, 1, '#5c2d36');
      // 三支发簪
      px(c, 7, 2, 1, 3, '#ffd36b');
      px(c, 11, 1, 1, 3, '#8ef0c8');
      px(c, 15, 2, 1, 3, '#ff9bb0');
    }
  };

  function sprite(id, frame, tint) {
    const key = id + '|' + (frame ? 1 : 0) + '|' + (tint || '');
    const hit = cache.get(key);
    if (hit) return hit;
    const cv = makeCanvas(24, 24);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const builder = BUILDERS[id];
    if (builder) builder(c, frame ? 1 : 0);
    else {
      box(c, 5, 5, 12, 12, '#ff00ff');
      px(c, 8, 8, 6, 1, '#fff');
      px(c, 8, 12, 6, 1, '#fff');
    }
    if (tint) {
      const t = makeCanvas(24, 24);
      const tc = t.getContext('2d');
      tc.drawImage(cv, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = tint;
      tc.fillRect(0, 0, 24, 24);
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
    const w = 24 * scale;
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
    const w = 24 * scale;
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
