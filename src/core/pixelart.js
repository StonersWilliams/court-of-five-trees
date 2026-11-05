/**
 * src/core/pixelart.js
 * ------------------------------------------------------------
 * 程序化像素美术。
 *
 * 这里实现了一个迷你版 "pixel studio"：
 *   - 统一调色板；
 *   - 16x16 角色/敌人模板，24x24 Boss 模板；
 *   - 2 帧行走/呼吸动画；
 *   - 自动缓存 + 染色覆层（残影、受击闪白）；
 *   - 程序化房间地砖、墙面、火把、门、拾取物。
 *
 * 所有图形都由 Canvas 2D 的矩形/像素绘制实时生成，仓库中没有任何图片资源。
 * 要新增角色：在 CHARACTER_BUILDERS 里增加一个 16x16 画师函数即可。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  // 舞台与战斗区域（供所有模块共享）
  Ink.ARENA = { x: 48, y: 94, w: 864, h: 480 };
  Ink.DOOR_POINTS = {
    left:   { x: 48,  y: 334, horizontal: false },
    right:  { x: 912, y: 334, horizontal: false },
    top:    { x: 480, y: 94,  horizontal: true },
    bottom: { x: 480, y: 574, horizontal: true }
  };

  const OUT = '#08070d';
  const spriteCache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  /** 带 1px 深色描边的矩形，是整套像素画的基本笔触。 */
  function box(c, x, y, w, h, fill, outline = OUT) {
    px(c, x - 1, y - 1, w + 2, h + 2, outline);
    px(c, x, y, w, h, fill);
  }

  function dot(c, x, y, color) { px(c, x, y, 1, 1, color); }

  function createSprite(size, painter) {
    const cv = makeCanvas(size, size);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    painter(c, size);
    return cv;
  }

  // ═══════════════════════════════════════════════════════════
  //  角色 · 16x16
  // ═══════════════════════════════════════════════════════════

  /** 所有角色共用的骨架：靴、袍、手臂、头、眼睛。 */
  function humanoidBase(c, o, frame) {
    const step = frame ? 1 : 0;
    // 脚
    box(c, 4 + step, 12, 3, 3, o.boot);
    box(c, 9 - step, 12, 3, 3, o.boot);
    dot(c, 4 + step, 14, o.bootHi);
    dot(c, 11 - step, 14, o.bootHi);

    // 袍身
    box(c, 4, 8, 8, 6, o.robe);
    px(c, 5, 8, 6, 1, o.robeHi);
    px(c, 5, 12, 6, 1, o.trim);
    px(c, 6, 13, 4, 1, o.robeDark);
    // 衣襟
    px(c, 8, 9, 1, 4, o.trim);
    // 腰带
    px(c, 4, 11, 8, 1, o.belt || o.robeDark);
    dot(c, 7, 11, o.accent);
    dot(c, 8, 11, o.accent);

    // 手臂
    box(c, 2, 9, 2, 5, o.sleeve || o.robe);
    box(c, 12, 9, 2, 5, o.sleeve || o.robe);
    px(c, 2, 13, 2, 1, o.skin);
    px(c, 12, 13, 2, 1, o.skin);

    // 头
    box(c, 5, 3, 6, 6, o.skin);
    // 下巴阴影
    px(c, 6, 8, 4, 1, o.skinDark);

    // 头发/兜帽
    px(c, 4, 2, 8, 2, o.hair);
    px(c, 4, 4, 1, 3, o.hair);
    px(c, 11, 4, 1, 2, o.hair);
    px(c, 6, 2, 4, 1, o.hairHi);

    // 眼睛
    px(c, 6, 6, 1, 2, o.eye || OUT);
    px(c, 9, 6, 1, 2, o.eye || OUT);
    dot(c, 6, 6, o.eyeGlow || o.eye || '#fff');
    dot(c, 9, 6, o.eyeGlow || o.eye || '#fff');
    // 嘴
    dot(c, 8, 8, o.skinDark);
  }

  const CHARACTER_BUILDERS = {
    qiyun(c, frame) {
      humanoidBase(c, {
        robe: '#29455f', robeHi: '#365e7d', robeDark: '#1a2d3f', sleeve: '#223b53',
        trim: '#7fc3e6', belt: '#11212f', boot: '#16232f', bootHi: '#4d748c',
        skin: '#f0d3ad', skinDark: '#bd8f70', hair: '#253344', hairHi: '#3d5268',
        accent: '#9fe0ff', eye: '#16202c', eyeGlow: '#a9ecff'
      }, frame);
      // 棋盘冠
      box(c, 5, 0, 6, 3, '#20354a');
      px(c, 3, 2, 10, 1, '#0e1a25');
      px(c, 4, 1, 2, 1, '#e8c170');
      px(c, 9, 1, 2, 1, '#e8c170');
      dot(c, 8, 0, '#9fe0ff');
      // 胸前棋子纹
      px(c, 7, 9, 2, 2, '#0d1822');
      dot(c, 7, 9, '#b9e9ff');
      // 漂浮棋子
      box(c, 13, 5, 2, 2, '#e8c170', '#2b2413');
      dot(c, 13, 5, '#fff1bd');
      // 衣摆暗纹
      dot(c, 5, 13, '#5f97b8');
      dot(c, 10, 13, '#5f97b8');
    },

    xiaoying(c, frame) {
      humanoidBase(c, {
        robe: '#3b274d', robeHi: '#52346a', robeDark: '#241731', sleeve: '#332044',
        trim: '#c078e8', belt: '#170e20', boot: '#1c1226', bootHi: '#6e3f8e',
        skin: '#e8c7a8', skinDark: '#a97563', hair: '#211729', hairHi: '#34243e',
        accent: '#ff7f9f', eye: '#160f1e', eyeGlow: '#ffb0e0'
      }, frame);
      // 兜帽
      px(c, 4, 1, 8, 2, '#241731');
      px(c, 3, 3, 2, 4, '#241731');
      px(c, 11, 3, 2, 4, '#241731');
      px(c, 5, 2, 6, 1, '#3b274d');
      // 围巾
      px(c, 5, 8, 6, 1, '#c24660');
      px(c, 11, 9, 2, 3, '#a3324d');
      px(c, 12, 11, 2, 2, '#c24660');
      // 双刃
      px(c, 2, 7, 1, 6, '#a7b4c4');
      dot(c, 2, 7, '#eff8ff');
      px(c, 13, 7, 1, 6, '#a7b4c4');
      dot(c, 13, 7, '#eff8ff');
      // 眼罩的冷光
      px(c, 6, 6, 1, 1, '#6ef0ff');
      px(c, 9, 6, 1, 1, '#6ef0ff');
      // 腰间红结
      box(c, 4, 10, 2, 2, '#e05a6f', '#3a1220');
    },

    xinyue(c, frame) {
      humanoidBase(c, {
        robe: '#e8dccb', robeHi: '#fff8e7', robeDark: '#b9a990', sleeve: '#f4ebdb',
        trim: '#f0a7bd', belt: '#d88ca4', boot: '#8a6f72', bootHi: '#f4dbe0',
        skin: '#f4d7ba', skinDark: '#c79582', hair: '#c9b9c8', hairHi: '#f1e6f0',
        accent: '#ffd7e3', eye: '#3a2730', eyeGlow: '#ffd7e3'
      }, frame);
      // 长发
      px(c, 4, 5, 1, 5, '#e3d4e2');
      px(c, 11, 5, 1, 5, '#e3d4e2');
      px(c, 3, 8, 1, 3, '#b9a9bc');
      px(c, 12, 8, 1, 3, '#b9a9bc');
      // 心形发饰 / 光环
      px(c, 7, 0, 2, 1, '#f7df9c');
      px(c, 6, 1, 4, 1, '#f7df9c');
      dot(c, 5, 2, '#ffb7ce');
      dot(c, 10, 2, '#ffb7ce');
      // 心形胸针
      px(c, 7, 9, 1, 1, '#ff7f9f');
      px(c, 8, 9, 1, 1, '#ff7f9f');
      px(c, 6, 10, 4, 1, '#f0a7bd');
      px(c, 7, 11, 2, 1, '#f0a7bd');
      // 手中微光
      dot(c, 13, 8, '#fff6d8');
      dot(c, 14, 9, '#ffb7ce');
    },

    ziyu(c, frame) {
      humanoidBase(c, {
        robe: '#2a2026', robeHi: '#3b2b32', robeDark: '#171015', sleeve: '#241a20',
        trim: '#c9464f', belt: '#120b10', boot: '#161014', bootHi: '#6a3c3c',
        skin: '#ecd0b3', skinDark: '#a97663', hair: '#191219', hairHi: '#31222a',
        accent: '#e8c170', eye: '#1a1116', eyeGlow: '#ff8b83'
      }, frame);
      // 官帽双翅
      box(c, 5, 1, 6, 3, '#171015');
      px(c, 2, 2, 3, 1, '#171015');
      px(c, 11, 2, 3, 1, '#171015');
      px(c, 3, 1, 1, 1, '#c9464f');
      px(c, 12, 1, 1, 1, '#c9464f');
      // 胸前墨印
      px(c, 7, 9, 2, 3, '#e0d4ba');
      dot(c, 7, 10, '#c9464f');
      dot(c, 8, 11, '#c9464f');
      // 毛笔
      px(c, 13, 8, 1, 5, '#8a5a3a');
      px(c, 13, 13, 1, 2, '#d8cfc0');
      dot(c, 13, 15, '#2a2026');
      dot(c, 12, 9, '#d8cfc0');
      // 眼下的笔锋
      dot(c, 11, 8, '#c9464f');
    },

    smartdog(c, frame) {
      humanoidBase(c, {
        robe: '#3d4f57', robeHi: '#536b72', robeDark: '#26343b', sleeve: '#33454c',
        trim: '#e8a34e', belt: '#1b252b', boot: '#2b2320', bootHi: '#8f7054',
        skin: '#d7a26e', skinDark: '#9d6b45', hair: '#7a5136', hairHi: '#a97a50',
        accent: '#7fe3d2', eye: '#201813', eyeGlow: '#9ff7e7'
      }, frame);
      // 垂耳
      box(c, 3, 3, 2, 5, '#6b452f');
      box(c, 11, 3, 2, 5, '#6b452f');
      px(c, 2, 6, 2, 2, '#553622');
      px(c, 12, 6, 2, 2, '#553622');
      // 护目镜
      px(c, 5, 4, 2, 1, '#e8a34e');
      px(c, 9, 4, 2, 1, '#e8a34e');
      px(c, 7, 4, 2, 1, '#b7752d');
      // 口鼻
      px(c, 6, 7, 4, 2, '#e8c79f');
      px(c, 7, 7, 2, 1, '#3a261c');
      dot(c, 8, 8, '#22150f');
      // 尾巴
      px(c, 13, 10, 2, 1, '#8f6544');
      px(c, 14, 9, 1, 2, '#8f6544');
      dot(c, 14, 8, '#e8c79f');
      // 齿轮背包
      box(c, 12, 8, 2, 3, '#5c6e72', '#1b252b');
      dot(c, 13, 9, '#7fe3d2');
      // 围巾
      px(c, 5, 8, 6, 1, '#d54f55');
      px(c, 10, 9, 2, 2, '#b53c44');
    }
  };

  /** 影犬 · 四足形态 */
  function buildShadowDog(frame) {
    return createSprite(16, (c) => {
      const bob = frame ? 0 : 1;
      // 尾巴
      px(c, 1, 8 - bob, 3, 1, '#241d33');
      px(c, 0, 6 - bob, 2, 2, '#241d33');
      dot(c, 0, 5 - bob, '#8f7aff');
      // 四腿
      px(c, 3, 12, 2, 2, OUT);
      px(c, 6, 12 + bob, 2, 2, OUT);
      px(c, 10, 12, 2, 2, OUT);
      px(c, 12, 11 + bob, 2, 3, OUT);
      // 身体
      box(c, 2, 7 - bob, 11, 5, '#2c2440');
      px(c, 3, 7 - bob, 8, 1, '#453665');
      // 头
      box(c, 9, 4 - bob, 5, 5, '#352b4d');
      // 耳朵
      px(c, 9, 2 - bob, 1, 2, '#241d33');
      px(c, 12, 2 - bob, 1, 2, '#241d33');
      // 眼与口
      px(c, 11, 6 - bob, 1, 1, '#b9a7ff');
      px(c, 13, 6 - bob, 1, 1, '#b9a7ff');
      px(c, 9, 8 - bob, 2, 1, '#6f5c9b');
      // 肩部甲片
      dot(c, 4, 8 - bob, '#e8c170');
      dot(c, 7, 10 - bob, '#8f7aff');
      // 黑雾足印（静态帧不同）
      if (frame) {
        dot(c, 1, 14, '#5c4a86');
        dot(c, 14, 14, '#5c4a86');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  普通敌人 · 16x16
  // ═══════════════════════════════════════════════════════════

  const ENEMY_BUILDERS = {
    slime(c, frame) {
      const squish = frame ? 1 : 0;
      // 苔团
      px(c, 3, 8 + squish, 10, 6 - squish, OUT);
      px(c, 2, 10 + squish, 12, 4 - squish, OUT);
      px(c, 4, 7 + squish, 8, 7 - squish, '#2f6b55');
      px(c, 3, 9 + squish, 10, 4 - squish, '#3e876a');
      px(c, 5, 8 + squish, 5, 2, '#5cb48b');
      px(c, 4, 12 + squish, 8, 1, '#1f4a3a');
      // 眼睛
      px(c, 5, 10 + squish, 2, 2, '#0b1712');
      px(c, 9, 10 + squish, 2, 2, '#0b1712');
      dot(c, 5, 10 + squish, '#c8ffe7');
      dot(c, 9, 10 + squish, '#c8ffe7');
      // 嘴里的小牙
      px(c, 7, 12 + squish, 2, 1, '#d7f5d0');
      dot(c, 4, 8 + squish, '#87d3a8');
      // 滴落的墨
      dot(c, 3, 14, '#3e876a');
      dot(c, 12, 14 - squish, '#2f6b55');
    },

    skull(c, frame) {
      const bob = frame ? 0 : 1;
      // 鬼火
      px(c, 6, 13 - bob, 2, 2, '#4fb7d6');
      px(c, 9, 14 - bob, 1, 2, '#2f86b0');
      // 头骨
      box(c, 4, 3 - bob, 8, 7, '#e4ddc4', '#2c2a24');
      px(c, 4, 8 - bob, 8, 1, '#bcb296');
      // 眼窝
      px(c, 5, 5 - bob, 2, 3, '#11151d');
      px(c, 9, 5 - bob, 2, 3, '#11151d');
      dot(c, 5, 6 - bob, '#65d7ff');
      dot(c, 9, 6 - bob, '#65d7ff');
      // 鼻骨
      px(c, 7, 8 - bob, 2, 1, '#7f7761');
      // 牙
      px(c, 5, 9 - bob, 1, 1, '#f4edda');
      px(c, 7, 9 - bob, 1, 1, '#f4edda');
      px(c, 9, 9 - bob, 1, 1, '#f4edda');
      // 裂纹
      dot(c, 10, 4 - bob, '#a79c7f');
      dot(c, 6, 7 - bob, '#a79c7f');
      // 角
      px(c, 3, 2 - bob, 1, 2, '#93866a');
      px(c, 12, 2 - bob, 1, 2, '#93866a');
    },

    gargoyle(c, frame) {
      const bob = frame ? 0 : 1;
      // 翅膀
      px(c, 0, 4 - bob, 4, 2, '#353742');
      px(c, 1, 6 - bob, 2, 4, '#353742');
      px(c, 12, 4 - bob, 4, 2, '#353742');
      px(c, 13, 6 - bob, 2, 4, '#353742');
      dot(c, 2, 5 - bob, '#5f6570');
      dot(c, 13, 5 - bob, '#5f6570');
      // 腿
      box(c, 4, 11, 3, 4, '#4a4c55');
      box(c, 9, 11, 3, 4, '#4a4c55');
      // 身体
      box(c, 4, 6 - bob, 8, 7, '#5a5b63', '#1b1c22');
      px(c, 5, 6 - bob, 6, 1, '#777983');
      px(c, 5, 11, 6, 1, '#34353c');
      // 头
      box(c, 5, 2 - bob, 6, 5, '#64656e', '#1b1c22');
      // 角
      px(c, 4, 0 - bob, 2, 2, '#8a7a61');
      px(c, 10, 0 - bob, 2, 2, '#8a7a61');
      // 眼
      px(c, 6, 4 - bob, 1, 1, '#ff8a5c');
      px(c, 9, 4 - bob, 1, 1, '#ff8a5c');
      // 嘴与爪
      px(c, 7, 6 - bob, 2, 1, '#222329');
      dot(c, 3, 14, '#777983');
      dot(c, 12, 14, '#777983');
      // 胸口符文
      dot(c, 8, 8, '#ff8a5c');
      dot(c, 7, 9, '#c96545');
      dot(c, 9, 9, '#c96545');
    },

    spider(c, frame) {
      const lift = frame ? 1 : 0;
      // 腿（左右各三条）
      px(c, 1, 5 - lift, 4, 1, '#3d2b4e');
      px(c, 1, 8, 5, 1, '#3d2b4e');
      px(c, 2, 11 - lift, 4, 1, '#3d2b4e');
      px(c, 11, 5 + lift, 4, 1, '#3d2b4e');
      px(c, 10, 8, 5, 1, '#3d2b4e');
      px(c, 10, 11 + lift, 4, 1, '#3d2b4e');
      dot(c, 1, 5 - lift, '#7b5b96');
      dot(c, 14, 5 + lift, '#7b5b96');
      // 腹部
      box(c, 4, 7, 8, 6, '#51336a', '#1c1027');
      px(c, 5, 8, 5, 2, '#744a94');
      px(c, 6, 11, 4, 1, '#2e1b3d');
      // 头
      box(c, 6, 4, 4, 4, '#3b254e');
      // 红眼四只
      dot(c, 6, 5, '#ff5c7a');
      dot(c, 8, 5, '#ff5c7a');
      dot(c, 6, 7, '#ff9bb0');
      dot(c, 8, 7, '#ff9bb0');
      // 背上的白色沙漏纹
      px(c, 7, 8, 2, 1, '#e7d9ef');
      px(c, 7, 9, 2, 1, '#b9a0c9');
      px(c, 7, 10, 2, 1, '#e7d9ef');
    },

    tome(c, frame) {
      const float = frame ? 1 : 0;
      // 书页
      px(c, 3, 4 + float, 10, 9, '#2a1418');
      px(c, 4, 5 + float, 9, 7, '#c9b18f');
      px(c, 5, 6 + float, 3, 5, '#e8d8bb');
      px(c, 9, 6 + float, 3, 5, '#e8d8bb');
      // 书脊
      px(c, 7, 5 + float, 3, 7, '#6f2530');
      px(c, 8, 6 + float, 1, 5, '#a23a42');
      // 封皮边角
      px(c, 3, 5 + float, 1, 7, '#8f2c36');
      px(c, 12, 5 + float, 1, 7, '#8f2c36');
      // 眼睛
      px(c, 6, 7 + float, 2, 2, '#141015');
      px(c, 10, 7 + float, 2, 2, '#141015');
      dot(c, 6, 8 + float, '#ff8b83');
      dot(c, 10, 8 + float, '#ff8b83');
      // 符文
      dot(c, 8, 10 + float, '#e8c170');
      dot(c, 7, 11 + float, '#e8c170');
      // 书页飘角
      px(c, 2, 6 + float, 1, 4, '#e8d8bb');
      px(c, 13, 7 + float, 1, 3, '#e8d8bb');
      // 漂浮墨点
      dot(c, 2, 3 + float, '#c084fc');
      dot(c, 13, 3 + float, '#c084fc');
    },

    guard(c, frame) {
      const step = frame ? 1 : 0;
      // 长矛
      px(c, 13, 1, 1, 13, '#7c5a37');
      px(c, 12, 0, 3, 2, '#c7cbd1', '#33343a');
      px(c, 13, 0, 1, 1, '#f2f5f7');
      dot(c, 12, 12, '#c16a4a');
      // 腿
      box(c, 4, 12, 2, 3, '#3e3b3a', '#181615');
      box(c, 8 + step, 12, 2, 3, '#3e3b3a', '#181615');
      // 躯干甲
      box(c, 4, 6, 7, 7, '#6f6758', '#231f1a');
      px(c, 5, 7, 5, 2, '#8f8471');
      px(c, 5, 10, 5, 2, '#4b463c');
      // 甲片
      px(c, 6, 9, 3, 1, '#c16a4a');
      // 头 / 头盔
      box(c, 5, 2, 6, 5, '#716753', '#231f1a');
      px(c, 4, 2, 8, 1, '#c7b98f');
      px(c, 6, 1, 4, 1, '#c16a4a');
      // 面甲眼缝
      px(c, 6, 4, 4, 1, '#171310');
      dot(c, 6, 4, '#ffb35c');
      dot(c, 9, 4, '#ffb35c');
      // 手臂
      px(c, 3, 7, 2, 5, '#5c5548');
      px(c, 11, 7, 2, 4, '#5c5548');
      // 肩甲
      px(c, 3, 6, 2, 2, '#a89a78');
      px(c, 11, 6, 2, 2, '#a89a78');
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  Boss · 24x24
  // ═══════════════════════════════════════════════════════════

  const BOSS_BUILDERS = {
    qilin(c, frame) {
      const b = frame ? 1 : 0;
      // 墨云
      px(c, 2, 20, 20, 3, '#101625');
      px(c, 4, 19, 16, 1, '#1c3854');
      // 四足
      px(c, 5, 18 - b, 3, 4, '#1b2d39');
      px(c, 10, 19, 3, 3, '#1b2d39');
      px(c, 15, 17 + b, 3, 5, '#1b2d39');
      // 尾
      px(c, 1, 12, 4, 2, '#2d6377');
      px(c, 0, 9, 2, 4, '#4f9aa8');
      dot(c, 0, 8, '#8ce8dc');
      // 身体
      px(c, 4, 10, 15, 8, OUT);
      px(c, 5, 10, 13, 7, '#245164');
      px(c, 6, 10, 11, 2, '#3d8090');
      px(c, 6, 14, 10, 2, '#183b49');
      // 鳞
      for (let x = 7; x < 16; x += 3) dot(c, x, 13, '#69b8ad');
      // 颈与头
      px(c, 15, 6, 5, 7, OUT);
      px(c, 16, 6, 4, 6, '#2d6377');
      px(c, 17, 5, 4, 2, '#3d8090');
      // 角
      px(c, 17, 2, 1, 3, '#e8c170');
      px(c, 20, 3, 1, 2, '#e8c170');
      px(c, 16, 1, 2, 1, '#f7df9c');
      // 眼
      px(c, 19, 7, 1, 1, '#f7ff9e');
      dot(c, 18, 7, '#7fffe0');
      // 鬃毛
      px(c, 14, 5, 1, 4, '#8ce8dc');
      px(c, 13, 7, 1, 3, '#4f9aa8');
      // 云纹
      dot(c, 8, 16, '#8ce8dc');
      dot(c, 9, 15, '#8ce8dc');
    },

    clockwork(c, frame) {
      const b = frame ? 1 : 0;
      // 底座
      px(c, 3, 20, 18, 3, '#1b1712');
      px(c, 5, 19, 14, 1, '#5b4832');
      // 齿轮
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + (frame ? 0.15 : 0);
        px(c, Math.round(12 + Math.cos(a) * 8), Math.round(14 + Math.sin(a) * 8), 2, 2, '#8a6c3f');
      }
      px(c, 8, 10, 8, 9, OUT);
      px(c, 9, 10, 6, 8, '#6b5636');
      px(c, 10, 12, 4, 4, '#9c7b45');
      px(c, 11, 13, 2, 2, '#e8c170');
      // 钟形身体
      px(c, 6, 5, 12, 7, OUT);
      px(c, 7, 5, 10, 6, '#7a6038');
      px(c, 8, 4, 8, 2, '#9c7b45');
      px(c, 9, 3, 6, 1, '#c9a35c');
      // 指针
      px(c, 12, 7, 1, 4, '#1b1712');
      px(c, 13, 8, 3, 1, '#1b1712');
      // 钟扣眼睛
      px(c, 9, 9, 2, 1, '#ffbb55');
      px(c, 14, 9, 2, 1, '#ffbb55');
      // 顶饰
      px(c, 11, 1, 2, 2, '#e8c170');
      dot(c, 12, 0, '#fff0b8');
      // 两侧钟摆
      px(c, 3, 8 + b, 2, 2, '#5b4832');
      px(c, 3, 10 + b, 1, 6, '#8a6c3f');
      px(c, 19, 8 - b, 2, 2, '#5b4832');
      px(c, 20, 10 - b, 1, 6, '#8a6c3f');
      dot(c, 3, 16 + b, '#e8c170');
      dot(c, 20, 16 - b, '#e8c170');
    },

    floral(c, frame) {
      const b = frame ? 1 : 0;
      // 藤蔓底座
      px(c, 2, 18, 20, 4, '#15251c');
      px(c, 4, 17, 3, 3, '#2f5a3b');
      px(c, 17, 17, 3, 3, '#2f5a3b');
      px(c, 1, 20, 4, 1, '#4c8a56');
      px(c, 19, 20, 4, 1, '#4c8a56');
      // 花瓣
      const petals = [
        [12, 1, 5, 5], [5, 3, 5, 5], [14, 5, 6, 5],
        [3, 7, 5, 5], [9, 7, 7, 6], [16, 9, 4, 4]
      ];
      petals.forEach((p, i) => {
        px(c, p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2, '#281120');
        px(c, p[0], p[1], p[2], p[3], i % 2 ? '#b04972' : '#d46a92');
        px(c, p[0] + 1, p[1] + 1, p[2] - 2, 1, '#f0a7bd');
      });
      // 花心 / 脸
      px(c, 8, 7 + b, 8, 8, '#2a1020');
      px(c, 9, 7 + b, 6, 7, '#e8c170');
      px(c, 10, 9 + b, 1, 2, '#2a1020');
      px(c, 13, 9 + b, 1, 2, '#2a1020');
      dot(c, 10, 9 + b, '#fff6c7');
      dot(c, 13, 9 + b, '#fff6c7');
      px(c, 11, 12 + b, 2, 1, '#8c3f50');
      // 花蕊
      px(c, 11, 5 + b, 2, 1, '#fff0b8');
      dot(c, 12, 4 + b, '#fff6d8');
      // 藤刺
      dot(c, 3, 16, '#7fb46a');
      dot(c, 20, 16, '#7fb46a');
      dot(c, 6, 22, '#7fb46a');
    },

    judge(c, frame) {
      const b = frame ? 1 : 0;
      // 袍
      px(c, 3, 19, 18, 4, '#0f0b0e');
      px(c, 4, 11, 16, 9, OUT);
      px(c, 5, 11, 14, 8, '#281a20');
      px(c, 6, 12, 12, 1, '#4a2730');
      px(c, 11, 12, 2, 7, '#8f2c36');
      // 官帽
      px(c, 7, 3, 10, 5, OUT);
      px(c, 8, 3, 8, 4, '#171015');
      px(c, 5, 5, 3, 1, '#171015');
      px(c, 16, 5, 3, 1, '#171015');
      px(c, 7, 2, 10, 1, '#c9464f');
      // 面
      px(c, 8, 8 + b, 8, 4, '#e4cdb2');
      px(c, 9, 9 + b, 6, 2, '#c9464f');
      // 判官面具眼
      px(c, 9, 9 + b, 2, 1, '#101014');
      px(c, 14, 9 + b, 2, 1, '#101014');
      dot(c, 9, 9 + b, '#ff8b83');
      dot(c, 14, 9 + b, '#ff8b83');
      // 惊堂木
      px(c, 18, 12 + b, 5, 2, '#5a3a26');
      px(c, 22, 11 + b, 2, 4, '#8a5a3a');
      // 手臂
      px(c, 4, 12, 2, 6, '#281a20');
      px(c, 18, 13, 2, 4, '#281a20');
      // 胸前“判”
      px(c, 10, 14, 4, 4, '#1a1216');
      dot(c, 11, 15, '#e8c170');
      dot(c, 12, 16, '#e8c170');
      dot(c, 13, 15, '#e8c170');
    },

    wuchang(c, frame) {
      const b = frame ? 1 : 0;
      // 黑雾
      px(c, 1, 19, 22, 3, '#0d0b16');
      px(c, 3, 18, 18, 1, '#2c2444');
      for (let i = 0; i < 6; i++) dot(c, 2 + i * 4, 22 - (i % 2), '#6d5a9e');
      // 双腿
      px(c, 8, 17, 2, 4, '#191322');
      px(c, 14, 17, 2, 4, '#191322');
      // 长袍
      px(c, 5, 9 + b, 14, 9, OUT);
      px(c, 6, 9 + b, 12, 8, '#e7dfd0');
      px(c, 6, 12 + b, 12, 1, '#9b94a8');
      px(c, 12, 9 + b, 2, 8, '#1a1520');
      // 双面头
      px(c, 7, 3 + b, 10, 6, OUT);
      px(c, 8, 3 + b, 8, 5, '#e9e2d3');
      // 左半黑脸
      px(c, 8, 3 + b, 3, 5, '#191322');
      px(c, 9, 5 + b, 1, 1, '#ff6f9c');
      px(c, 13, 5 + b, 1, 1, '#65d7ff');
      // 嘴
      px(c, 11, 7 + b, 2, 1, '#5a2330');
      // 高帽
      px(c, 8, 0, 8, 3, '#101014');
      px(c, 7, 2, 10, 1, '#101014');
      px(c, 9, 0, 2, 3, '#c9464f');
      // 锁链
      for (let i = 0; i < 5; i++) {
        px(c, 3 + i * 2, 11 + (i % 2), 1, 1, '#8f8aa0');
        px(c, 17 - i * 2, 13 + (i % 2), 1, 1, '#8f8aa0');
      }
      // 勾魂牌
      px(c, 18, 7 + b, 4, 5, '#2d231c');
      px(c, 19, 8 + b, 2, 3, '#d7c59f');
      dot(c, 20, 9 + b, '#c9464f');
    },

    // ── 新九庭主 ─────────────────────────────────────────
    truffle(c, frame) {
      const b = frame ? 1 : 0;
      px(c, 3, 21, 18, 2, '#120e0a');
      // 菌柄
      box(c, 8, 12, 8, 8, '#e6d1ad');
      px(c, 9, 14, 2, 4, '#c9ad83');
      px(c, 13, 16, 2, 3, '#b79872');
      // 菌伞
      px(c, 4, 8, 16, 6, OUT);
      px(c, 5, 7, 14, 5, '#b98a5d');
      px(c, 6, 6, 12, 3, '#d2a574');
      px(c, 8, 5, 8, 2, '#e2bd8c');
      // 斑点
      dot(c, 7, 9, '#f3dfba'); dot(c, 11, 7, '#f3dfba');
      dot(c, 15, 9, '#d8bc92'); dot(c, 10, 10, '#f3dfba');
      // 脸
      px(c, 9, 15 + b, 2, 2, '#3a2618');
      px(c, 13, 15 + b, 2, 2, '#3a2618');
      px(c, 11, 18 + b, 2, 1, '#7c4b3b');
      // 孢子
      dot(c, 4, 12, '#d8bc92'); dot(c, 20, 14, '#d8bc92');
      dot(c, 2, 17, '#9f7f5c'); dot(c, 21, 6, '#f3dfba');
    },

    sunstar(c, frame) {
      const b = frame ? 1 : 0;
      // 日轮
      px(c, 7, 1, 10, 10, OUT);
      px(c, 8, 2, 8, 8, '#e8a93c');
      px(c, 9, 3, 6, 6, '#ffd36b');
      px(c, 10, 4, 4, 4, '#fff0b0');
      // 光芒
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const x = 12 + Math.cos(a) * 9;
        const y = 6 + Math.sin(a) * 9;
        px(c, Math.round(x), Math.round(y), 1, 2, i % 2 ? '#ffd36b' : '#ff8a4c');
      }
      // 颈与神袍
      box(c, 10, 11, 4, 3, '#c9a25a');
      box(c, 7, 13, 10, 7, '#7a5b32');
      px(c, 8, 14, 8, 2, '#e8c170');
      px(c, 6, 15, 2, 4, '#5a4227');
      px(c, 16, 15, 2, 4, '#5a4227');
      // 脸
      dot(c, 10, 5, '#3a2618'); dot(c, 14, 5, '#3a2618');
      px(c, 11, 7, 2, 1, '#8a4b2b');
      // 环
      px(c, 4, 18 + b, 16, 1, '#ffd36b');
      dot(c, 3, 18 + b, '#fff0b0'); dot(c, 20, 18 + b, '#fff0b0');
    },

    ninesun(c, frame) {
      const b = frame ? 1 : 0;
      // 九个太阳
      const suns = [[4,3],[12,1],[20,3],[2,10],[12,9],[22,10],[5,19],[12,17],[19,19]];
      for (let i = 0; i < suns.length; i++) {
        const x = suns[i][0], y = suns[i][1] + (i % 2 ? b : 0);
        px(c, x - 1, y - 1, 4, 4, '#6b2d14');
        px(c, x, y, 2, 2, i % 3 === 0 ? '#fff0b0' : '#ff8a4c');
      }
      // 火袍
      box(c, 8, 8, 8, 9, '#6d2a18');
      px(c, 9, 9, 6, 2, '#c24c24');
      px(c, 9, 13, 6, 2, '#ff8a4c');
      px(c, 10, 16, 4, 3, '#3a160d');
      // 头
      box(c, 10, 5, 4, 4, '#e8a93c');
      dot(c, 10, 6, '#3a160d'); dot(c, 13, 6, '#3a160d');
      // 王冠
      px(c, 9, 3, 6, 2, '#ffd36b');
      dot(c, 11, 2, '#fff0b0');
    },

    peach(c, frame) {
      const b = frame ? 1 : 0;
      // 桃树柱
      px(c, 3, 22, 18, 1, '#12070b');
      box(c, 10, 8, 4, 15, '#6b4a3a');
      px(c, 11, 10, 1, 11, '#8a6248');
      // 桃冠
      px(c, 3, 5, 18, 6, OUT);
      px(c, 4, 4, 16, 6, '#e88aa4');
      px(c, 5, 2, 14, 4, '#ffb7c8');
      px(c, 7, 1, 10, 2, '#ffd0dd');
      // 花
      dot(c, 6, 6, '#fff0f4'); dot(c, 11, 4, '#fff0f4');
      dot(c, 16, 6, '#fff0f4'); dot(c, 9, 9, '#fff0f4');
      // 树脸
      px(c, 9, 12 + b, 2, 2, '#3a1f24');
      px(c, 13, 12 + b, 2, 2, '#3a1f24');
      px(c, 11, 15 + b, 2, 1, '#6e2d3e');
      // 藤蔓
      px(c, 7, 15, 1, 5, '#4f7a4a');
      px(c, 16, 16, 1, 4, '#4f7a4a');
      dot(c, 7, 20, '#8ef0c8'); dot(c, 16, 21, '#ffb7c8');
    },

    oga(c, frame) {
      const b = frame ? 1 : 0;
      px(c, 3, 22, 18, 1, '#0b0a14');
      // 长刀
      px(c, 20, 4, 1, 13, '#d7e0ff');
      px(c, 19, 3, 2, 1, '#ffffff');
      px(c, 21, 16, 3, 1, '#5a4a7a');
      // 蓝袍
      box(c, 6, 11, 9, 8, '#2a2a55');
      px(c, 7, 12, 7, 2, '#44448a');
      px(c, 7, 15, 7, 1, '#8f9dff');
      // 腿
      px(c, 7, 19, 3, 3, '#19172c');
      px(c, 12, 19, 3, 3, '#19172c');
      // 头
      box(c, 9, 5, 6, 6, '#d9b38c');
      px(c, 8, 4, 8, 2, '#19172c');
      px(c, 10, 3, 4, 1, '#19172c');
      // 眼
      dot(c, 10, 7, '#ff6f6f'); dot(c, 13, 7, '#ff6f6f');
      // 刀鞘
      px(c, 3, 8, 2, 11, '#3a2a52');
      px(c, 2, 7, 2, 2, '#8f9dff');
      // 杀气
      dot(c, 18, 10 + b, '#b9c4ff'); dot(c, 22, 20, '#b9c4ff');
    },

    june(c, frame) {
      const b = frame ? 1 : 0;
      // 雨云
      px(c, 3, 4, 18, 7, OUT);
      px(c, 4, 5, 16, 6, '#6f7f9f');
      px(c, 5, 3, 8, 4, '#9fb4d6');
      px(c, 12, 2, 6, 5, '#b7d9ff');
      // 雨
      for (let i = 0; i < 6; i++) {
        px(c, 5 + i * 3, 11 + (i % 2) + b, 1, 3, '#9fd7ff');
        dot(c, 5 + i * 3, 15 + (i % 2) + b, '#d7ecff');
      }
      // 云中脸
      dot(c, 9, 6, '#23334d'); dot(c, 14, 6, '#23334d');
      px(c, 11, 8, 2, 1, '#4b6688');
      // 伞
      px(c, 17, 8, 1, 11, '#3a2a52');
      px(c, 13, 7, 9, 2, '#b7d9ff');
      px(c, 14, 6, 7, 1, '#d7ecff');
      // 云尾
      px(c, 2, 17, 7, 2, '#8fa9c9');
      px(c, 4, 19, 5, 1, '#6f7f9f');
    },

    tower(c, frame) {
      const b = frame ? 1 : 0;
      // 塔身
      px(c, 4, 22, 16, 1, '#0b0a08');
      box(c, 6, 8, 12, 14, '#8c7d62');
      px(c, 7, 9, 10, 3, '#b5a685');
      px(c, 8, 14, 8, 1, '#5a5040');
      px(c, 8, 18, 8, 1, '#5a5040');
      // 砖缝
      for (let y = 10; y < 21; y += 4) {
        for (let x = 7; x < 17; x += 4) dot(c, x + (y % 8 ? 2 : 0), y, '#5a5040');
      }
      // 钟面
      px(c, 9, 10, 6, 6, OUT);
      px(c, 10, 11, 4, 4, '#f0e2bd');
      dot(c, 12, 13, '#3a3022');
      px(c, 12, 12, 1, 2, '#3a3022');
      px(c, 12, 13, 2, 1, '#3a3022');
      // 塔顶
      px(c, 4, 5, 16, 4, OUT);
      px(c, 5, 4, 14, 4, '#a89a78');
      px(c, 7, 2, 10, 3, '#c7b98f');
      px(c, 11, 0, 2, 3, '#e8c170');
      // 小窗
      px(c, 9, 17 + b, 2, 3, '#2a241a');
      px(c, 13, 17 + b, 2, 3, '#2a241a');
      // 钟摆
      px(c, 2, 12, 2, 1, '#e8c170');
      dot(c, 1, 13, '#ffd36b');
    },

    bigmon(c, frame) {
      const b = frame ? 1 : 0;
      px(c, 2, 22, 20, 1, '#07110d');
      // 大脚
      px(c, 5, 19, 5, 4, '#2d5c4b');
      px(c, 14, 19, 5, 4, '#2d5c4b');
      // 躯干
      box(c, 5, 8, 14, 12, '#4b8f70');
      px(c, 7, 9, 10, 4, '#6fbf94');
      px(c, 8, 14, 8, 4, '#2d5c4b');
      // 肚皮
      px(c, 9, 12, 6, 5, '#a8d6b8');
      // 手臂
      px(c, 2, 9, 3, 8, '#3a745a');
      px(c, 19, 9, 3, 8, '#3a745a');
      px(c, 1, 16, 4, 3, '#6fbf94');
      px(c, 19, 16, 4, 3, '#6fbf94');
      // 头
      box(c, 7, 2, 10, 7, '#5aa383');
      px(c, 8, 3, 8, 3, '#8ef0c8');
      // 角
      px(c, 6, 0, 3, 3, '#e8c170');
      px(c, 15, 0, 3, 3, '#e8c170');
      // 眼
      px(c, 8, 5 + b, 3, 2, '#101014');
      px(c, 13, 5 + b, 3, 2, '#101014');
      dot(c, 9, 5 + b, '#ffd36b'); dot(c, 14, 5 + b, '#ffd36b');
      // 牙
      px(c, 10, 8, 4, 1, '#101014');
      dot(c, 10, 8, '#fff6e7'); dot(c, 13, 8, '#fff6e7');
      // 肚脐
      dot(c, 12, 14, '#2d5c4b');
    },

    edo(c, frame) {
      const b = frame ? 1 : 0;
      px(c, 3, 22, 18, 1, '#0d0712');
      // 长发
      px(c, 4, 4, 16, 12, '#24142e');
      px(c, 3, 10, 2, 10, '#3a2050');
      px(c, 19, 10, 2, 10, '#3a2050');
      // 和服
      box(c, 6, 11, 12, 8, '#4a2358');
      px(c, 7, 12, 10, 2, '#7a3f8f');
      px(c, 7, 17, 10, 1, '#c084fc');
      // 脸
      box(c, 8, 5, 8, 6, '#e8cfd8');
      px(c, 8, 4, 8, 2, '#24142e');
      // 多张嘴
      for (let i = 0; i < 4; i++) {
        px(c, 8 + i * 2, 9 + (i % 2), 2, 1, '#6e1f3a');
        dot(c, 8 + i * 2, 9 + (i % 2), '#ff6f9c');
      }
      // 眼
      dot(c, 9, 7, '#c084fc'); dot(c, 14, 7, '#c084fc');
      // 扇
      px(c, 18, 12, 4, 1, '#c084fc');
      px(c, 19, 9, 4, 3, '#e0b6ff');
      px(c, 20, 8, 2, 1, '#fff0f4');
      // 十二口
      for (let i = 0; i < 6; i++) {
        dot(c, 5 + i * 3, 15 + (i % 3), '#ff6f9c');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  精灵缓存与绘制
  // ═══════════════════════════════════════════════════════════

  function getSprite(key, frame, tint) {
    const cacheKey = key + '|' + frame + '|' + (tint || '');
    let cv = spriteCache.get(cacheKey);
    if (cv) return cv;

    let base;
    if (key.startsWith('char:')) {
      const id = key.slice(5);
      const builder = CHARACTER_BUILDERS[id];
      base = builder ? createSprite(16, (c) => builder(c, frame)) : null;
    } else if (key.startsWith('enemy:')) {
      const id = key.slice(6);
      const builder = ENEMY_BUILDERS[id];
      base = builder ? createSprite(16, (c) => builder(c, frame)) : null;
    } else if (key.startsWith('boss:')) {
      const id = key.slice(5);
      const builder = BOSS_BUILDERS[id];
      base = builder ? createSprite(24, (c) => builder(c, frame)) : null;
    } else if (key === 'dog') {
      base = buildShadowDog(frame);
    }

    if (!base) {
      // 缺图占位：亮紫方块，便于开发时发现拼写错误。
      base = createSprite(16, (c) => {
        box(c, 3, 3, 10, 10, '#ff00ff', '#000');
        px(c, 5, 5, 6, 1, '#fff');
        px(c, 5, 9, 6, 1, '#fff');
      });
    }

    if (tint) {
      const t = makeCanvas(base.width, base.height);
      const tc = t.getContext('2d');
      tc.imageSmoothingEnabled = false;
      tc.drawImage(base, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = tint;
      tc.fillRect(0, 0, t.width, t.height);
      base = t;
    }

    spriteCache.set(cacheKey, base);
    return base;
  }

  const Art = {
    makeCanvas,

    /** 获取缓存后的精灵，供自定义绘制使用。 */
    sprite(key, frame = 0, tint = null) { return getSprite(key, frame, tint); },

    /**
     * 世界坐标绘制精灵。
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} key  例: 'char:qiyun' / 'enemy:slime' / 'boss:qilin' / 'dog'
     * @param {number} x 中心 x
     * @param {number} y 中心 y
     * @param {number} scale 逻辑像素放大倍率
     * @param {object} [opt] {frame, flip, alpha, tint, rotation, bob, time, glow}
     */
    drawSprite(ctx, key, x, y, scale, opt = {}) {
      const frame = opt.frame || 0;
      const tint = opt.tint || null;
      const cv = getSprite(key, frame, tint);
      const size = cv.width;
      const w = size * scale;
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
    },

    /** 角色半身像，用于选人卡片。 */
    drawPortrait(ctx, charId, cx, cy, scale, frame = 0) {
      const cv = getSprite('char:' + charId, frame, null);
      const w = 16 * scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // 光背
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.62);
      grad.addColorStop(0, 'rgba(232,193,112,.18)');
      grad.addColorStop(1, 'rgba(232,193,112,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - w, cy - w, w * 2, w * 2);
      ctx.drawImage(cv, 0, 0, 16, 16, cx - w / 2, cy - w / 2, w, w);
      ctx.restore();
    },

    characterKey(id) { return 'char:' + id; },
    enemyKey(id) { return 'enemy:' + id; },
    bossKey(id) { return 'boss:' + id; },

    // ═════════════════════════════════════════════════════════
    //  环境
    // ═════════════════════════════════════════════════════════

    THEMES: [
      {
        name: '青苔地宫', sub: 'THE MOSSY CRYPT',
        floor: '#19212e', tile: '#1f2a3a', tileAlt: '#222e3f', grout: '#0c1119',
        wall: '#2a3546', wallHi: '#4b5d75', wallLo: '#151c26',
        accent: '#6ea8d8', glow: '#7fe3d2', rune: '#33526b', fog: '#0a1520'
      },
      {
        name: '霜钟回廊', sub: 'THE FROST CLOCK',
        floor: '#182630', tile: '#1f3240', tileAlt: '#233848', grout: '#0b161e',
        wall: '#2c4353', wallHi: '#5d7f95', wallLo: '#14232d',
        accent: '#88d8f0', glow: '#65d7ff', rune: '#3f6478', fog: '#081822'
      },
      {
        name: '赤花禁苑', sub: 'THE CRIMSON GARDEN',
        floor: '#241a24', tile: '#32202d', tileAlt: '#382333', grout: '#140c14',
        wall: '#41293b', wallHi: '#7a4a64', wallLo: '#1f131d',
        accent: '#e58bb1', glow: '#ff6f9c', rune: '#63364e', fog: '#1a0b14'
      },
      {
        name: '铁律衙门', sub: 'THE IRON COURT',
        floor: '#201c1e', tile: '#2c2629', tileAlt: '#30292c', grout: '#100d0f',
        wall: '#3a3034', wallHi: '#7a6151', wallLo: '#1b1518',
        accent: '#d8a15b', glow: '#ff9a4d', rune: '#5d3f32', fog: '#170f0c'
      },
      {
        name: '无常墨海', sub: 'THE VOID INK SEA',
        floor: '#101326', tile: '#171c33', tileAlt: '#1b213b', grout: '#070912',
        wall: '#232944', wallHi: '#4f5682', wallLo: '#0e1121',
        accent: '#a78bfa', glow: '#c084fc', rune: '#3d3770', fog: '#07040f'
      },
      {
        name: '灰烬书库', sub: 'THE ASHEN ARCHIVE',
        floor: '#1e1a18', tile: '#2a2420', tileAlt: '#2f2824', grout: '#100c0a',
        wall: '#3a302a', wallHi: '#75604c', wallLo: '#18120e',
        accent: '#d7a86e', glow: '#ffb36b', rune: '#5a4230', fog: '#120b08'
      },
      {
        name: '镜面水庭', sub: 'THE MIRROR GARDEN',
        floor: '#151f24', tile: '#1d2b31', tileAlt: '#223238', grout: '#081114',
        wall: '#2a3d44', wallHi: '#6a98a4', wallLo: '#101c21',
        accent: '#8fe3e0', glow: '#8ef0e8', rune: '#355e63', fog: '#071316'
      },
      {
        name: '藤月别院', sub: 'THE VINE MOON',
        floor: '#1b211a', tile: '#253022', tileAlt: '#2a3626', grout: '#0d120b',
        wall: '#344030', wallHi: '#6a8a58', wallLo: '#151d12',
        accent: '#b7d98a', glow: '#d7ff9a', rune: '#4a6238', fog: '#0b1308'
      },
      {
        name: '白夜经阁', sub: 'THE WHITE NIGHT SUTRA',
        floor: '#20242a', tile: '#2a3038', tileAlt: '#303740', grout: '#10141a',
        wall: '#3c4652', wallHi: '#9aa9b8', wallLo: '#1a2028',
        accent: '#cfe0f0', glow: '#f2f7ff', rune: '#5a6878', fog: '#121820'
      }
    ],

    /**
     * 把房间地砖、墙面、装饰预烘焙到离屏 Canvas。
     * 每间房只在进入时绘制一次，之后每帧 drawImage，移动端也能稳定 60fps。
     */
    buildRoomBackground(room, floorIndex) {
      const theme = this.THEMES[floorIndex % this.THEMES.length];
      const A = Ink.ARENA;
      const cv = makeCanvas(960, 600);
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      const rng = U.seeded(room.seed || (room.id * 997 + floorIndex * 131));
      room.torches = [];

      // 舞台底
      const bg = c.createRadialGradient(480, 300, 80, 480, 300, 620);
      bg.addColorStop(0, theme.fog);
      bg.addColorStop(0.55, '#08070e');
      bg.addColorStop(1, '#040308');
      c.fillStyle = bg;
      c.fillRect(0, 0, 960, 600);

      // 地板底色
      c.save();
      c.beginPath();
      c.rect(A.x, A.y, A.w, A.h);
      c.clip();
      c.fillStyle = theme.floor;
      c.fillRect(A.x, A.y, A.w, A.h);

      const TILE = 48;
      for (let y = A.y; y < A.y + A.h; y += TILE) {
        for (let x = A.x; x < A.x + A.w; x += TILE) {
          const odd = ((x / TILE) + (y / TILE)) % 2 === 0;
          c.fillStyle = odd ? theme.tile : theme.tileAlt;
          c.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          c.fillStyle = theme.grout;
          c.fillRect(x, y, TILE, 1);
          c.fillRect(x, y, 1, TILE);
          // 瓷砖高光
          c.fillStyle = 'rgba(255,255,255,.035)';
          c.fillRect(x + 2, y + 2, TILE - 4, 1);
          // 裂纹与砂砾
          if (rng() < 0.22) {
            const cx = x + 6 + Math.floor(rng() * (TILE - 16));
            const cy = y + 8 + Math.floor(rng() * (TILE - 20));
            c.fillStyle = theme.grout;
            c.fillRect(cx, cy, 1, 3 + Math.floor(rng() * 5));
            c.fillRect(cx + 1, cy + 3, 2, 1);
            c.fillStyle = 'rgba(255,255,255,.045)';
            c.fillRect(cx - 1, cy - 1, 1, 2);
          }
          if (rng() < 0.12) {
            c.fillStyle = theme.rune;
            c.globalAlpha = 0.3;
            c.fillRect(x + 10 + rng() * 28, y + 10 + rng() * 28, 2, 2);
            c.globalAlpha = 1;
          }
        }
      }

      // 中央符文 / 房间类型纹章
      this._drawRoomSigil(c, room, theme, rng);

      // 地面装饰：骨片、石子、墨渍
      for (let i = 0; i < 22; i++) {
        const x = A.x + 40 + rng() * (A.w - 80);
        const y = A.y + 40 + rng() * (A.h - 80);
        if (U.dist(x, y, 480, 334) < 110) continue;
        const kind = rng();
        if (kind < 0.42) {
          c.fillStyle = theme.rune;
          c.globalAlpha = 0.35;
          c.beginPath();
          c.ellipse(x, y, 6 + rng() * 14, 3 + rng() * 6, rng() * 3, 0, U.TAU);
          c.fill();
          c.globalAlpha = 1;
          c.strokeStyle = 'rgba(0,0,0,.3)';
          c.lineWidth = 1;
          c.stroke();
        } else if (kind < 0.72) {
          c.fillStyle = theme.wallHi;
          c.globalAlpha = 0.28;
          c.fillRect(x, y, 3 + rng() * 5, 2);
          c.fillRect(x + 2, y - 2, 2, 2);
          c.globalAlpha = 1;
        } else {
          c.fillStyle = '#d8cbb4';
          c.globalAlpha = 0.34;
          c.fillRect(x, y, 4, 1);
          c.fillRect(x + 1, y - 1, 1, 1);
          c.fillRect(x + 4, y - 1, 1, 2);
          c.globalAlpha = 1;
        }
      }

      // 四周墙角阴影
      const vg = c.createRadialGradient(480, 334, 220, 480, 334, 560);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.72, 'rgba(0,0,0,.16)');
      vg.addColorStop(1, 'rgba(0,0,0,.56)');
      c.fillStyle = vg;
      c.fillRect(A.x, A.y, A.w, A.h);

      c.restore();

      // 墙面：四周砖石
      const WALL = 14;
      this._wallBand(c, A.x, A.y, A.w, WALL, theme, rng, 'h');
      this._wallBand(c, A.x, A.y + A.h - WALL, A.w, WALL, theme, rng, 'h');
      this._wallBand(c, A.x, A.y, WALL, A.h, theme, rng, 'v');
      this._wallBand(c, A.x + A.w - WALL, A.y, WALL, A.h, theme, rng, 'v');

      // 边框高光
      c.strokeStyle = theme.wallHi;
      c.globalAlpha = 0.5;
      c.lineWidth = 2;
      c.strokeRect(A.x + 1, A.y + 1, A.w - 2, A.h - 2);
      c.globalAlpha = 1;

      // 火把壁座
      const torchPositions = [
        [A.x + 56, A.y + 54], [A.x + A.w - 56, A.y + 54],
        [A.x + 56, A.y + A.h - 54], [A.x + A.w - 56, A.y + A.h - 54]
      ];
      torchPositions.forEach(([x, y], i) => {
        if (i > 0 && rng() < 0.25) return;
        room.torches.push({ x, y, phase: rng() * 10 });
        c.fillStyle = '#2a2018';
        c.fillRect(x - 4, y + 2, 8, 3);
        c.fillStyle = '#5b4832';
        c.fillRect(x - 2, y - 7, 4, 10);
        c.fillStyle = '#8a6c3f';
        c.fillRect(x - 1, y - 6, 1, 7);
        c.fillStyle = theme.accent;
        c.globalAlpha = 0.4;
        c.fillRect(x - 1, y - 12, 2, 4);
        c.globalAlpha = 1;
      });

      // 门口地面引导
      Object.keys(Ink.DOOR_POINTS).forEach((side) => {
        const d = Ink.DOOR_POINTS[side];
        c.fillStyle = theme.rune;
        c.globalAlpha = 0.2;
        if (d.horizontal) {
          c.fillRect(d.x - 52, side === 'top' ? d.y + 16 : d.y - 32, 104, 16);
        } else {
          c.fillRect(side === 'left' ? d.x + 16 : d.x - 32, d.y - 52, 16, 104);
        }
        c.globalAlpha = 1;
      });

      room._bg = cv;
      room._theme = theme;
      return cv;
    },

    _wallBand(c, x, y, w, h, theme, rng, dir) {
      c.fillStyle = theme.wall;
      c.fillRect(x, y, w, h);
      const step = 36;
      c.fillStyle = theme.wallLo;
      c.fillRect(x, y, w, 2);
      c.fillStyle = theme.wallHi;
      c.fillRect(x, y + h - 2, w, 1);
      for (let i = 0; i < Math.max(w, h); i += step) {
        if (dir === 'h') {
          c.fillStyle = theme.wallLo;
          c.fillRect(x + i, y, 1, h);
          if (rng() < 0.6) {
            c.fillStyle = theme.wallHi;
            c.globalAlpha = 0.35;
            c.fillRect(x + i + 3, y + 4, 12, 1);
            c.globalAlpha = 1;
          }
        } else {
          c.fillStyle = theme.wallLo;
          c.fillRect(x, y + i, w, 1);
          if (rng() < 0.6) {
            c.fillStyle = theme.wallHi;
            c.globalAlpha = 0.35;
            c.fillRect(x + 4, y + i + 3, 1, 12);
            c.globalAlpha = 1;
          }
        }
      }
    },

    _drawRoomSigil(c, room, theme, rng) {
      const cx = 480, cy = 334;
      c.save();
      c.translate(cx, cy);
      c.globalAlpha = 0.32;
      c.strokeStyle = theme.rune;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 108, 0, U.TAU);
      c.stroke();
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, 0, 88, 0, U.TAU);
      c.stroke();

      if (room.type === 'start') {
        // 棋盘纹
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            if ((i + j) % 2 === 0) {
              c.fillStyle = theme.rune;
              c.fillRect(-64 + i * 32, -64 + j * 32, 32, 32);
            }
          }
        }
        c.strokeRect(-64, -64, 128, 128);
      } else if (room.type === 'boss') {
        // 大封印
        c.strokeStyle = theme.accent;
        c.globalAlpha = 0.24;
        c.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          c.beginPath();
          c.moveTo(Math.cos(i * Math.PI / 4) * 30, Math.sin(i * Math.PI / 4) * 30);
          c.lineTo(Math.cos(i * Math.PI / 4) * 118, Math.sin(i * Math.PI / 4) * 118);
          c.stroke();
        }
        c.beginPath();
        c.arc(0, 0, 54, 0, U.TAU);
        c.stroke();
        c.globalAlpha = 0.3;
        c.fillStyle = theme.accent;
        c.font = 'bold 56px "Microsoft YaHei", serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('狱', 0, 4);
      } else if (room.type === 'elite') {
        // 三叉冠
        c.strokeStyle = theme.accent;
        c.globalAlpha = 0.24;
        c.beginPath();
        c.moveTo(-48, 38); c.lineTo(-48, -6); c.lineTo(-20, 18);
        c.lineTo(0, -38); c.lineTo(20, 18); c.lineTo(48, -6); c.lineTo(48, 38);
        c.closePath();
        c.stroke();
        c.fillStyle = theme.rune;
        c.globalAlpha = 0.16;
        c.fill();
      } else {
        // 交战纹
        c.strokeStyle = theme.rune;
        c.globalAlpha = 0.28;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-44, -44); c.lineTo(44, 44);
        c.moveTo(44, -44); c.lineTo(-44, 44);
        c.stroke();
        c.globalAlpha = 0.18;
        c.strokeRect(-66, -66, 132, 132);
      }
      c.restore();
    },

    /** 动态火把火焰 + 光晕 */
    drawTorch(ctx, t, time, theme) {
      const flick = 0.7 + Math.sin(time * 11 + t.phase) * 0.18 + Math.sin(time * 27 + t.phase * 2) * 0.08;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(t.x, t.y - 8, 2, t.x, t.y - 8, 58 * flick);
      g.addColorStop(0, U.rgba(theme.glow, 0.28 * flick));
      g.addColorStop(0.4, U.rgba(theme.accent, 0.1 * flick));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(t.x - 70, t.y - 78, 140, 140);
      ctx.restore();

      // 像素火焰
      const h = 10 + Math.sin(time * 9 + t.phase) * 3;
      ctx.fillStyle = '#ff9a4d';
      ctx.fillRect(t.x - 3, t.y - 8 - h * 0.4, 6, h * 0.6);
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(t.x - 2, t.y - 7 - h * 0.55, 4, h * 0.55);
      ctx.fillStyle = '#fff6cf';
      ctx.fillRect(t.x - 1, t.y - 6 - h * 0.25, 2, 4);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(t.x - 4, t.y - 8, 1, 3);
      ctx.fillRect(t.x + 3, t.y - 9, 1, 4);
    },

    /** 门：关闭时是厚重铁栅，开启时露出幽光。 */
    drawDoor(ctx, side, open, time, theme) {
      const d = Ink.DOOR_POINTS[side];
      const W = d.horizontal ? 76 : 28;
      const H = d.horizontal ? 28 : 76;
      const x = d.x - W / 2;
      const y = d.y - H / 2;
      ctx.save();
      // 门框
      ctx.fillStyle = '#0a080d';
      ctx.fillRect(x - 2, y - 2, W + 4, H + 4);
      ctx.fillStyle = open ? '#0d1520' : theme.wallLo;
      ctx.fillRect(x, y, W, H);

      if (open) {
        // 内部光
        const g = ctx.createLinearGradient(x, y, x + W, y + H);
        g.addColorStop(0, U.rgba(theme.glow, 0.04));
        g.addColorStop(0.5, U.rgba(theme.glow, 0.26 + Math.sin(time * 3 + d.x) * 0.05));
        g.addColorStop(1, U.rgba(theme.glow, 0.04));
        ctx.fillStyle = g;
        ctx.fillRect(x + 3, y + 3, W - 6, H - 6);
        // 像素箭头
        ctx.fillStyle = U.rgba(theme.glow, 0.8);
        const pulse = Math.sin(time * 4) * 2;
        if (side === 'left' || side === 'right') {
          const dir = side === 'left' ? -1 : 1;
          const cx = d.x + dir * (4 + pulse);
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(cx - dir * i * 4, d.y - 4 + i * 4, 3, 1);
            ctx.fillRect(cx - dir * i * 4, d.y + 3 - i * 3, 3, 1);
          }
        } else {
          const dir = side === 'top' ? -1 : 1;
          const cy = d.y + dir * (4 + pulse);
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(d.x - 4 + i * 4, cy - dir * i * 3, 1, 3);
            ctx.fillRect(d.x - 4 + i * 4, cy - dir * i * 3, 1, 3);
          }
        }
      } else {
        // 铁栅
        ctx.fillStyle = '#2c2634';
        if (d.horizontal) {
          for (let i = 8; i < W - 4; i += 12) ctx.fillRect(x + i, y + 3, 4, H - 6);
          ctx.fillStyle = '#4a3e5a';
          ctx.fillRect(x + 4, y + H / 2 - 1, W - 8, 2);
        } else {
          for (let i = 8; i < H - 4; i += 12) ctx.fillRect(x + 3, y + i, W - 6, 4);
          ctx.fillStyle = '#4a3e5a';
          ctx.fillRect(x + W / 2 - 1, y + 4, 2, H - 8);
        }
        // 锁
        ctx.fillStyle = '#e8c170';
        ctx.fillRect(d.horizontal ? d.x - 3 : d.x - 2, d.horizontal ? d.y - 3 : d.y - 3, 6, 6);
        ctx.fillStyle = '#7a5f2e';
        ctx.fillRect(d.horizontal ? d.x - 1 : d.x, d.horizontal ? d.y - 1 : d.y - 1, 2, 3);
      }

      // 门框描边
      ctx.strokeStyle = theme.wallHi;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, W, H);
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    /** 地面持续伤害/治疗区域用同心像素环 */
    drawGroundField(ctx, kind, x, y, radius, time, alpha = 1) {
      const colors = {
        poison: ['#4f8f58', '#7fc46a'],
        fire: ['#c16a4a', '#ff9a4d'],
        void: ['#5d4a8f', '#a78bfa'],
        heart: ['#c24660', '#ff9bb0'],
        slow: ['#3d6e8f', '#7fd8ff'],
        cage: ['#7a2830', '#e8c170'],
        ink: ['#4a2f5c', '#c084fc'],
        ice: ['#3d6e8f', '#b7e8ff'],
        holy: ['#9f7a3a', '#ffe08a'],
        bloom: ['#8f3d5a', '#ffb7c8'],
        shadow: ['#2d264a', '#8f9dff']
      };
      const [c1, c2] = colors[kind] || colors.void;
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      g.addColorStop(0, U.rgba(c2, 0.16));
      g.addColorStop(0.7, U.rgba(c1, 0.12));
      g.addColorStop(1, U.rgba(c1, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = U.rgba(c2, 0.5);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 7]);
      ctx.lineDashOffset = -time * 18;
      ctx.beginPath();
      ctx.arc(x, y, radius - 2, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    },

    /** 经验晶石 / 小拾取物 */
    drawXpGem(ctx, x, y, value, time) {
      const bob = Math.sin(time * 5 + x * 0.1) * 2;
      const s = value >= 10 ? 5 : value >= 6 ? 4 : 3;
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(127,227,210,.14)';
      ctx.fillRect(-s * 3, -s * 3, s * 6, s * 6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0a1a18';
      ctx.fillRect(-s - 1, -s - 1, s * 2 + 2, s * 2 + 2);
      ctx.fillStyle = value >= 10 ? '#e8c170' : '#7fe3d2';
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.fillStyle = '#eafff8';
      ctx.fillRect(-s + 1, -s + 1, s, s);
      ctx.fillStyle = '#2f8f7f';
      ctx.fillRect(-s, s - 1, s, 1);
      ctx.restore();
    },

    /** 短剑/靴子/沙漏等升级图标，全部 8x8 像素绘制 */
    drawUpgradeIcon(ctx, kind, cx, cy, scale, color) {
      const cv = makeCanvas(8, 8);
      const c = cv.getContext('2d');
      const b = (x, y, w, h, col = color) => px(c, x, y, w, h, col);
      if (kind === 'damage') {
        b(1, 5, 1, 2, '#e8d8bb'); b(2, 4, 1, 2, '#e8d8bb');
        b(3, 3, 1, 2, color); b(4, 2, 1, 2, color); b(5, 1, 1, 2, color);
        b(4, 5, 3, 1, '#e8c170'); b(6, 3, 1, 1, '#fff'); b(3, 6, 1, 1, color);
      } else if (kind === 'atkSpeed') {
        b(3, 0, 2, 1, color); b(2, 1, 1, 1, color); b(1, 2, 1, 2, color);
        b(2, 4, 4, 1, color); b(3, 5, 3, 1, color); b(4, 6, 1, 1, color);
        b(5, 3, 2, 1, '#fff'); b(1, 6, 2, 1, '#e8c170');
      } else if (kind === 'cooldown') {
        b(2, 1, 4, 1, color); b(1, 2, 1, 4, color); b(2, 6, 4, 1, color);
        b(5, 2, 1, 4, color); b(3, 3, 1, 2, '#fff'); b(4, 4, 2, 1, '#e8c170');
        b(2, 0, 4, 1, '#e8c170'); b(3, 7, 2, 1, '#e8c170');
      } else if (kind === 'speed') {
        b(2, 1, 2, 4, color); b(4, 3, 2, 2, color); b(1, 5, 5, 1, color);
        b(2, 6, 1, 1, color); b(5, 6, 1, 1, color); b(0, 3, 1, 1, '#e8c170');
        b(6, 2, 2, 1, '#fff');
      } else {
        b(2, 2, 4, 4, color); b(1, 3, 6, 2, color); b(3, 1, 2, 1, color);
        b(3, 3, 2, 2, '#fff'); b(2, 6, 4, 1, '#e8c170'); dot(c, 3, 6, color);
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const w = 8 * scale;
      ctx.drawImage(cv, 0, 0, 8, 8, cx - w / 2, cy - w / 2, w, w);
      ctx.restore();
    },

    /** Boss 血条 / 结算面板上的纹章。 */
    drawBossIcon(ctx, floorIndex, cx, cy, scale, bossId) {
      const pools = [
        ['truffle', 'sunstar', 'ninesun'],
        ['peach', 'oga', 'june'],
        ['tower', 'bigmon', 'edo']
      ];
      const key = bossId || (pools[U.clamp(floorIndex, 0, 2)] || pools[2])[0];
      const cv = getSprite('boss:' + key, 0, null);
      const w = 24 * scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, cx - w / 2, cy - w / 2, w, w);
      ctx.restore();
    },

    /**
     * 地图障碍。五棵树分别用五种配色，方便玩家在关卡里认路。
     * 数据形状：{type,x,y,r,variant,destructible,hp,maxHp,broken}
     */
    drawObstacle(ctx, o, time, theme) {
      if (!o || o.broken) return;
      const x = Math.round(o.x);
      const y = Math.round(o.y);
      const sway = Math.sin(time * 1.7 + x * 0.03) * 2;
      ctx.save();

      // 地面投影
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#040308';
      ctx.beginPath();
      ctx.ellipse(x, y + o.r * 0.7, o.r * 0.9, o.r * 0.3, 0, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (o.type === 'tree') {
        const palettes = [
          ['#2d5a46', '#4f8f68', '#8ef0c8'], // 青苔
          ['#3d4f6e', '#7897c9', '#c9e8ff'], // 霜枝
          ['#7a2f4a', '#c96a86', '#ffb7c8'], // 赤花
          ['#6b5130', '#b58a4f', '#ffd36b'], // 金叶
          ['#41305c', '#7a5a9e', '#d3a6ff']  // 墨紫
        ];
        const p = palettes[o.variant % palettes.length];
        // 树干
        px(ctx, x - 4, y - 22, 8, 26, '#3a241c');
        px(ctx, x - 3, y - 22, 3, 26, '#5c3a2a');
        px(ctx, x + 2, y - 20, 2, 22, '#2a1814');
        // 枝
        px(ctx, x - 12, y - 36, 10, 3, '#3a241c');
        px(ctx, x + 2, y - 42, 12, 3, '#3a241c');
        px(ctx, x - 16, y - 48, 8, 3, '#3a241c');
        // 树冠
        const cy = y - 62 + sway * 0.5;
        px(ctx, x - 24, cy + 4, 48, 24, '#0b100e');
        px(ctx, x - 22, cy, 44, 26, p[0]);
        px(ctx, x - 16, cy - 8, 34, 24, p[1]);
        px(ctx, x - 8, cy - 15, 22, 20, p[1]);
        px(ctx, x - 2, cy - 10, 18, 16, p[1]);
        px(ctx, x - 18, cy + 2, 16, 8, p[1]);
        // 高光与果子
        px(ctx, x - 10, cy - 4, 10, 3, p[2]);
        px(ctx, x + 2, cy + 4, 5, 2, p[2]);
        dot(ctx, x + 9, cy + 1, p[2]);
        dot(ctx, x - 14, cy + 8, p[2]);
        dot(ctx, x - 3, cy + 14, p[2]);
        // 五树纹
        px(ctx, x - 7, y - 10, 14, 2, '#0b100e');
        px(ctx, x - 4, y - 7, 8, 1, p[2]);
        if (o.destructible) {
          px(ctx, x - 1, y + 4, 2, 4, '#ffd36b');
        }
      } else if (o.type === 'pillar') {
        px(ctx, x - 11, y - 40, 22, 48, '#0b080d');
        px(ctx, x - 9, y - 38, 18, 44, '#6b604e');
        px(ctx, x - 6, y - 38, 6, 44, '#8d8068');
        px(ctx, x + 3, y - 36, 5, 40, '#4a4136');
        px(ctx, x - 13, y - 46, 26, 8, '#4a4136');
        px(ctx, x - 11, y - 44, 22, 4, '#a89a78');
        for (let i = 0; i < 4; i++) px(ctx, x - 7, y - 30 + i * 10, 14, 1, '#4a4136');
        dot(ctx, x, y - 44, theme ? theme.accent : PAL.gold);
      } else if (o.type === 'crate') {
        px(ctx, x - 14, y - 16, 28, 30, '#0b0806');
        px(ctx, x - 12, y - 14, 24, 26, '#8a5f36');
        px(ctx, x - 12, y - 14, 24, 4, '#b5844e');
        px(ctx, x - 12, y - 4, 24, 3, '#5f3f24');
        px(ctx, x - 2, y - 14, 4, 26, '#5f3f24');
        px(ctx, x - 12, y + 2, 24, 3, '#5f3f24');
        dot(ctx, x - 9, y - 10, '#ffd36b');
        dot(ctx, x + 8, y - 10, '#ffd36b');
      } else {
        // stone
        px(ctx, x - 16, y - 14, 32, 26, '#0b080d');
        px(ctx, x - 14, y - 12, 28, 22, '#5f5a66');
        px(ctx, x - 10, y - 12, 16, 8, '#7d7786');
        px(ctx, x + 2, y - 4, 10, 8, '#494550');
        px(ctx, x - 12, y + 6, 22, 4, '#3a3642');
        dot(ctx, x - 6, y - 4, '#9c95a8');
      }

      // 可破坏物血条
      if (o.destructible && o.hp < o.maxHp) {
        const w = 30;
        ctx.fillStyle = 'rgba(4,3,9,.85)';
        ctx.fillRect(x - w / 2, y - o.r - 16, w, 4);
        ctx.fillStyle = '#ffd36b';
        ctx.fillRect(x - w / 2, y - o.r - 16, w * U.clamp(o.hp / o.maxHp, 0, 1), 4);
      }
      ctx.restore();
    }
  };

  Ink.Art = Art;
})();
