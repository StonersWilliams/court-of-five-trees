/**
 * 32×32 庭主立绘（v5.2）。
 *
 * 旧版 24×24 在 4 倍放大后轮廓偏糊；这里改为 32×32，统一 1px 外描边、
 * 三段明暗和更大的剪影差异。13 位庭主各有独立轮廓：
 * 菌伞、日轮、九日、桃树、剑客、雨云、钟塔、巨怪、多口、宇航、铁柱、玉女、书页。
 * 纯 Canvas 2D 程序化绘制，不依赖图片。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const Art = Ink.Art;
  const OUT = '#08060c';
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

  function box(c, x, y, w, h, fill, outline) {
    px(c, x - 1, y - 1, w + 2, h + 2, outline || OUT);
    px(c, x, y, w, h, fill);
  }

  function dot(c, x, y, color) {
    px(c, x, y, 1, 1, color);
  }

  function eyes(c, x1, x2, y, color, glow) {
    px(c, x1, y, 2, 2, color);
    px(c, x2, y, 2, 2, color);
    dot(c, x1 + 1, y, glow);
    dot(c, x2 + 1, y, glow);
  }

  /** 像素圆：逐行画水平线，避免 32×32 立绘全是大方块。 */
  function disc(c, cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      px(c, cx - w, cy + dy, w * 2 + 1, 1, color);
    }
  }

  function ellipse(c, cx, cy, rx, ry, color) {
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      px(c, cx - w, cy + dy, w * 2 + 1, 1, color);
    }
  }

  /** 小型庭主共用袍身。 */
  function body(c, o, f) {
    const step = f ? 1 : 0;
    px(c, 6, 18, 3, 11, o.cloak || o.dark);
    px(c, 23, 18, 3, 11, o.cloak || o.dark);
    px(c, 10, 27, 5, 3, o.boot || o.dark);
    px(c, 17, 27, 5, 3, o.boot || o.dark);
    box(c, 9, 17, 14, 11, o.robe || o.dark);
    px(c, 10, 17, 12, 2, o.robeHi || o.robe);
    px(c, 9, 22, 14, 2, o.belt || o.dark);
    dot(c, 15, 22, o.gold || '#e8c170');
    px(c, 8, 19, 3, 7, o.sleeve || o.robe);
    px(c, 21, 19, 3, 7, o.sleeve || o.robe);
    px(c, 8, 26, 3, 2, o.skin || o.dark);
    px(c, 21, 26, 3, 2, o.skin || o.dark);
    px(c, 15, 24, 2, 5, o.robeDark || o.dark);
    px(c, 10 + step, 29, 4, 2, o.bootHi || o.dark);
    px(c, 18 - step, 29, 4, 2, o.bootHi || o.dark);
  }

  const BUILDERS = {
    truffle(c, f) {
      // 巨大菌伞：用椭圆而不是阶梯方块，边缘保留 1px 深色描边。
      ellipse(c, 16, 10, 15, 7, '#2a1a12');
      ellipse(c, 16, 8, 14, 6, '#b78250');
      ellipse(c, 16, 7, 12, 5, '#c89b6a');
      ellipse(c, 16, 11, 13, 3, '#6e4b31');
      ellipse(c, 15, 6, 5, 2, '#e6cc9e');
      ellipse(c, 22, 8, 3, 2, '#d7b37e');
      px(c, 8, 7, 3, 2, '#f2e0b8');
      px(c, 19, 10, 4, 2, '#8b5c3b');
      // 菌褶
      px(c, 3, 15, 26, 2, '#d9c39a');
      for (let i = 0; i < 9; i++) px(c, 4 + i * 3, 15, 1, 2, '#a88a65');
      // 短袍与菌丝
      body(c, { robe: '#6f5a45', robeHi: '#8f765b', robeDark: '#3e3023', dark: '#201810', belt: '#2a1d13', boot: '#3b2a1d', bootHi: '#8a6c4b', sleeve: '#66513e', skin: '#d8b78c', gold: '#e8c170' }, f);
      eyes(c, 12, 18, 18, '#24170f', '#ffe1a6');
      px(c, 14, 21, 4, 1, '#4b3524');
      // 菌杖：浅色杖身，菌伞头与杖身连成一体，不再像悬浮方块。
      px(c, 26, 8, 2, 20, '#8a6a43');
      px(c, 27, 8, 1, 18, '#c9a36a');
      ellipse(c, 27, 6, 4, 3, '#382416');
      ellipse(c, 27, 6, 3, 2, '#d7b37e');
      dot(c, 28, 5, '#8b5c7a');
    },

    sunstar(c, f) {
      // 日轮与外焰：圆形太阳 + 短光芒，避免整张图看起来像方块。
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.round(16 + Math.cos(a) * 13.5);
        const y = Math.round(11 + Math.sin(a) * 11);
        px(c, x - 1, y - 1, 3, 3, i % 2 ? '#b6652d' : '#ffd36b');
        if (i % 2 === 0) px(c, x, y - 3, 1, 2, '#fff0b0');
      }
      disc(c, 16, 11, 12, '#5b3518');
      disc(c, 16, 11, 11, '#e8a23e');
      disc(c, 16, 10, 9, '#ffd36b');
      disc(c, 16, 9, 7, '#f7df9c');
      px(c, 9, 16, 14, 2, '#b6652d');
      eyes(c, 12, 18, 9, '#4a250d', '#fff7cf');
      px(c, 14, 12, 4, 1, '#8a4b18');
      // 高光日冕
      px(c, 9, 4, 2, 2, '#fff7cf');
      px(c, 21, 5, 2, 1, '#fff0b0');
      body(c, { robe: '#b78a3c', robeHi: '#e8c170', robeDark: '#6f4c20', dark: '#2a1a08', belt: '#3c250b', boot: '#4f3412', bootHi: '#d7a94f', sleeve: '#d2a44d', skin: '#f4d69e', gold: '#fff0b0' }, f);
      // 太阳纹章
      px(c, 12, 19, 8, 6, '#3b250c');
      px(c, 13, 20, 6, 4, '#ffd36b');
      px(c, 15, 21, 2, 2, '#b6652d');
    },

    ninesun(c, f) {
      // 后方三日（圆盘，避免太阳变成方框）
      for (const [x, y, r] of [[5, 7, 5], [27, 7, 5], [16, 3, 6]]) {
        disc(c, x, y, r, '#5b1d0a');
        disc(c, x, y, r - 1, '#d96b2b');
        disc(c, x, y, r - 2, '#ffd36b');
        disc(c, x - 1, y - 1, 1, '#fff0b0');
      }
      // 九枚小太阳环
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = 16 + Math.cos(a) * 14;
        const y = 14 + Math.sin(a) * 12;
        dot(c, x, y, '#ff8a4c');
        dot(c, x + 1, y, '#ffd36b');
      }
      // 火焰披风与铠甲
      px(c, 6, 14, 20, 17, '#5b1d12');
      px(c, 8, 16, 16, 13, '#a33a1d');
      px(c, 10, 18, 12, 10, '#40130b');
      px(c, 12, 18, 8, 3, '#ff8a4c');
      px(c, 13, 20, 6, 1, '#ffd36b');
      px(c, 9, 23, 14, 2, '#2a0b06');
      // 头与冠
      box(c, 11, 8, 10, 8, '#e7b270');
      px(c, 11, 6, 10, 3, '#2a0b06');
      px(c, 12, 4, 8, 2, '#ff8a4c');
      px(c, 14, 2, 4, 2, '#ffd36b');
      eyes(c, 12, 18, 11, '#2a0b06', '#ffe1a6');
      px(c, 14, 14, 4, 1, '#7d2a12');
      // 火焰手
      px(c, 5, 22, 3, 5, '#ff8a4c');
      px(c, 4, 20, 2, 3, '#ffd36b');
      px(c, 24, 22, 3, 5, '#ff8a4c');
      px(c, 26, 20, 2, 3, '#ffd36b');
    },

    peach(c, f) {
      // 桃树冠：三团重叠的圆形花冠，不再是一条平顶。
      ellipse(c, 16, 8, 15, 7, '#5b1f33');
      ellipse(c, 9, 7, 8, 5, '#8f3553');
      ellipse(c, 22, 6, 9, 5, '#8f3553');
      ellipse(c, 15, 5, 12, 5, '#d96b8a');
      ellipse(c, 9, 4, 6, 3, '#ff9bb0');
      ellipse(c, 23, 4, 6, 3, '#ff9bb0');
      px(c, 5, 3, 6, 3, '#ffc2d4');
      px(c, 21, 3, 5, 2, '#ffd7e1');
      px(c, 4, 10, 5, 2, '#b74a6b');
      px(c, 23, 9, 4, 2, '#b74a6b');
      // 花朵
      for (const [x, y] of [[8, 5], [14, 3], [20, 6], [25, 4], [11, 9], [23, 11]]) {
        dot(c, x, y, '#fff0f3');
        dot(c, x + 1, y, '#ffd36b');
        dot(c, x, y + 1, '#ffc2d4');
      }
      // 树干身体
      box(c, 11, 11, 10, 19, '#6e4a32');
      px(c, 12, 12, 8, 17, '#9a6a45');
      px(c, 13, 13, 2, 14, '#c08a5b');
      px(c, 10, 18, 4, 4, '#5a3a26');
      px(c, 18, 18, 4, 4, '#5a3a26');
      // 树中面孔
      px(c, 12, 15, 8, 6, '#d8a06b');
      eyes(c, 13, 18, 16, '#24140d', '#ffe1a6');
      px(c, 14, 19, 4, 1, '#5c2b20');
      // 枝手臂
      px(c, 5, 16, 6, 3, '#7c5136');
      px(c, 21, 16, 6, 3, '#7c5136');
      px(c, 3, 14, 4, 2, '#9a6a45');
      px(c, 25, 15, 4, 2, '#9a6a45');
      dot(c, 6, 15, '#ff9bb0');
      dot(c, 26, 14, '#ffc2d4');
      px(c, 10, 29, 4, 2, '#4b2f1e');
      px(c, 18, 29, 4, 2, '#4b2f1e');
    },

    oga(c, f) {
      // 长刀与围巾
      px(c, 24, 4, 2, 20, '#d9e4f3');
      px(c, 23, 2, 4, 3, '#8f9dff');
      px(c, 23, 23, 4, 3, '#5b3a26');
      px(c, 6, 15, 8, 3, '#5b73c9');
      px(c, 24, 15, 5, 2, '#5b73c9');
      // 斗笠
      px(c, 4, 3, 24, 3, '#223047');
      px(c, 7, 1, 18, 3, '#344a68');
      px(c, 9, 0, 14, 1, '#7e97c9');
      px(c, 3, 6, 26, 2, '#1a2435');
      // 头/脸
      box(c, 11, 8, 10, 8, '#e1b98f');
      px(c, 10, 7, 12, 2, '#121722');
      px(c, 11, 14, 10, 3, '#2b3550');
      eyes(c, 12, 18, 11, '#10131c', '#8fd6ff');
      // 蓝袍
      body(c, { robe: '#2d3f6b', robeHi: '#47639b', robeDark: '#17233d', dark: '#0d1422', belt: '#1a2438', boot: '#1b2435', bootHi: '#5b73a0', sleeve: '#26375a', skin: '#e1b98f', gold: '#8f9dff' }, f);
      px(c, 8, 18, 4, 5, '#38527f');
      px(c, 20, 18, 4, 5, '#38527f');
      // 刀鞘
      px(c, 5, 20, 2, 10, '#2a1d16');
      px(c, 6, 19, 1, 2, '#8f9dff');
    },

    june(c, f) {
      // 雨云：多团椭圆叠成云，不再是一条矩形屋檐。
      ellipse(c, 7, 5, 7, 4, '#3b4f65');
      ellipse(c, 16, 4, 9, 5, '#4e6580');
      ellipse(c, 25, 5, 7, 4, '#4e6580');
      ellipse(c, 13, 3, 6, 3, '#7d9fc0');
      ellipse(c, 23, 4, 5, 3, '#7d9fc0');
      ellipse(c, 16, 6, 8, 2, '#b7d9ff');
      for (let i = 0; i < 6; i++) px(c, 3 + i * 5, 9, 1, 4, '#8fd6ff');
      // 伞面
      px(c, 2, 10, 28, 2, '#8fb9d9');
      px(c, 6, 9, 20, 1, '#d7ecff');
      px(c, 15, 11, 1, 14, '#5b4532');
      // 和服
      body(c, { robe: '#b8cfe0', robeHi: '#e6f3ff', robeDark: '#728da3', dark: '#243747', belt: '#4f6f86', boot: '#3c5364', bootHi: '#a9c9dc', sleeve: '#9ebcd2', skin: '#ecd0b0', gold: '#b7d9ff' }, f);
      // 头部与发
      box(c, 11, 12, 10, 8, '#ecd0b0');
      px(c, 9, 12, 3, 8, '#253746');
      px(c, 20, 12, 3, 8, '#253746');
      px(c, 10, 11, 12, 2, '#253746');
      eyes(c, 12, 18, 15, '#1b252d', '#b7d9ff');
      px(c, 14, 18, 4, 1, '#8d5b62');
      // 雨滴
      px(c, 25, 21, 1, 3, '#8fd6ff');
      px(c, 6, 22, 1, 2, '#b7d9ff');
      px(c, 28, 14, 1, 2, '#8fd6ff');
    },

    tower(c, f) {
      // 尖顶
      px(c, 15, 0, 2, 3, '#e8c170');
      px(c, 11, 2, 10, 3, '#5a3f25');
      px(c, 7, 4, 18, 3, '#8a6a43');
      px(c, 3, 6, 26, 2, '#3a2a1c');
      // 钟楼主体
      box(c, 8, 7, 16, 24, '#6f6558');
      px(c, 9, 8, 14, 22, '#9b8d78');
      px(c, 9, 8, 2, 22, '#c0b096');
      px(c, 21, 8, 2, 22, '#5a5045');
      // 砖缝
      for (let y = 11; y < 30; y += 4) px(c, 10, y, 12, 1, '#736858');
      for (let x = 12; x < 22; x += 4) px(c, x, 8, 1, 22, '#736858');
      // 钟面
      px(c, 12, 9, 9, 9, '#e8c170');
      px(c, 13, 10, 7, 7, '#f7e8c0');
      px(c, 16, 11, 1, 4, '#3a2a1c');
      px(c, 16, 14, 3, 1, '#3a2a1c');
      dot(c, 16, 10, '#7f2b1e');
      // 摆锤
      px(c, 15, 23, 2, 6, '#e8c170');
      box(c, 12, 27, 8, 3, '#b78250');
      // 侧钟
      box(c, 4, 12, 4, 6, '#b78250', '#2a1c12');
      box(c, 24, 12, 4, 6, '#b78250', '#2a1c12');
      px(c, 5, 14, 2, 2, '#3a2a1c');
      px(c, 25, 14, 2, 2, '#3a2a1c');
    },

    bigmon(c, f) {
      // 大棒
      px(c, 25, 4, 3, 22, '#6b4a2d');
      px(c, 23, 1, 7, 8, '#8a6a43');
      for (let i = 0; i < 5; i++) px(c, 24 + (i % 3) * 2, 2 + Math.floor(i / 3) * 3, 2, 2, '#d7c39a');
      // 身体：圆肩大肚，轮廓比矩形更有巨怪感
      ellipse(c, 16, 22, 12, 10, '#1e3829');
      ellipse(c, 16, 21, 11, 9, '#5a9970');
      ellipse(c, 14, 18, 6, 4, '#8ef0c8');
      ellipse(c, 16, 24, 7, 5, '#a9d3a0');
      px(c, 11, 25, 10, 3, '#7fae7d');
      // 头和角
      ellipse(c, 16, 10, 8, 7, '#2a4a36');
      ellipse(c, 16, 9, 7, 6, '#5a9970');
      px(c, 8, 4, 4, 4, '#d7c39a');
      px(c, 21, 4, 4, 4, '#d7c39a');
      px(c, 9, 3, 2, 2, '#fff0c0');
      px(c, 22, 3, 2, 2, '#fff0c0');
      eyes(c, 12, 18, 10, '#172015', '#8ef0c8');
      px(c, 13, 14, 6, 2, '#2b3b2a');
      for (let i = 0; i < 4; i++) px(c, 13 + i * 2, 14, 1, 1, '#fff0c0');
      // 手臂
      px(c, 3, 16, 5, 9, '#4f8666');
      px(c, 24, 16, 5, 9, '#4f8666');
      px(c, 2, 24, 5, 4, '#5a9970');
      px(c, 25, 24, 5, 4, '#5a9970');
      // 腰带与肚脐
      px(c, 7, 21, 18, 2, '#2b3b2a');
      dot(c, 16, 25, '#3b5a3a');
    },

    edo(c, f) {
      // 长发与十二口
      px(c, 7, 2, 18, 13, '#1d1024');
      px(c, 5, 8, 4, 12, '#2b1733');
      px(c, 23, 8, 4, 12, '#2b1733');
      px(c, 8, 0, 16, 4, '#2b1733');
      // 发簪
      px(c, 5, 3, 23, 2, '#c084fc');
      px(c, 6, 2, 2, 2, '#ffd36b');
      px(c, 25, 2, 2, 2, '#ffd36b');
      // 脸（椭圆，和长发/领口衔接）
      ellipse(c, 16, 12, 6, 5, '#7a4a58');
      ellipse(c, 16, 12, 5, 4, '#ecd0c0');
      px(c, 9, 6, 14, 2, '#1d1024');
      eyes(c, 12, 18, 10, '#1a0f1d', '#ff9bb0');
      px(c, 14, 14, 4, 1, '#8f2b4a');
      // 十二口：脸侧和扇面
      for (let i = 0; i < 6; i++) {
        dot(c, 8, 17 + i, '#ff9bb0');
        dot(c, 23, 17 + i, '#ff9bb0');
      }
      // 和服
      body(c, { robe: '#4b2456', robeHi: '#744080', robeDark: '#28132f', dark: '#160b1b', belt: '#c084fc', boot: '#2b1530', bootHi: '#8f5aa0', sleeve: '#67356f', skin: '#ecd0c0', gold: '#ffd36b' }, f);
      // 扇
      px(c, 24, 14, 2, 9, '#5b3a26');
      px(c, 22, 9, 9, 6, '#ff9bb0');
      px(c, 23, 10, 7, 4, '#ffd36b');
      for (let i = 0; i < 3; i++) px(c, 24 + i * 2, 10, 1, 4, '#8f2b4a');
      // 十二口扇坠
      for (let i = 0; i < 4; i++) dot(c, 22 + i * 2, 16, '#ff9bb0');
    },

    buzz(c, f) {
      // 背包与推进器
      px(c, 3, 15, 6, 12, '#6f7a86');
      px(c, 23, 15, 6, 12, '#6f7a86');
      px(c, 4, 24, 3, 3, '#ff8a4c');
      px(c, 25, 24, 3, 3, '#ff8a4c');
      // 宇航服
      box(c, 8, 15, 16, 15, '#e8edf2');
      px(c, 9, 16, 14, 12, '#f7fbff');
      px(c, 10, 22, 12, 2, '#8f9dff');
      px(c, 13, 15, 6, 2, '#b8c4cf');
      // 球形头盔 + 椭圆面罩
      disc(c, 16, 9, 8, '#26384a');
      disc(c, 16, 9, 7, '#d9e4f3');
      ellipse(c, 16, 9, 6, 5, '#bfe3ff');
      ellipse(c, 16, 7, 4, 2, '#f7fbff');
      ellipse(c, 16, 10, 4, 3, '#7db9e8');
      eyes(c, 13, 18, 9, '#1a2430', '#8fd6ff');
      // 红色批注与笔
      box(c, 23, 10, 8, 5, '#d94a4a', '#3a1010');
      px(c, 24, 11, 6, 1, '#ffd36b');
      px(c, 23, 15, 1, 11, '#e8c170');
      // 靴子
      px(c, 9, 29, 6, 2, '#7d8a96');
      px(c, 18, 29, 6, 2, '#7d8a96');
    },

    liu(c, f) {
      // 铁柱身躯
      box(c, 9, 8, 14, 24, '#6a5a4e');
      px(c, 10, 9, 12, 22, '#8a7461');
      px(c, 10, 9, 2, 22, '#b39a80');
      px(c, 20, 9, 2, 22, '#58483c');
      for (let y = 12; y < 30; y += 4) {
        dot(c, 12, y, '#d7c39a');
        dot(c, 19, y, '#d7c39a');
      }
      // 头部
      box(c, 12, 5, 8, 8, '#d7b48a');
      px(c, 11, 4, 10, 2, '#3a2a1c');
      eyes(c, 13, 18, 8, '#1a120c', '#ffd36b');
      px(c, 15, 11, 2, 1, '#5b3a26');
      // 铁砧肩
      box(c, 3, 14, 8, 5, '#3e3a38');
      px(c, 4, 14, 6, 2, '#7d7670');
      box(c, 22, 15, 7, 4, '#7d7670');
      // 锤
      px(c, 25, 6, 2, 18, '#5b3a26');
      box(c, 22, 3, 9, 6, '#3e3a38');
      px(c, 24, 4, 5, 1, '#b39a80');
      // 腿
      px(c, 11, 29, 4, 2, '#3e3a38');
      px(c, 18, 29, 4, 2, '#3e3a38');
    },

    yuenu(c, f) {
      // 玉环
      px(c, 3, 8, 4, 13, '#8ef0c8');
      px(c, 25, 8, 4, 13, '#8ef0c8');
      px(c, 4, 9, 2, 11, '#d7fff0');
      px(c, 26, 9, 2, 11, '#d7fff0');
      // 长发
      px(c, 8, 3, 16, 12, '#1f3d38');
      px(c, 7, 8, 3, 14, '#2f5a51');
      px(c, 23, 8, 3, 14, '#2f5a51');
      // 脸
      box(c, 11, 7, 10, 9, '#efd3b4');
      eyes(c, 12, 18, 10, '#20302a', '#8ef0c8');
      px(c, 14, 14, 4, 1, '#a65c62');
      // 玉冠
      px(c, 10, 3, 12, 2, '#8ef0c8');
      px(c, 14, 0, 4, 3, '#ffd36b');
      // 玉色衣裙
      body(c, { robe: '#2f6b5c', robeHi: '#54a28c', robeDark: '#1a3f37', dark: '#0d1f1b', belt: '#d7fff0', boot: '#24443c', bootHi: '#8ef0c8', sleeve: '#3c8270', skin: '#efd3b4', gold: '#ffd36b' }, f);
      // 腰鼓
      box(c, 11, 20, 10, 6, '#d7c39a', '#3e2a1e');
      px(c, 12, 21, 8, 4, '#f2e0b8');
      px(c, 15, 20, 2, 6, '#b78250');
      // 飘带
      px(c, 5, 22, 5, 2, '#8ef0c8');
      px(c, 22, 24, 5, 2, '#d7fff0');
    },

    creator(c, f) {
      // 巨大书页/披风
      px(c, 2, 10, 28, 20, '#e8d9b8');
      px(c, 3, 11, 26, 18, '#f7ecd0');
      px(c, 4, 12, 11, 16, '#fff8e8');
      px(c, 17, 12, 11, 16, '#f0e0bd');
      px(c, 15, 10, 2, 20, '#8a6a43');
      for (let i = 0; i < 5; i++) {
        px(c, 6, 14 + i * 3, 7, 1, '#b39a80');
        px(c, 19, 14 + i * 3, 7, 1, '#b39a80');
      }
      // 书页上的眼睛
      px(c, 12, 24, 8, 4, '#f7df9c');
      eyes(c, 13, 18, 25, '#4a250d', '#fff7cf');
      // 上半身/头
      box(c, 11, 3, 10, 9, '#f0d0aa');
      px(c, 10, 2, 12, 3, '#e8c170');
      px(c, 9, 4, 3, 8, '#b78250');
      px(c, 21, 4, 3, 8, '#b78250');
      eyes(c, 12, 18, 8, '#1a120c', '#ffd36b');
      // 创世朱笔
      px(c, 27, 2, 2, 17, '#8b5b3a');
      px(c, 26, 0, 4, 4, '#e8c170');
      px(c, 27, 19, 2, 2, '#b03a34');
      // 金色光环
      px(c, 6, 1, 2, 2, '#ffd36b');
      px(c, 24, 1, 2, 2, '#ffd36b');
      px(c, 3, 5, 1, 1, '#ffd36b');
      px(c, 28, 5, 1, 1, '#ffd36b');
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
    if (builder) builder(c, frame ? 1 : 0);
    else {
      box(c, 6, 4, 20, 24, '#ff00ff');
      px(c, 10, 9, 12, 1, '#ffffff');
      px(c, 10, 14, 12, 1, '#ffffff');
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
    if (!keyName || keyName.indexOf('boss:') !== 0) {
      return originalDraw.call(Art, ctx, keyName, x, y, scale, opt);
    }
    opt = opt || {};
    const cv = sprite(keyName.slice(5), opt.frame || 0, opt.tint || null);
    const w = SIZE * scale;
    const bob = opt.bob ? Math.sin((opt.time || 0) * 5.2 + x * 0.02) * opt.bob : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    if (opt.glow) {
      ctx.shadowColor = opt.glow;
      ctx.shadowBlur = 18;
    }
    ctx.translate(x, y + bob);
    if (opt.rotation) ctx.rotate(opt.rotation);
    if (opt.flip) ctx.scale(-1, 1);
    ctx.drawImage(cv, -w / 2, -w / 2, w, w);
    ctx.restore();
  };

  Art.drawBossIcon = function (ctx, floorIndex, cx, cy, scale, bossId) {
    const pools = [
      ['truffle', 'sunstar', 'ninesun'],
      ['peach', 'oga', 'june'],
      ['tower', 'bigmon', 'edo'],
      ['buzz', 'liu', 'yuenu'],
      ['creator']
    ];
    const key = bossId || (pools[Ink.U.clamp(floorIndex, 0, 4)] || pools[4])[0];
    const cv = sprite(key, 0, null);
    const w = 17 * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, cx - w, cy - w, w * 2, w * 2);
    ctx.restore();
  };

  Art.bossSprite = sprite;
})();
