/**
 * src/entities/weapon.js
 * ------------------------------------------------------------
 * 武器数据表与像素图标。
 *
 * 设计约定：
 *   - 武器只描述“怎么打”，不直接修改角色面板；
 *   - 每次开火由 Player.weaponShot() 创建投射物，因此角色被动、
 *     武器特效、子弹反弹等都能共享同一套伤害管线；
 *   - 新增武器只需在 DEFS 里追加一条，HUD / 商店 / 掉落会自动识别。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  /** 稀有度：决定边框、价格与掉落权重。 */
  const RARITY = {
    common: { name: '凡品', color: '#d8cbb0', order: 0 },
    rare: { name: '珍品', color: '#8fd6ff', order: 1 },
    epic: { name: '绝品', color: '#e8c170', order: 2 }
  };

  /**
   * 全部武器。
   * damageMult 是“角色攻击力”的倍率；shots / spread 描述多弹道；
   * slow / burn / ink / explode 是附加命中效果。
   */
  const DEFS = {
    flintlock: {
      id: 'flintlock', name: '燧发短铳', rarity: 'common', price: 9,
      color: '#e8c170', visual: 'orb', icon: 'gun', cooldown: 0.58,
      damageMult: 1.35, shots: 1, spread: 0, speed: 680, radius: 5,
      life: 1.4, knockback: 60, scale: 1,
      desc: '单发重弹。可靠、朴素，像一条旧木走廊。'
    },
    ironbolt: {
      id: 'ironbolt', name: '铁羽弩', rarity: 'common', price: 8,
      color: '#c9d7e6', visual: 'needle', icon: 'bow', cooldown: 0.31,
      damageMult: 0.86, shots: 1, spread: 0, speed: 780, radius: 4,
      life: 1.25, pierce: 1, knockback: 20,
      desc: '上弦快，箭身细。能穿过第一个倒霉蛋。'
    },
    twin: {
      id: 'twin', name: '双管短铳', rarity: 'common', price: 11,
      color: '#f0b080', visual: 'orb', icon: 'gun', cooldown: 0.52,
      damageMult: 0.72, shots: 2, spread: 0.16, speed: 640, radius: 4,
      life: 1.25, knockback: 30,
      desc: '左右各一管，近距离把话说完。'
    },
    sling: {
      id: 'sling', name: '碎星弹弓', rarity: 'common', price: 8,
      color: '#a7e0b0', visual: 'spike', icon: 'sling', cooldown: 0.38,
      damageMult: 0.58, shots: 2, spread: 0.2, speed: 640, radius: 4,
      life: 1.1, knockback: 18,
      desc: '两枚石子在空中吵架，然后各自落地。'
    },
    pinecone: {
      id: 'pinecone', name: '松果炮', rarity: 'common', price: 12,
      color: '#d0a36a', visual: 'orb', icon: 'bomb', cooldown: 0.82,
      damageMult: 1.18, shots: 1, spread: 0, speed: 390, radius: 8,
      life: 1.2, knockback: 45, explode: 62, explodeMult: 0.55,
      desc: '把松果塞进铁管。爆炸半径比良心大。'
    },
    bees: {
      id: 'bees', name: '蜂鸣针', rarity: 'common', price: 10,
      color: '#f4d76a', visual: 'needle', icon: 'needle', cooldown: 0.62,
      damageMult: 0.36, shots: 3, spread: 0.38, speed: 560, radius: 3,
      life: 1.5, homing: 3.2, trail: true,
      desc: '三根会拐弯的针。它们认得路。'
    },
    spear: {
      id: 'spear', name: '苔木投矛', rarity: 'common', price: 9,
      color: '#9fd2a8', visual: 'needle', icon: 'spear', cooldown: 0.56,
      damageMult: 1.12, shots: 1, spread: 0, speed: 780, radius: 5,
      life: 1.4, pierce: 2, knockback: 40,
      desc: '削尖的庭院木枝，可以穿过两个人。'
    },
    frostbow: {
      id: 'frostbow', name: '霜枝长弓', rarity: 'rare', price: 20,
      color: '#9fd9ff', visual: 'needle', icon: 'bow', cooldown: 0.46,
      damageMult: 1.05, shots: 1, spread: 0, speed: 850, radius: 5,
      life: 1.4, pierce: 1, slow: [0.6, 1.25], knockback: 25,
      desc: '箭杆上结着薄霜。命中后敌人会慢下来。'
    },
    flowerstaff: {
      id: 'flowerstaff', name: '赤花杖', rarity: 'rare', price: 21,
      color: '#ff8fb3', visual: 'petal', icon: 'staff', cooldown: 0.52,
      damageMult: 0.54, shots: 3, spread: 0.3, speed: 520, radius: 4,
      life: 1.6, homing: 2.4, trail: true,
      desc: '三片花瓣会追着同一个目标飞。'
    },
    thunder: {
      id: 'thunder', name: '雷引符', rarity: 'rare', price: 23,
      color: '#c9b3ff', visual: 'spike', icon: 'charm', cooldown: 0.7,
      damageMult: 1.0, shots: 1, spread: 0, speed: 600, radius: 6,
      life: 1.5, explode: 74, explodeMult: 0.7, knockback: 50,
      desc: '符纸落地时，天会替它补一句。'
    },
    inkmaw: {
      id: 'inkmaw', name: '墨潮喷筒', rarity: 'rare', price: 19,
      color: '#9a8ad6', visual: 'ink', icon: 'gun', cooldown: 0.68,
      damageMult: 0.3, shots: 5, spread: 0.58, speed: 470, radius: 4,
      life: 0.52, knockback: 22, ink: true,
      desc: '五滴墨，一次泼出去。近距离很难躲。'
    },
    boneflute: {
      id: 'boneflute', name: '影犬骨笛', rarity: 'rare', price: 22,
      color: '#8f7aff', visual: 'bone', icon: 'charm', cooldown: 0.56,
      damageMult: 0.56, shots: 2, spread: 0.22, speed: 500, radius: 4,
      life: 1.7, homing: 3.6, trail: true,
      desc: '吹一声，两根骨头替影犬去追。'
    },
    sunrepeater: {
      id: 'sunrepeater', name: '金乌连弩', rarity: 'rare', price: 24,
      color: '#ffd36b', visual: 'needle', icon: 'bow', cooldown: 0.16,
      damageMult: 0.48, shots: 1, spread: 0, speed: 880, radius: 4,
      life: 1.3, trail: true,
      desc: '射速快得像一串被点燃的省略号。'
    },
    echo: {
      id: 'echo', name: '镜湖回响', rarity: 'rare', price: 22,
      color: '#8ef0c8', visual: 'orb', icon: 'orb', cooldown: 0.4,
      damageMult: 0.8, shots: 1, spread: 0, speed: 620, radius: 5,
      life: 1.6, pierce: 1, bounce: 2,
      desc: '弹丸在墙上和敌人之间折返，像湖面回声。'
    },
    shears: {
      id: 'shears', name: '庭园裁枝剪', rarity: 'epic', price: 36,
      color: '#ffb35c', visual: 'needle', icon: 'blade', cooldown: 0.44,
      damageMult: 0.98, shots: 2, spread: 0.34, speed: 720, radius: 5,
      life: 1.4, pierce: 2, knockback: 45,
      desc: '两片巨刃交错。修剪枝条，也修剪来客。'
    },
    ninegun: {
      id: 'ninegun', name: '九阳火铳', rarity: 'epic', price: 40,
      color: '#ff8a4c', visual: 'orb', icon: 'gun', cooldown: 0.56,
      damageMult: 0.74, shots: 3, spread: 0.24, speed: 580, radius: 5,
      life: 1.5, burn: [2.2, 5], knockback: 25, glow: true,
      desc: '三颗小太阳。命中后还在敌人身上烧。'
    },
    reaper: {
      id: 'reaper', name: '无常墨镰', rarity: 'epic', price: 42,
      color: '#b28cff', visual: 'shadow', icon: 'blade', cooldown: 0.88,
      damageMult: 1.8, shots: 1, spread: 0, speed: 540, radius: 7,
      life: 1.5, pierce: 3, slow: [0.55, 1.3], knockback: 70,
      desc: '一镰扫过，墨色的风会替你收尾。'
    },
    towerbomb: {
      id: 'towerbomb', name: '钟楼轰击', rarity: 'epic', price: 44,
      color: '#ffd36b', visual: 'orb', icon: 'bomb', cooldown: 1.0,
      damageMult: 2.0, shots: 1, spread: 0, speed: 330, radius: 10,
      life: 1.4, explode: 92, explodeMult: 0.8, knockback: 80,
      desc: '把钟楼的一角拆下来扔出去。会响。'
    },
    peachwand: {
      id: 'peachwand', name: '桃枝连发', rarity: 'epic', price: 38,
      color: '#ffb7c8', visual: 'petal', icon: 'staff', cooldown: 0.5,
      damageMult: 0.42, shots: 4, spread: 0.44, speed: 570, radius: 4,
      life: 1.5, knockback: 12, trail: true,
      desc: '四片桃花，像一场不肯停的春雨。'
    },
    lantern: {
      id: 'lantern', name: '纸灯引魂', rarity: 'rare', price: 23,
      color: '#ffd9a0', visual: 'orb', icon: 'charm', cooldown: 0.64,
      damageMult: 0.72, shots: 1, spread: 0, speed: 460, radius: 6,
      life: 1.8, homing: 3.4, trail: true, slow: [0.6, 1.1],
      desc: '一盏纸灯慢慢跟着敌人，灯灭时人也慢了。'
    }
  };

  // 武器提供“基础输出来源”：伤害是绝对值，冷却决定攻速。
  // 角色面板只负责技能与生存，局内不再刷伤害/攻速/冷却等基础属性。
  const BASE_DAMAGE = {
    flintlock: 24, ironbolt: 16, twin: 15, sling: 11, pinecone: 30,
    bees: 8, spear: 22, frostbow: 20, flowerstaff: 11, thunder: 26,
    inkmaw: 7, boneflute: 10, sunrepeater: 9, echo: 17, shears: 19,
    ninegun: 17, reaper: 44, towerbomb: 48, peachwand: 9, lantern: 16
  };
  for (const id of Object.keys(DEFS)) {
    const d = DEFS[id];
    if (!d.damage) d.damage = BASE_DAMAGE[id] || 12;
    if (!d.range) d.range = d.icon === 'blade' ? 220 : 560;
  }

  // ── 庭主专属武器：只在对应庭主死亡时掉落，不进入商店随机池 ──
  const BOSS_DEFS = {
    truffle: {
      id: 'truffle', name: '松露菌杖', rarity: 'epic', price: 0,
      color: '#d8b07a', visual: 'spike', icon: 'staff', cooldown: 0.7,
      damage: 34, range: 540, shots: 2, spread: 0.18, speed: 500, radius: 7,
      life: 1.5, explode: 56, explodeMult: 0.55, slow: [0.55, 1.5], ink: true,
      bossOnly: true, bossId: 'truffle',
      desc: '松露君的菌伞杖。每一发都在地上种一小片毒雾。'
    },
    sunstar: {
      id: 'sunstar', name: '环日星盘', rarity: 'epic', price: 0,
      color: '#ffd36b', visual: 'orb', icon: 'orb', cooldown: 0.48,
      damage: 26, range: 600, shots: 3, spread: 0.26, speed: 640, radius: 5,
      life: 1.5, burn: [2.0, 4], glow: true, trail: true,
      bossOnly: true, bossId: 'sunstar',
      desc: '三枚小日轮绕着手腕转。命中后留下灼痕。'
    },
    ninesun: {
      id: 'ninesun', name: '九阳神铳', rarity: 'epic', price: 0,
      color: '#ff8a4c', visual: 'orb', icon: 'gun', cooldown: 0.44,
      damage: 27, range: 600, shots: 2, spread: 0.12, speed: 700, radius: 6,
      life: 1.5, burn: [2.2, 6], glow: true,
      bossOnly: true, bossId: 'ninesun',
      desc: '九阳神君的佩铳。枪口还留着第九个太阳的温度。'
    },
    peach: {
      id: 'peach', name: '桃柱花杖', rarity: 'epic', price: 0,
      color: '#ffb7c8', visual: 'petal', icon: 'staff', cooldown: 0.34,
      damage: 17, range: 560, shots: 4, spread: 0.36, speed: 570, radius: 4,
      life: 1.6, homing: 2.0, trail: true,
      bossOnly: true, bossId: 'peach',
      desc: '桃柱的一截花枝。四片花瓣会自己找人。'
    },
    oga: {
      id: 'oga', name: '尾刚名刀', rarity: 'epic', price: 0,
      color: '#aab6ff', visual: 'needle', icon: 'blade', cooldown: 0.52,
      damage: 48, range: 260, shots: 1, spread: 0, speed: 760, radius: 6,
      life: 1.3, pierce: 3, bounce: 1, knockback: 80,
      bossOnly: true, bossId: 'oga',
      desc: '尾刚一郎的居合刀。刀气比人先到。'
    },
    june: {
      id: 'june', name: '六月云伞', rarity: 'epic', price: 0,
      color: '#b7d9ff', visual: 'needle', icon: 'charm', cooldown: 0.4,
      damage: 19, range: 560, shots: 3, spread: 0.3, speed: 560, radius: 5,
      life: 1.6, slow: [0.55, 1.4], trail: true,
      bossOnly: true, bossId: 'june',
      desc: '六月云之末的伞骨。雨点会追上逃跑的人。'
    },
    tower: {
      id: 'tower', name: '伦敦钟锤', rarity: 'epic', price: 0,
      color: '#ffd36b', visual: 'orb', icon: 'bomb', cooldown: 0.9,
      damage: 56, range: 560, shots: 1, spread: 0, speed: 340, radius: 11,
      life: 1.4, explode: 96, explodeMult: 0.85, knockback: 110,
      bossOnly: true, bossId: 'tower',
      desc: '伦敦塔的钟摆锤。砸下去时，整层楼都会响。'
    },
    bigmon: {
      id: 'bigmon', name: '大大怪骨棒', rarity: 'epic', price: 0,
      color: '#8ef0c8', visual: 'bone', icon: 'blade', cooldown: 0.78,
      damage: 62, range: 250, shots: 1, spread: 0, speed: 620, radius: 9,
      life: 1.2, pierce: 2, knockback: 130,
      bossOnly: true, bossId: 'bigmon',
      desc: '大大怪随手掰下来的骨头。重量就是道理。'
    },
    edo: {
      id: 'edo', name: '江户十二口扇', rarity: 'epic', price: 0,
      color: '#c084fc', visual: 'petal', icon: 'charm', cooldown: 0.28,
      damage: 15, range: 580, shots: 6, spread: 0.68, speed: 620, radius: 4,
      life: 1.4, homing: 1.6, trail: true,
      bossOnly: true, bossId: 'edo',
      desc: '十二张嘴同时吹气。六片扇羽各自追人。'
    }
  };
  Object.assign(DEFS, BOSS_DEFS);

  // 空手：丢下武器后的保底状态，不出现在商店/掉落池。
  DEFS.fists = {
    id: 'fists', name: '空手', rarity: 'common', price: 0,
    color: '#d8cbb0', visual: 'needle', icon: 'blade', cooldown: 0.45,
    damage: 8, range: 130, shots: 1, spread: 0, speed: 420, radius: 3,
    life: 0.7, hidden: true,
    desc: '没有兵刃，只能挥拳。'
  };

  const LIST = Object.keys(DEFS).filter((id) => !DEFS[id].bossOnly && !DEFS[id].hidden);
  const BOSS_WEAPONS = {};
  for (const id of Object.keys(BOSS_DEFS)) BOSS_WEAPONS[BOSS_DEFS[id].bossId] = id;

  function roll(rng) {
    return typeof rng === 'function' ? rng() : Math.random();
  }

  /** 按楼层抽取一把随机武器（boss 掉落 / 商店补货）。 */
  function randomForFloor(floor, rng) {
    const f = Math.max(1, floor || 1);
    const rollv = roll(rng);
    let rarity;
    if (f <= 1) rarity = rollv < 0.7 ? 'common' : 'rare';
    else if (f === 2) rarity = rollv < 0.22 ? 'common' : rollv < 0.78 ? 'rare' : 'epic';
    else rarity = rollv < 0.4 ? 'rare' : 'epic';

    let pool = LIST.filter((id) => DEFS[id].rarity === rarity);
    if (!pool.length) pool = LIST;
    return pool[Math.floor(roll(rng) * pool.length)];
  }

  /** 商店三件不同货。 */
  function randomOffers(floor, count) {
    const n = count || 3;
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 80) {
      const id = randomForFloor(floor);
      if (!out.includes(id)) out.push(id);
    }
    return out;
  }

  /** 价格随层数轻微上浮。 */
  function priceFor(id, floor) {
    const def = DEFS[id];
    if (!def) return 999;
    return Math.round(def.price * (1 + Math.max(0, (floor || 1) - 1) * 0.12));
  }

  /** 商店 / HUD 用的小像素武器图标。 */
  function drawIcon(ctx, x, y, scale, defOrId, time) {
    const d = typeof defOrId === 'string' ? DEFS[defOrId] : defOrId;
    if (!d) return;
    const s = scale || 1;
    const t = time || 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;
    const c = d.color || '#e8c170';

    // 底座阴影
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#050409';
    ctx.fillRect(-10, 8, 20, 3);
    ctx.globalAlpha = 1;

    const kind = d.icon || 'gun';
    if (kind === 'gun') {
      ctx.fillStyle = '#3a2c2c';
      ctx.fillRect(-9, -3, 15, 6);
      ctx.fillStyle = c;
      ctx.fillRect(-11, -5, 7, 4);
      ctx.fillRect(4, -2, 8, 3);
      ctx.fillStyle = '#f5e6c8';
      ctx.fillRect(-12, -5, 3, 2);
      ctx.fillRect(9, -2, 4, 2);
    } else if (kind === 'bow') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#efe0c4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3, -8);
      ctx.lineTo(3, 8);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(-7, -1, 14, 2);
    } else if (kind === 'staff') {
      ctx.strokeStyle = '#6b5260';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 9);
      ctx.lineTo(5, -8);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(2, -12, 7, 7);
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(4, -10, 3, 3);
    } else if (kind === 'bomb') {
      ctx.fillStyle = '#2b2434';
      ctx.beginPath();
      ctx.arc(0, 2, 8, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(-7, -1, 14, 4);
      ctx.strokeStyle = '#e8c170';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.quadraticCurveTo(9, -10, 6, -13);
      ctx.stroke();
      ctx.fillStyle = '#ffb35c';
      ctx.fillRect(5, -14, 4, 4);
    } else if (kind === 'blade') {
      ctx.fillStyle = '#3a2c2c';
      ctx.fillRect(-11, 3, 5, 4);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-8, 1);
      ctx.lineTo(10, -9);
      ctx.lineTo(12, -5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(8, -9, 3, 2);
    } else if (kind === 'charm') {
      ctx.fillStyle = '#efe0c4';
      ctx.fillRect(-6, -9, 12, 18);
      ctx.fillStyle = c;
      ctx.fillRect(-4, -7, 8, 3);
      ctx.fillRect(-4, -2, 8, 2);
      ctx.fillRect(-4, 2, 8, 2);
      ctx.fillStyle = '#c94e5c';
      ctx.fillRect(-2, 5, 4, 2);
    } else if (kind === 'needle') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-9, i * 4);
        ctx.lineTo(8, i * 4 - 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(7, -6, 3, 2);
    } else if (kind === 'sling') {
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -8);
      ctx.lineTo(0, 4);
      ctx.lineTo(7, -8);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(-2, -2, 5, 5);
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(-2, -3, 3, 3);
      ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.15;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, U.TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 手持武器建模：以角色手部为原点，朝 aimAngle 方向绘制。
   * 每种 icon 都有自己的枪管/弓臂/刀身轮廓，不再是角色贴图上的一个色块。
   */
  function drawHeld(ctx, defOrId, x, y, angle, scale, opts = {}) {
    const d = typeof defOrId === 'string' ? DEFS[defOrId] : defOrId;
    if (!d) return;
    const s = scale || 1.7;
    const c = d.color || '#e8c170';

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    // 朝左瞄准时把武器翻正，避免整把枪倒过来。
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    if (opts.recoil) ctx.translate(-opts.recoil * 3, 0);
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;

    // 握把
    ctx.fillStyle = '#2a1e25';
    ctx.fillRect(-5, -2, 7, 4);
    ctx.fillStyle = '#8d6d50';
    ctx.fillRect(-4, -2, 2, 4);

    const kind = d.icon || 'gun';
    if (kind === 'gun') {
      ctx.fillStyle = '#43303a';
      ctx.fillRect(1, -2, 12, 4);
      ctx.fillStyle = c;
      ctx.fillRect(6, -3, 8, 5);
      ctx.fillStyle = '#fff1cc';
      ctx.fillRect(13, -2, 2, 3);
      ctx.fillStyle = '#6d5261';
      ctx.fillRect(3, 2, 3, 4);
    } else if (kind === 'bow') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(5, 0, 8, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = '#efe0c4';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(9, -7);
      ctx.lineTo(9, 7);
      ctx.stroke();
    } else if (kind === 'staff') {
      ctx.strokeStyle = '#745b46';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.lineTo(12, -4);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(13, -5, 4, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(12, -7, 2, 2);
    } else if (kind === 'blade') {
      ctx.fillStyle = '#3a2c2c';
      ctx.fillRect(-2, -2, 5, 4);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(3, 2);
      ctx.lineTo(18, -4);
      ctx.lineTo(20, -1);
      ctx.lineTo(5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(16, -3, 3, 1);
    } else if (kind === 'bomb') {
      ctx.fillStyle = '#2b2434';
      ctx.beginPath();
      ctx.arc(9, 0, 5, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(4, -2, 10, 3);
      ctx.strokeStyle = '#e8c170';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.quadraticCurveTo(16, -8, 14, -10);
      ctx.stroke();
    } else if (kind === 'charm') {
      ctx.fillStyle = '#efe0c4';
      ctx.fillRect(7, -7, 8, 14);
      ctx.fillStyle = c;
      ctx.fillRect(9, -5, 4, 2);
      ctx.fillRect(9, -1, 4, 2);
      ctx.fillRect(9, 3, 4, 1);
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -4);
      ctx.stroke();
    } else if (kind === 'needle') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(1, i * 2);
        ctx.lineTo(16, i * 3 - 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(15, -4, 2, 2);
    } else if (kind === 'sling') {
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(1, -5);
      ctx.lineTo(8, 0);
      ctx.lineTo(1, 5);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(7, -2, 4, 4);
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(8, 0, 5, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6e7';
      ctx.fillRect(7, -1, 2, 2);
    }

    // 枪口/法杖前端的火光
    if (opts.flash > 0) {
      ctx.globalAlpha = U.clamp(opts.flash / 0.08, 0, 1);
      const fx = kind === 'staff' || kind === 'charm' || kind === 'orb' ? 14 : 17;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.moveTo(fx + 5, 0);
      ctx.lineTo(fx, -4);
      ctx.lineTo(fx + 1, 0);
      ctx.lineTo(fx, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = d.color;
      ctx.fillRect(fx - 1, -1, 3, 2);
    }
    ctx.restore();
  }

  Ink.Rarity = RARITY;
  Ink.WeaponDefs = DEFS;
  Ink.WeaponList = LIST;
  Ink.BossWeapons = BOSS_WEAPONS;
  Ink.Weapons = {
    defs: DEFS,
    list: LIST,
    bossWeapons: BOSS_WEAPONS,
    rarity: RARITY,
    randomForFloor,
    randomOffers,
    priceFor,
    drawIcon,
    drawHeld,
    bossFor(bossId) { return DEFS[BOSS_WEAPONS[bossId]] || null; },
    get(id) { return DEFS[id] || null; }
  };
})();
