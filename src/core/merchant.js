/* ============================================================
 * 庭中有奇树 · 行商 NPC 像素建模
 * 学长 / 学姐：24×24、两帧；商店房里随机出现一位，站在正中。
 * 全部程序化绘制，不依赖外部图片。
 * ============================================================ */
(function () {
  'use strict';
  const Ink = window.Ink;
  const C = {
    skin: '#f0c9a4', skinShade: '#c99472', hair: '#242231', hair2: '#3b3450',
    senior: '#294d78', senior2: '#3f6f9f', seniorGold: '#e8c170',
    seniora: '#3f7f6a', seniora2: '#5fa58b', senioraPink: '#e8a0b4',
    paper: '#f6e8c8', ink: '#221b2e', wood: '#6b422e', wood2: '#92603e',
    gold: '#e8c170', jade: '#8ef0c8', blue: '#8fd6ff'
  };
  const cache = {};

  function make(kind, frame) {
    const cv = Ink.Art.makeCanvas(24, 24);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const r = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const isA = kind === 'seniora';
    const robe = isA ? C.seniora : C.senior;
    const robe2 = isA ? C.seniora2 : C.senior2;
    const hair = isA ? '#4a2e35' : C.hair;
    const sway = frame ? 1 : 0;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(12, 22, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头发 / 头饰
    r(hair, 7, 3, 10, 3);
    r(hair, 6, 5, 2, 6);
    r(hair, 16, 5, 2, 7);
    r(C.skin, 8, 5, 8, 6);
    r(C.skinShade, 8, 10, 8, 1);
    // 眼睛
    r(C.ink, 9, 7, 2, 2);
    r(C.ink, 13, 7, 2, 2);
    r(C.skin, 11, 8, 2, 2);
    // 嘴
    r('#b56c5a', 11, 10, 2, 1);

    if (isA) {
      // 学姐：长发、发簪、披帛
      r(hair, 6, 8, 2, 10);
      r(hair, 16, 7, 2, 11);
      r(C.senioraPink, 15, 3, 4, 2);
      r(C.gold, 17, 4, 2, 2);
      r(C.paper, 7, 11, 10, 2);
      r(robe, 6, 13, 12, 7);
      r(robe2, 8, 13, 8, 3);
      r(C.senioraPink, 15, 14, 2, 5);
      r(C.paper, 10, 12, 4, 1);
      // 手臂 / 团扇
      r(C.skin, 4, 15, 2, 4); r(C.skin, 18, 15, 2, 4);
      r('#6b4a34', 2, 12 + sway, 1, 7);
      r(C.paper, 0, 9 + sway, 5, 5);
      r(C.senioraPink, 1, 10 + sway, 3, 3);
    } else {
      // 学长：方巾、眼镜、书
      r(C.ink, 7, 3, 10, 1);
      r(C.seniorGold, 9, 2, 6, 1);
      r(C.seniorGold, 10, 1, 4, 1);
      r('#eaf6ff', 8, 7, 3, 2);
      r('#eaf6ff', 13, 7, 3, 2);
      r(C.ink, 9, 7, 1, 2); r(C.ink, 14, 7, 1, 2);
      r(C.paper, 7, 11, 10, 2);
      r(robe, 6, 13, 12, 7);
      r(robe2, 8, 13, 8, 3);
      r(C.seniorGold, 10, 14, 4, 1);
      // 手臂 / 书
      r(C.skin, 4, 15, 2, 4); r(C.skin, 18, 15, 2, 4);
      r(C.paper, 17, 13 + sway, 5, 4);
      r(C.seniorGold, 18, 14 + sway, 3, 1);
      r(C.ink, 19, 15 + sway, 1, 1);
      r(C.ink, 20, 15 + sway, 1, 1);
    }

    // 下摆 / 鞋
    r(robe, 7, 20, 10, 2);
    r(C.ink, 8, 22, 3, 1);
    r(C.ink, 13, 22, 3, 1);
    return cv;
  }

  function sprite(kind, frame = 0) {
    const k = kind + ':' + (frame % 2);
    if (!cache[k]) cache[k] = make(kind, frame % 2);
    return cache[k];
  }

  function draw(ctx, kind, x, y, scale = 2.4, time = 0) {
    const frame = Math.floor(time * 1.35) % 2;
    const img = sprite(kind, frame);
    const bob = Math.sin(time * 2.1) * 1.1;
    const s = scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x - 12 * s), Math.round(y - 24 * s + bob), 24 * s, 24 * s);
    ctx.restore();
    // 名牌
    ctx.save();
    ctx.font = 'bold 9px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,8,18,.78)';
    ctx.fillRect(x - 26, y - 24 * s - 18, 52, 13);
    ctx.fillStyle = kind === 'seniora' ? '#8ef0c8' : '#e8c170';
    ctx.fillText(kind === 'seniora' ? '学姐' : '学长', x, y - 24 * s - 8);
    ctx.restore();
  }

  /** 摊位：一块木柜台 + 两侧货架，避免只画一个悬空 NPC。 */
  function drawStall(ctx, x, y, kind, time) {
    const s = 2.4;
    const top = y + 4;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // 柜台
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    ctx.beginPath(); ctx.ellipse(x, top + 19, 52, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.wood;
    ctx.fillRect(x - 48, top, 96, 7);
    ctx.fillStyle = C.wood2;
    ctx.fillRect(x - 48, top, 96, 2);
    ctx.fillStyle = '#3a241c';
    ctx.fillRect(x - 42, top + 7, 84, 9);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x - 44, top + 1, 4, 4);
    ctx.fillRect(x + 40, top + 1, 4, 4);
    // 两侧货架/灯
    for (const side of [-1, 1]) {
      const bx = x + side * 55;
      ctx.fillStyle = '#2b1d19';
      ctx.fillRect(bx - 7, top - 10, 14, 26);
      ctx.fillStyle = side > 0 ? C.seniorGold : C.senioraPink;
      ctx.fillRect(bx - 4, top - 7, 8, 6);
      ctx.fillStyle = 'rgba(232,193,112,.16)';
      ctx.beginPath(); ctx.arc(bx, top - 4, 14, 0, Math.PI * 2); ctx.fill();
    }
    // 柜台上的小物件
    ctx.fillStyle = C.paper;
    ctx.fillRect(x - 28, top - 5, 12, 6);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 25, top - 3, 6, 1);
    ctx.fillStyle = '#7a4c39';
    ctx.fillRect(x + 16, top - 7, 2, 8);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + 12, top - 9, 10, 3);
    ctx.restore();
  }

  Ink.MerchantArt = { sprite, draw, drawStall };
})();
