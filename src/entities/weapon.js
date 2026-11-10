/**
 * src/entities/weapon.js
 * ------------------------------------------------------------
 * 《庭中有奇树》兵器库 v3。
 *
 * 25 把“文房 / 雅乐 / 民俗”主题武器，每把都有：
 *   - 独立基础伤害、冷却、射程和弹道；
 *   - 独立的手持像素建模（drawHeld）；
 *   - 一个特殊节奏（special），由 player.js 的 weaponSpecial 解释。
 *
 * 另有 9 把庭主遗物，只在对应庭主被击败后掉落，数值与特效都高于普通兵器。
 * 这里只存数据，不直接改游戏状态，方便 fork 后继续加武器。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  const Rarity = {
    common: { id: 'common', name: '凡品', color: '#d8cbb0' },
    rare: { id: 'rare', name: '珍品', color: '#8fd6ff' },
    epic: { id: 'epic', name: '绝品', color: '#e8c170' },
    relic: { id: 'relic', name: '庭主遗物', color: '#ff9b7a' }
  };

  /**
   * 普通兵器。
   * special 只写语义，真正的效果在 player.weaponSpecial 内实现，
   * 这样新增武器时不必再改输入/冷却系统。
   */
  const DEFS = {
    chunqiu: {
      id: 'chunqiu', name: '春秋笔', rarity: 'rare', price: 24,
      color: '#d24b4b', shape: 'brush', icon: 'brush', cooldown: 0.38,
      damage: 19, range: 310, shots: 1, spread: 0, speed: 620, radius: 6,
      life: 1.1, knockback: 18, trail: true, special: 'combo3',
      melee: true, arc: 1.2, charged: true,
      desc: '近战三连挥笔，第三下甩出墨痕并给敌人上“诛”印；挥击会扫落弧形内的弹幕。'
    },
    judgebrush: {
      id: 'judgebrush', name: '判官笔', rarity: 'rare', price: 26,
      color: '#c9a45c', shape: 'judgebrush', icon: 'blade', cooldown: 0.34,
      damage: 15, range: 178, shots: 1, spread: 0, speed: 760, radius: 5,
      life: 0.6, pierce: 1, special: 'judge', melee: true, arc: 1.35,
      clearShots: true,
      desc: '近战短刺，命中叠“罪”并扫落弹幕；对残血敌人处决，未处决则返还部分冷却。'
    },
    ruler: {
      id: 'ruler', name: '戒尺', rarity: 'common', price: 16,
      color: '#c79a62', shape: 'ruler', icon: 'blade', cooldown: 0.46,
      damage: 24, range: 190, shots: 1, spread: 0, speed: 700, radius: 7,
      life: 0.55, knockback: 42, special: 'slam3', melee: true, arc: 1.45,
      clearShots: true, charged: true,
      desc: '近战横拍，第三下震地击退；挥击会扫落弹幕，慢而重的拍击伤害很高。'
    },
    gavel: {
      id: 'gavel', name: '惊堂木', rarity: 'rare', price: 22,
      color: '#a83232', shape: 'gavel', icon: 'bomb', cooldown: 0.62,
      damage: 22, range: 250, shots: 1, spread: 0, speed: 520, radius: 9,
      life: 0.8, explode: 58, explodeMult: 0.55, special: 'stunwave', melee: true,
      arc: 1.35, clearShots: true, charged: true,
      desc: '近战拍案，第四下放出震晕声波；挥击扫落弹幕，重击伤害高但出手慢。'
    },
    tishan: {
      id: 'tishan', name: '题扇', rarity: 'rare', price: 23,
      color: '#d8e3c2', shape: 'fan', icon: 'charm', cooldown: 0.4,
      damage: 13, range: 280, shots: 3, spread: 0.42, speed: 660, radius: 4,
      life: 0.9, pierce: 0, special: 'fan', melee: true, arc: 1.7, clearShots: true,
      desc: '近战开扇横扫并连发扇骨；扇面短暂格挡，第三下格挡并反弹墨点。'
    },
    umbrella: {
      id: 'umbrella', name: '雨巷伞', rarity: 'rare', price: 25,
      color: '#67b8a4', shape: 'umbrella', icon: 'charm', cooldown: 0.5,
      damage: 16, range: 220, shots: 2, spread: 0.3, speed: 560, radius: 6,
      life: 1.0, slow: [0.55, 1.4], special: 'rainfield', melee: true, arc: 1.9,
      clearShots: true,
      desc: '近战旋转伞骨并扫落弹幕；第四下撑伞，留下减速雨巷。'
    },
    bamboo: {
      id: 'bamboo', name: '韦编竹简', rarity: 'common', price: 18,
      color: '#c2a46d', shape: 'bamboo', icon: 'needle', cooldown: 0.34,
      damage: 12, range: 500, shots: 2, spread: 0.18, speed: 690, radius: 4,
      life: 1.0, pierce: 1, special: 'spread',
      desc: '连发竹片；技能或第四下会散开成扇形。'
    },
    type: {
      id: 'type', name: '活字方阵', rarity: 'rare', price: 28,
      color: '#6f7f8f', shape: 'type', icon: 'bomb', cooldown: 0.5,
      damage: 18, range: 440, shots: 1, spread: 0, speed: 540, radius: 7,
      life: 1.3, special: 'type',
      desc: '随机打出平/上/去/入四类字块：直飞、上抛、穿透、爆炸。'
    },
    guqin: {
      id: 'guqin', name: '广陵琴', rarity: 'epic', price: 34,
      color: '#b78a5c', shape: 'qin', icon: 'orb', cooldown: 0.4,
      damage: 14, range: 520, shots: 2, spread: 0.12, speed: 540, radius: 6,
      life: 1.4, pierce: 2, special: 'sound',
      desc: '拨弦发出穿透音波；每第四下双环回响。'
    },
    pipa: {
      id: 'pipa', name: '琵琶行', rarity: 'epic', price: 35,
      color: '#a7729c', shape: 'pipa', icon: 'bow', cooldown: 0.46,
      damage: 17, range: 520, shots: 1, spread: 0, speed: 600, radius: 5,
      life: 1.4, bounce: 3, special: 'bounce',
      desc: '音刃可弹墙两次；在窄道里能连续折返。'
    },
    flute: {
      id: 'flute', name: '梅花箫', rarity: 'rare', price: 24,
      color: '#8ec7b7', shape: 'flute', icon: 'needle', cooldown: 0.36,
      damage: 12, range: 560, shots: 1, spread: 0, speed: 760, radius: 3,
      life: 1.2, pierce: 4, special: 'pierce',
      desc: '吹出音针，直线穿透。每第三发依次绽放白、粉、红三色音波。'
    },
    abacus: {
      id: 'abacus', name: '算盘', rarity: 'rare', price: 26,
      color: '#a67c52', shape: 'abacus', icon: 'sling', cooldown: 0.3,
      damage: 10, range: 470, shots: 1, spread: 0, speed: 620, radius: 4,
      life: 1.6, bounce: 5, special: 'bounce',
      desc: '拨珠弹射，算珠会在墙面连续弹跳。'
    },
    seal: {
      id: 'seal', name: '朱印', rarity: 'epic', price: 38,
      color: '#c94e5c', shape: 'seal', icon: 'charm', cooldown: 0.82,
      damage: 28, range: 330, shots: 1, spread: 0, speed: 480, radius: 8,
      life: 0.9, explode: 66, explodeMult: 0.7, special: 'sealfield',
      desc: '盖印留下印文区域，踩中的敌人会被短暂封印。'
    },
    inkstone: {
      id: 'inkstone', name: '松烟砚', rarity: 'epic', price: 36,
      color: '#55606e', shape: 'inkstone', icon: 'bomb', cooldown: 0.75,
      damage: 24, range: 350, shots: 1, spread: 0, speed: 400, radius: 10,
      life: 1.1, slow: [0.45, 1.6], special: 'inkwave',
      desc: '研墨泼出墨浪，范围伤害并减速；每第四下墨浪更宽。'
    },
    inkstick: {
      id: 'inkstick', name: '徽墨', rarity: 'rare', price: 27,
      color: '#3f4552', shape: 'inkstick', icon: 'blade', cooldown: 0.58,
      damage: 30, range: 170, shots: 1, spread: 0, speed: 700, radius: 8,
      life: 0.55, special: 'spin', melee: true, arc: 2.4, clearShots: true,
      charged: true,
      desc: '近战旋转墨锭并扫落弹幕；第三下砸地留下黑印，黑印上的敌人受伤提升。'
    },
    scroll: {
      id: 'scroll', name: '长卷', rarity: 'epic', price: 40,
      color: '#e6dcc3', shape: 'scroll', icon: 'staff', cooldown: 0.78,
      damage: 32, range: 620, shots: 1, spread: 0, speed: 820, radius: 6,
      life: 1.3, pierce: 5, special: 'beam',
      desc: '展开纸卷，释放直线穿透“文脉”光柱。'
    },
    bell: {
      id: 'bell', name: '编钟', rarity: 'epic', price: 37,
      color: '#8fb09b', shape: 'bell', icon: 'bomb', cooldown: 0.8,
      damage: 26, range: 300, shots: 1, spread: 0, speed: 420, radius: 11,
      life: 1.0, explode: 74, explodeMult: 0.7, special: 'bellwave',
      desc: '敲钟震荡，眩晕并击退；每第四下双钟二次扩散。'
    },
    mirror: {
      id: 'mirror', name: '铜镜', rarity: 'epic', price: 36,
      color: '#9cc6a5', shape: 'mirror', icon: 'orb', cooldown: 0.62,
      damage: 22, range: 580, shots: 1, spread: 0, speed: 760, radius: 5,
      life: 1.4, pierce: 3, special: 'mirror',
      desc: '举镜反射弹幕并放出光柱；反射的弹幕伤害更高。'
    },
    compass: {
      id: 'compass', name: '司南', rarity: 'rare', price: 25,
      color: '#c49a62', shape: 'compass', icon: 'orb', cooldown: 0.44,
      damage: 13, range: 540, shots: 1, spread: 0, speed: 620, radius: 5,
      life: 1.3, homing: 2.1, special: 'markstrong',
      desc: '磁针标记最强敌人；攻击被标记目标时伤害提升。'
    },
    dice: {
      id: 'dice', name: '六艺骰', rarity: 'epic', price: 39,
      color: '#e8dfca', shape: 'dice', icon: 'bomb', cooldown: 0.55,
      damage: 16, range: 420, shots: 1, spread: 0, speed: 520, radius: 7,
      life: 1.2, special: 'dice',
      desc: '掷出骰子：礼回甲、乐音波、射穿箭、御加速、书字块、数爆炸。'
    },
    coin: {
      id: 'coin', name: '孔方镖', rarity: 'common', price: 15,
      color: '#c9a45c', shape: 'coin', icon: 'sling', cooldown: 0.24,
      damage: 8, range: 470, shots: 1, spread: 0, speed: 720, radius: 4,
      life: 1.2, bounce: 4, special: 'coin',
      desc: '连发铜钱镖，低耗能；每第五下撒钱成阵，敌人减速并掉金币。'
    },
    lantern: {
      id: 'lantern', name: '走马灯', rarity: 'rare', price: 26,
      color: '#d9584f', shape: 'lantern', icon: 'charm', cooldown: 0.6,
      damage: 14, range: 360, shots: 1, spread: 0, speed: 400, radius: 9,
      life: 1.2, burn: [2.0, 4], special: 'lanternfield',
      desc: '放出灯影，持续灼烧并照亮周围；第四下旋转火焰轮。'
    },
    kite: {
      id: 'kite', name: '纸鸢', rarity: 'epic', price: 35,
      color: '#d9a35c', shape: 'kite', icon: 'charm', cooldown: 0.68,
      damage: 20, range: 540, shots: 1, spread: 0, speed: 420, radius: 8,
      life: 1.8, homing: 4.2, explode: 62, explodeMult: 0.7, special: 'kite',
      desc: '纸鸢自动追踪，撞击爆炸；每第四下断线分裂为三只小纸鸢。'
    },
    puppet: {
      id: 'puppet', name: '皮影', rarity: 'epic', price: 36,
      color: '#c79a62', shape: 'puppet', icon: 'charm', cooldown: 0.64,
      damage: 17, range: 440, shots: 1, spread: 0, speed: 560, radius: 6,
      life: 1.4, special: 'puppet',
      desc: '召唤皮影人偶协同攻击；每第五下切换生旦净丑，放出不同招式。'
    },
    mask: {
      id: 'mask', name: '傩面', rarity: 'epic', price: 42,
      color: '#b54b45', shape: 'mask', icon: 'blade', cooldown: 0.62,
      damage: 26, range: 160, shots: 1, spread: 0, speed: 760, radius: 8,
      life: 0.6, pierce: 2, special: 'mask', melee: true, arc: 1.6, clearShots: true,
      desc: '近战爪击并扫落弹幕；第五下戴面具变身 8 秒，免疫减速，击杀延长变身。'
    },
    bamboo_saber: {
      id: 'bamboo_saber', name: '竹节刀', rarity: 'rare', price: 28,
      color: '#9ed08a', shape: 'blade', icon: 'blade', cooldown: 0.48,
      damage: 24, range: 150, shots: 1, spread: 0, speed: 760, radius: 6, life: 0.5,
      knockback: 64, melee: true, arc: 1.25, clearShots: true, special: 'slam3',
      desc: '竹节削成的短刀。近战横斩并扫落弹幕，第三下震地击退周围敌人。'
    },
    paper_hammer: {
      id: 'paper_hammer', name: '镇纸锤', rarity: 'epic', price: 42,
      color: '#c8a46b', shape: 'hammer', icon: 'bomb', cooldown: 1.05, chargeTime: 1.1,
      damage: 46, range: 160, shots: 1, spread: 0, speed: 680, radius: 10, life: 0.6,
      knockback: 120, melee: true, arc: 1.9, clearShots: true, charged: true,
      chargeAuto: false, chargeSlow: 0.42,
      desc: '黄铜镇纸改成的重锤。按住蓄力，松手砸出高额扇形伤害并扫落弹幕；蓄力时移速降低。'
    },
    siege_bow: {
      id: 'siege_bow', name: '破城弓', rarity: 'epic', price: 46,
      color: '#d6b06a', shape: 'bow', icon: 'bow', cooldown: 0.9, chargeTime: 1.1,
      damage: 58, range: 640, shots: 1, spread: 0, speed: 920, radius: 7, life: 1.3,
      pierce: 6, knockback: 60, trail: true, charged: true,
      chargeAuto: false, chargeChain: true, chargeSlow: 0.5,
      chargePerfect: [0.55, 0.72], chargePerfectMult: 2.6,
      desc: '守城旧弓。按住蓄力，松手发射；在金色完美区间释放可穿透整条走廊并造成 2.6 倍伤害，蓄力时移速降低。'
    },
    thunder_spear: {
      id: 'thunder_spear', name: '雷引长枪', rarity: 'epic', price: 44,
      color: '#9fd8ff', shape: 'staff', icon: 'staff', cooldown: 1.0, chargeTime: 1.25,
      damage: 70, range: 620, shots: 1, spread: 0, speed: 780, radius: 8, life: 1.5,
      pierce: 5, knockback: 80, trail: true, charged: true, chargeAuto: false,
      chargeSlow: 0.55, chargePerfect: [0.66, 0.84], chargePerfectMult: 2.4,
      desc: '长枪引雷。按住蓄力，在蓝白完美区间松手，枪身带电贯穿一线敌人；蓄力时移速降低。'
    },
    cloud_bow: {
      id: 'cloud_bow', name: '云纹重弓', rarity: 'rare', price: 34,
      color: '#b7d9ff', shape: 'bow', icon: 'bow', cooldown: 1.0, chargeTime: 0.9,
      damage: 40, range: 600, shots: 1, spread: 0, speed: 780, radius: 6, life: 1.4,
      homing: 1.2, knockback: 30, trail: true, charged: true, chargeAuto: true,
      chargeSlow: 0.65, desc: '云纹旧弓。按住蓄力，满蓄自动放出一支追踪云箭；适合边退边打。'
    },
    ink_halberd: {
      id: 'ink_halberd', name: '墨龙戟', rarity: 'epic', price: 48,
      color: '#7f8cff', shape: 'blade', icon: 'blade', cooldown: 1.15, chargeTime: 1.0,
      damage: 64, range: 205, shots: 1, spread: 0, speed: 760, radius: 9, life: 0.62,
      knockback: 110, melee: true, arc: 2.1, clearShots: true, charged: true,
      chargeAuto: false, chargeSlow: 0.48, chargePerfect: [0.62, 0.8], chargePerfectMult: 2.2,
      desc: '长柄墨戟。按住蓄力，松手横扫大扇形，扫落弹幕并击退；完美区间伤害更高。'
    },
    bell_hammer: {
      id: 'bell_hammer', name: '惊夜钟槌', rarity: 'rare', price: 30,
      color: '#d8b87a', shape: 'hammer', icon: 'bomb', cooldown: 1.2, chargeTime: 1.05,
      damage: 44, range: 175, shots: 1, spread: 0, speed: 680, radius: 10, life: 0.6,
      knockback: 130, melee: true, arc: 1.95, clearShots: true, charged: true,
      chargeAuto: true, chargeSlow: 0.45,
      desc: '钟楼旧槌。满蓄自动砸地，震退周围敌人并扫落弹幕；蓄力时移速明显降低。'
    },
    golden_altar: {
      id: 'golden_altar', name: '黄金台', rarity: 'epic', price: 56,
      color: '#ffd36b', shape: 'staff', icon: 'staff', cooldown: 0.8,
      damage: 8, range: 280, shots: 1, spread: 0, speed: 520, radius: 6, life: 0.8,
      special: 'golden', glow: true,
      desc: '一座袖珍黄金台。场上只剩一种怪物时，按 R 吟唱收服一只为宠物；宠物会自行作战。失去黄金台，所有宠物散去。'
    }
  };

  // ── 庭主遗物：在原有 9 把的基础上强化约 50%，并保留各自的专属视觉 ──
  const BOSS_DEFS = {
    truffle: {
      id: 'truffle', name: '松露菌杖', rarity: 'relic', price: 0,
      color: '#d8b07a', shape: 'staff', icon: 'staff', cooldown: 0.54,
      damage: 52, range: 580, shots: 2, spread: 0.18, speed: 540, radius: 8,
      life: 1.6, explode: 74, explodeMult: 0.65, slow: [0.5, 1.8], ink: true,
      bossOnly: true, bossId: 'truffle', special: 'bossTruffle',
      desc: '松露菌的菌伞杖。每发都在地上种一小片毒雾，并留下墨印。'
    },
    sunstar: {
      id: 'sunstar', name: '环日星盘', rarity: 'relic', price: 0,
      color: '#ffd36b', shape: 'orb', icon: 'orb', cooldown: 0.36,
      damage: 40, range: 620, shots: 3, spread: 0.26, speed: 680, radius: 5,
      life: 1.6, burn: [2.4, 6], glow: true, trail: true,
      bossOnly: true, bossId: 'sunstar', special: 'bossSun',
      desc: '三枚小日轮绕腕旋转。灼痕会持续更久。'
    },
    ninesun: {
      id: 'ninesun', name: '九阳神铳', rarity: 'relic', price: 0,
      color: '#ff8a4c', shape: 'gun', icon: 'gun', cooldown: 0.32,
      damage: 42, range: 620, shots: 2, spread: 0.12, speed: 760, radius: 6,
      life: 1.6, burn: [2.6, 8], glow: true,
      bossOnly: true, bossId: 'ninesun', special: 'bossNine',
      desc: '九阳神君的佩铳。枪口还留着第九个太阳的温度。'
    },
    peach: {
      id: 'peach', name: '桃柱花杖', rarity: 'relic', price: 0,
      color: '#ffb7c8', shape: 'staff', icon: 'staff', cooldown: 0.26,
      damage: 28, range: 580, shots: 4, spread: 0.36, speed: 600, radius: 4,
      life: 1.7, homing: 2.4, trail: true,
      bossOnly: true, bossId: 'peach', special: 'bossPeach',
      desc: '桃柱的一截花枝。四片花瓣会自己找人。'
    },
    oga: {
      id: 'oga', name: '尾刚名刀', rarity: 'relic', price: 0,
      color: '#aab6ff', shape: 'blade', icon: 'blade', cooldown: 0.4,
      damage: 72, range: 280, shots: 1, spread: 0, speed: 820, radius: 6,
      life: 1.4, pierce: 4, bounce: 2, knockback: 90,
      bossOnly: true, bossId: 'oga', special: 'bossOga',
      desc: '尾刚一郎的居合刀。刀气比人先到，命中后还会折回。'
    },
    june: {
      id: 'june', name: '六月云伞', rarity: 'relic', price: 0,
      color: '#b7d9ff', shape: 'umbrella', icon: 'charm', cooldown: 0.3,
      damage: 30, range: 580, shots: 3, spread: 0.3, speed: 590, radius: 5,
      life: 1.7, slow: [0.5, 1.7], trail: true,
      bossOnly: true, bossId: 'june', special: 'bossJune',
      desc: '六月云之末的伞骨。雨点会追上逃跑的人。'
    },
    tower: {
      id: 'tower', name: '伦敦钟锤', rarity: 'relic', price: 0,
      color: '#ffd36b', shape: 'hammer', icon: 'bomb', cooldown: 0.72,
      damage: 84, range: 580, shots: 1, spread: 0, speed: 360, radius: 12,
      life: 1.5, explode: 120, explodeMult: 0.95, knockback: 130,
      bossOnly: true, bossId: 'tower', special: 'bossTower',
      desc: '伦敦塔的钟摆锤。砸下去时，整层楼都会响。'
    },
    bigmon: {
      id: 'bigmon', name: '大大怪骨棒', rarity: 'relic', price: 0,
      color: '#8ef0c8', shape: 'club', icon: 'blade', cooldown: 0.62,
      damage: 94, range: 270, shots: 1, spread: 0, speed: 660, radius: 10,
      life: 1.3, pierce: 3, knockback: 160,
      bossOnly: true, bossId: 'bigmon', special: 'bossBig',
      desc: '大大怪随手掰下来的骨头。重量就是道理。'
    },
    edo: {
      id: 'edo', name: '江户十二口扇', rarity: 'relic', price: 0,
      color: '#c084fc', shape: 'fan', icon: 'charm', cooldown: 0.2,
      damage: 24, range: 600, shots: 6, spread: 0.68, speed: 650, radius: 4,
      life: 1.5, homing: 1.8, trail: true,
      bossOnly: true, bossId: 'edo', special: 'bossEdo',
      desc: '十二张嘴同时吹气。六片扇羽各自追人。'
    },
    buzz: {
      id: 'buzz', name: '格式红批', rarity: 'relic', price: 0,
      color: '#9ecf8a', shape: 'scroll', icon: 'scroll', cooldown: 0.46,
      damage: 34, range: 640, shots: 3, spread: 0.18, speed: 580, radius: 6,
      life: 1.7, slow: [0.65, 1.8], pierce: 2,
      bossOnly: true, bossId: 'buzz', special: 'bossBuzz',
      desc: '外庭客座的红批注。命中的敌人会被“格式错误”拖慢。'
    },
    liu: {
      id: 'liu', name: '铁砧诗锤', rarity: 'relic', price: 0,
      color: '#ff9a5c', shape: 'hammer', icon: 'bomb', cooldown: 0.6,
      damage: 96, range: 240, shots: 1, spread: 0, speed: 680, radius: 11,
      life: 1.2, knockback: 170, explode: 100, explodeMult: 0.7,
      bossOnly: true, bossId: 'liu', special: 'bossLiu',
      desc: '柳铁柱的铁锤。每一击都带着铁砧的回声。'
    },
    yuenu: {
      id: 'yuenu', name: '铜鼓玉璧', rarity: 'relic', price: 0,
      color: '#6be0d2', shape: 'orb', icon: 'orb', cooldown: 0.34,
      damage: 32, range: 620, shots: 4, spread: 0.42, speed: 620, radius: 5,
      life: 1.7, slow: [0.55, 1.6], homing: 2.0,
      bossOnly: true, bossId: 'yuenu', special: 'bossYuenu',
      desc: '百越玉女的铜鼓与残璧。鼓声追人，玉光减速。'
    },
    creator: {
      id: 'creator', name: '创世朱笔', rarity: 'relic', price: 0,
      color: '#e8c170', shape: 'brush', icon: 'brush', cooldown: 0.24,
      damage: 66, range: 700, shots: 3, spread: 0.16, speed: 760, radius: 7,
      life: 1.8, pierce: 4, ink: true, explode: 70, explodeMult: 0.5,
      bossOnly: true, bossId: 'creator', special: 'bossCreator',
      desc: '创世者的朱笔。它写下的字，会自己改成追你的形状。'
    }
  };

  // ── 角色专属初始兵刃：只随角色出生，不会进入商店/随机掉落 ──
  const STARTER_DEFS = {
    qi_staff: {
      id: 'qi_staff', name: '弈者笔', rarity: 'rare', price: 0, color: '#8fd6ff',
      shape: 'brush', icon: 'brush', cooldown: 0.42, damage: 21, range: 330,
      shots: 1, spread: 0, speed: 640, radius: 5, life: 1.2, pierce: 1,
      special: 'combo3', starterFor: 'qiyun', starterOnly: true, hidden: true,
      desc: '棋云的随身笔。第三下写出墨痕，留下一枚会引爆的“弈子”。'
    },
    shadow_blade: {
      id: 'shadow_blade', name: '无光刃', rarity: 'rare', price: 0, color: '#ff8fb3',
      shape: 'blade', icon: 'blade', cooldown: 0.28, damage: 17, range: 156,
      shots: 1, spread: 0, speed: 760, radius: 5, life: 0.5, melee: true, arc: 1.55,
      clearShots: true, starterFor: 'xiaoying', starterOnly: true, hidden: true,
      desc: '小影的短刃。挥击成弧，斩落范围内敌方弹幕；命中带标记的敌人伤害更高。'
    },
    heart_bell: {
      id: 'heart_bell', name: '听心铃', rarity: 'rare', price: 0, color: '#ffc2d4',
      shape: 'orb', icon: 'orb', cooldown: 0.5, damage: 14, range: 440,
      shots: 1, spread: 0, speed: 460, radius: 6, life: 1.5, homing: 2.4,
      starterFor: 'xinyue', starterOnly: true, hidden: true,
      desc: '心阅的听心铃。铃声会缓慢追向被标记的敌人，并为其叠加一层“洞察”。'
    },
    ink_prison: {
      id: 'ink_prison', name: '狱毫', rarity: 'rare', price: 0, color: '#e8c170',
      shape: 'judgebrush', icon: 'blade', cooldown: 0.46, damage: 18, range: 360,
      shots: 1, spread: 0, speed: 560, radius: 6, life: 1.3, pierce: 2, ink: true,
      starterFor: 'ziyu', starterOnly: true, hidden: true,
      desc: '字狱的判笔。每一笔都带墨印，命中会给敌人叠字印；第五层墨印短暂封步。'
    },
    dog_bone: {
      id: 'dog_bone', name: '唤犬骨哨', rarity: 'rare', price: 0, color: '#8ef0c8',
      shape: 'flute', icon: 'orb', cooldown: 0.38, damage: 11, range: 500,
      shots: 1, spread: 0, speed: 520, radius: 5, life: 1.4, homing: 1.8,
      starterFor: 'smartdog', starterOnly: true, hidden: true,
      desc: '御狶的骨哨。哨声会指引影犬扑向同一目标，并让犬群更愿意分散追击。'
    },
    burrow_claw: {
      id: 'burrow_claw', name: '穿地爪', rarity: 'rare', price: 0, color: '#d9a35c',
      shape: 'blade', icon: 'blade', cooldown: 0.34, damage: 19, range: 118,
      shots: 1, spread: 0, speed: 780, radius: 6, life: 0.5, melee: true, arc: 1.22,
      clearShots: true, starterFor: 'mouse', starterOnly: true, hidden: true,
      desc: '小牢鼠的掘地爪。挥击成弧并扫落弹幕；从地下钻出后的第一击伤害翻倍。'
    },
    autumn_umbrella: {
      id: 'autumn_umbrella', name: '秋霖伞', rarity: 'rare', price: 0, color: '#b7d9ff',
      shape: 'umbrella', icon: 'charm', cooldown: 0.46, damage: 16, range: 340,
      shots: 2, spread: 0.28, speed: 560, radius: 5, life: 1.1, slow: [0.6, 1.5],
      special: 'rainfield', starterFor: 'autumn', starterOnly: true, hidden: true,
      desc: '秋雨的旧伞。伞骨会洒出细雨，第三下撑伞留下一片减速雨阵；站在雨中额外回血。'
    },
    three_seal: {
      id: 'three_seal', name: '三瑞印', rarity: 'rare', price: 0, color: '#e8c170',
      shape: 'seal', icon: 'charm', cooldown: 0.56, damage: 15, range: 420,
      shots: 1, spread: 0, speed: 480, radius: 7, life: 1.3, explode: 42, explodeMult: 0.6,
      special: 'sealfield', starterFor: 'sanrui', starterOnly: true, hidden: true,
      desc: '三瑞的印。落印会短暂封住敌人；福、禄、寿三兽存活时，印记伤害更高。'
    }
  };
  Object.assign(DEFS, STARTER_DEFS);

  DEFS.fists = {
    id: 'fists', name: '空手', rarity: 'common', price: 0,
    color: '#d8cbb0', shape: 'fist', icon: 'blade', cooldown: 0.45,
    damage: 8, range: 130, shots: 1, spread: 0, speed: 420, radius: 3,
    life: 0.7, hidden: true, desc: '没有兵刃，只能挥拳。'
  };

  Object.assign(DEFS, BOSS_DEFS);
  const LIST = Object.keys(DEFS).filter((id) => !DEFS[id].bossOnly && !DEFS[id].hidden && !DEFS[id].starterOnly);
  const BOSS_WEAPONS = {};
  for (const id of Object.keys(BOSS_DEFS)) BOSS_WEAPONS[BOSS_DEFS[id].bossId] = id;
  // 角色 → 初始兵刃；初始兵刃不在 LIST 中，因此不会再次掉落或进货。
  const STARTING = {};
  for (const id of Object.keys(STARTER_DEFS)) {
    const d = STARTER_DEFS[id];
    if (d.starterFor) STARTING[d.starterFor] = id;
  }

  function roll(rng) {
    return typeof rng === 'function' ? rng() : Math.random();
  }

  function randomForFloor(floor, rng) {
    const f = Math.max(1, floor || 1);
    const rollv = roll(rng);
    let rarity;
    if (f <= 1) rarity = rollv < 0.66 ? 'common' : 'rare';
    else if (f <= 3) rarity = rollv < 0.25 ? 'common' : rollv < 0.78 ? 'rare' : 'epic';
    else if (f <= 6) rarity = rollv < 0.12 ? 'common' : rollv < 0.52 ? 'rare' : 'epic';
    else rarity = rollv < 0.3 ? 'rare' : 'epic';
    let pool = LIST.filter((id) => DEFS[id].rarity === rarity);
    if (!pool.length) pool = LIST;
    return pool[Math.floor(roll(rng) * pool.length)];
  }

  function randomOffers(floor, count) {
    const n = count || 3;
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 100) {
      const id = randomForFloor(floor);
      if (!out.includes(id)) out.push(id);
    }
    return out;
  }

  function priceFor(id, floor) {
    const def = DEFS[id];
    if (!def) return 999;
    return Math.round(def.price * (1 + Math.max(0, (floor || 1) - 1) * 0.1));
  }

  // ── 手持建模 ──────────────────────────────────────────────
  // 所有模型以“手”为 (0,0)，向 +x 伸出，约 16~26px 长；由 player.draw 旋转。
  function drawHeld(ctx, defOrId, x, y, angle, scale, opts) {
    const d = typeof defOrId === 'string' ? DEFS[defOrId] : defOrId;
    if (!d) return;
    const o = opts || {};
    const s = scale || 1.9;
    const c = d.color || '#e8c170';
    const shape = d.shape || 'gun';
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    if (o.recoil) ctx.translate(-o.recoil * 3, 0);
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;
    const px = (a, b, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(a, b, w, h); };

    // 通用握把，让所有兵器都像被“握住”。
    px(-5, -2, 7, 4, '#2a1e25');
    px(-4, -2, 2, 4, '#8d6d50');

    if (shape === 'brush') {
      px(-1, -1, 17, 2, '#201a20');
      px(16, -2, 5, 3, '#7a2b2b');
      px(20, -1, 4, 2, '#d24b4b');
      px(12, -1, 3, 2, '#c9a45c');
      if (o.flash) px(22, -2, 4, 4, '#ff9b7a');
    } else if (shape === 'judgebrush') {
      px(0, -1, 17, 3, '#18161d');
      px(8, -2, 4, 5, '#c9a45c');
      px(17, -2, 5, 4, '#5e1f28');
      px(21, -1, 2, 2, '#ff6b6b');
    } else if (shape === 'ruler') {
      px(0, -3, 20, 7, '#9a6b3c');
      px(1, -2, 18, 2, '#c79a62');
      px(1, 2, 18, 2, '#7a4f2a');
      px(0, -3, 3, 7, '#b58a4f');
      px(17, -3, 4, 7, '#b58a4f');
      px(7, -1, 7, 2, '#4a2e1e');
    } else if (shape === 'gavel') {
      px(-1, -1, 12, 2, '#5c3a2a');
      px(10, -5, 10, 10, '#8f2f2f');
      px(12, -3, 6, 3, '#c94e4e');
      px(10, -5, 10, 2, '#e8c170');
      px(10, 3, 10, 2, '#e8c170');
    } else if (shape === 'fan') {
      ctx.fillStyle = '#e9dfc2';
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.arc(3, 0, 17, -0.8, 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.lineTo(3 + Math.cos(i * 0.35) * 17, Math.sin(i * 0.35) * 17);
        ctx.stroke();
      }
      px(1, -1, 4, 2, '#8a6a4a');
    } else if (shape === 'umbrella') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(8, 0, 12, Math.PI, 0);
      ctx.stroke();
      px(7, 0, 2, 15, '#6b4f36');
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8 + i * 5, -10);
        ctx.stroke();
      }
    } else if (shape === 'bamboo') {
      px(0, -4, 17, 8, '#b08a55');
      for (let i = 0; i < 4; i++) {
        px(2 + i * 4, -3, 2, 6, '#d2b077');
        px(2 + i * 4, -4, 1, 8, '#6b4f36');
      }
      px(0, -4, 17, 2, '#7a5a36');
      px(0, 2, 17, 2, '#7a5a36');
    } else if (shape === 'type') {
      px(2, -5, 12, 10, '#4c525c');
      px(3, -4, 10, 8, '#6f7f8f');
      px(5, -2, 6, 4, '#231f26');
      px(7, -1, 2, 2, '#d8cbb0');
    } else if (shape === 'qin') {
      px(0, -5, 21, 10, '#7a5136');
      px(2, -4, 17, 8, '#b78a5c');
      for (let i = 0; i < 7; i++) px(2, -4 + i * 1.1, 17, 1, '#e8dfc2');
      px(0, -5, 21, 2, '#4a2e1e');
      px(18, -4, 3, 8, '#d2b077');
    } else if (shape === 'pipa') {
      ctx.fillStyle = '#a7729c';
      ctx.beginPath();
      ctx.ellipse(7, 1, 8, 10, 0, 0, U.TAU);
      ctx.fill();
      px(6, -11, 3, 13, '#5c3a2a');
      px(6, -13, 4, 3, '#c9a45c');
      for (let i = -2; i <= 2; i++) px(3, i * 2, 10, 1, '#e8dfc2');
    } else if (shape === 'flute') {
      px(0, -2, 21, 4, '#8ec7b7');
      for (let i = 0; i < 5; i++) px(5 + i * 3, -1, 2, 2, '#3e5c55');
      px(0, -2, 3, 4, '#5c8a7a');
      if (o.flash) px(22, -2, 4, 4, '#e8dfc2');
    } else if (shape === 'abacus') {
      px(0, -7, 18, 14, '#8a5f3c');
      px(2, -5, 14, 10, '#3a2a20');
      for (let r = 0; r < 3; r++) {
        px(2, -4 + r * 4, 14, 1, '#c9a45c');
        for (let i = 0; i < 3; i++) px(3 + i * 4, -4 + r * 4 - 1, 2, 3, '#1a161c');
      }
    } else if (shape === 'seal') {
      px(2, -6, 13, 12, '#b58a4f');
      px(4, -4, 9, 8, '#d8b07a');
      px(6, -2, 5, 4, '#8f2f2f');
      px(1, -8, 15, 3, '#8a6a4a');
    } else if (shape === 'inkstone') {
      ctx.fillStyle = '#4a5059';
      ctx.beginPath();
      ctx.ellipse(8, 0, 12, 8, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#171821';
      ctx.beginPath();
      ctx.ellipse(8, 0, 9, 5, 0, 0, U.TAU);
      ctx.fill();
      px(1, -7, 14, 2, '#7f8792');
    } else if (shape === 'inkstick') {
      px(0, -3, 18, 6, '#25232b');
      px(2, -2, 14, 2, '#4b4f5c');
      px(4, -2, 6, 2, '#c9a45c');
      px(15, -3, 4, 6, '#c94e4b');
    } else if (shape === 'scroll') {
      px(0, -5, 18, 10, '#e6dcc3');
      px(0, -5, 3, 10, '#8a6a4a');
      px(15, -5, 3, 10, '#8a6a4a');
      for (let i = 0; i < 3; i++) px(5, -3 + i * 3, 8, 1, '#5a4a3a');
    } else if (shape === 'bell') {
      ctx.fillStyle = '#7fa38b';
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.quadraticCurveTo(9, -13, 14, -6);
      ctx.lineTo(16, 7);
      ctx.lineTo(2, 7);
      ctx.closePath();
      ctx.fill();
      px(2, 6, 14, 3, '#4f6b5a');
      px(7, -9, 4, 3, '#c9a45c');
      px(5, -2, 10, 2, '#b7d9c2');
    } else if (shape === 'mirror') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(13, 0, 8, 0, U.TAU);
      ctx.stroke();
      px(12, -5, 2, 10, '#e8dfc2');
      px(12, -1, 8, 2, '#e8dfc2');
      px(1, -2, 7, 4, '#6b4f36');
    } else if (shape === 'compass') {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, 0, 9, 0, U.TAU);
      ctx.stroke();
      px(9, -7, 2, 14, '#c94e5c');
      px(9, -7, 2, 5, '#8fd6ff');
      px(1, -3, 4, 6, '#5c3a2a');
      px(5, -2, 5, 4, '#d8b07a');
    } else if (shape === 'dice') {
      px(2, -6, 12, 12, '#e8dfca');
      px(3, -5, 10, 10, '#fff6e7');
      const dots = [[5, -3], [10, -3], [5, 2], [10, 2], [7, -1]];
      for (const p of dots) px(p[0], p[1], 2, 2, '#b54b45');
    } else if (shape === 'coin') {
      ctx.strokeStyle = '#c9a45c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, 0, 8, 0, U.TAU);
      ctx.stroke();
      px(8, -3, 4, 6, '#6b4f36');
      px(9, -2, 2, 4, '#e8dfc2');
    } else if (shape === 'lantern') {
      ctx.fillStyle = '#c94e4b';
      ctx.beginPath();
      ctx.ellipse(8, 0, 8, 10, 0, 0, U.TAU);
      ctx.fill();
      px(7, -12, 3, 3, '#c9a45c');
      px(7, 9, 3, 3, '#c9a45c');
      px(3, -1, 11, 2, 'rgba(255,220,140,.65)');
      px(0, -1, 2, 2, '#8a5f3c');
    } else if (shape === 'kite') {
      ctx.fillStyle = '#d9a35c';
      ctx.beginPath();
      ctx.moveTo(4, 0); ctx.lineTo(13, -10); ctx.lineTo(22, 0); ctx.lineTo(13, 10);
      ctx.closePath(); ctx.fill();
      px(12, -1, 2, 8, '#5c3a2a');
      ctx.strokeStyle = 'rgba(240,230,210,.7)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(13, 0); ctx.stroke();
      px(4, -2, 3, 3, '#b54b45');
    } else if (shape === 'puppet') {
      ctx.globalAlpha = 0.78;
      px(7, -10, 4, 6, '#c79a62');
      px(5, -4, 8, 9, '#8f2f2f');
      px(3, -2, 3, 6, '#c79a62');
      px(12, -2, 3, 6, '#c79a62');
      px(6, 5, 2, 7, '#c79a62');
      px(10, 5, 2, 7, '#c79a62');
      px(7, -12, 4, 2, '#2a1e25');
      ctx.globalAlpha = 1;
    } else if (shape === 'mask') {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(4, -6); ctx.lineTo(15, -8); ctx.lineTo(20, 0);
      ctx.lineTo(15, 9); ctx.lineTo(5, 7); ctx.lineTo(2, 0);
      ctx.closePath(); ctx.fill();
      px(6, -3, 3, 3, '#1a161c');
      px(13, -3, 3, 3, '#1a161c');
      px(7, 3, 8, 2, '#1a161c');
      px(4, -8, 2, 4, '#e8dfc2');
      px(16, -9, 2, 5, '#e8dfc2');
    } else if (shape === 'hammer') {
      px(0, -1, 16, 3, '#5c3a2a');
      px(14, -8, 8, 16, '#8f6c3c');
      px(14, -8, 8, 3, '#e8c170');
      px(14, 5, 8, 3, '#e8c170');
    } else if (shape === 'club') {
      px(0, -1, 18, 4, '#6b4f36');
      ctx.fillStyle = '#d8cbb0';
      ctx.beginPath();
      ctx.arc(18, 0, 7, 0, U.TAU);
      ctx.fill();
      px(15, -5, 3, 3, '#8ef0c8');
    } else if (shape === 'staff') {
      ctx.strokeStyle = '#745b46';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(17, -4); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(18, -5, 4.5, 0, U.TAU); ctx.fill();
      px(17, -7, 2, 2, '#fff6e7');
    } else if (shape === 'gun') {
      px(1, -2, 15, 4, '#43303a');
      px(7, -3, 9, 5, c);
      px(16, -2, 3, 3, '#fff1cc');
    } else if (shape === 'bow') {
      // 破城弓：弯曲弓臂 + 弦与搭箭，蓄力时弦会被拉满。
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(7, 0, 14, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = '#e8dfc2';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, -12);
      ctx.lineTo(9, 0);
      ctx.lineTo(12, 12);
      ctx.stroke();
      px(7, -1, 20, 2, '#d8cbb0');
      px(23, -3, 4, 6, c);
    } else if (shape === 'blade') {
      px(0, -2, 7, 5, '#3a2c2c');
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(5, 3); ctx.lineTo(21, -5); ctx.lineTo(23, -1); ctx.lineTo(7, 5);
      ctx.closePath(); ctx.fill();
      px(20, -4, 3, 1, '#fff6e7');
    } else if (shape === 'orb') {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(14, 0, 6, 0, U.TAU); ctx.fill();
      px(12, -2, 3, 3, '#fff6e7');
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(14, 0, 9, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      px(0, -2, 16, 4, '#5c3a2a');
      px(15, -3, 6, 6, c);
    }

    if (o.flash) {
      ctx.fillStyle = 'rgba(255,238,180,.9)';
      ctx.fillRect(23, -3, 4, 6);
      ctx.fillStyle = 'rgba(255,180,90,.55)';
      ctx.fillRect(25, -5, 3, 3);
    }
    ctx.restore();
  }

  function drawIcon(ctx, cx, cy, scale, defOrId, time) {
    const d = typeof defOrId === 'string' ? DEFS[defOrId] : defOrId;
    if (!d) return;
    const s = scale || 1;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#050409';
    ctx.beginPath();
    ctx.ellipse(0, 10 * s, 10 * s, 3 * s, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawHeld(ctx, d, 0, 0, -0.55, s * 0.82, { flash: false });
    ctx.restore();
  }

  /** 兼容旧调用。 */
  function get(id) { return DEFS[id] || null; }
  function bossFor(bossId) { return BOSS_WEAPONS[bossId] || null; }

  Ink.Rarity = Rarity;
  Ink.WeaponDefs = DEFS;
  Ink.WeaponList = LIST;
  Ink.BossWeapons = BOSS_WEAPONS;
  Ink.Weapons = {
    Rarity, DEFS, LIST, BOSS_WEAPONS, STARTING,
    randomForFloor, randomOffers, priceFor, drawIcon, drawHeld, get, bossFor
  };
})();
