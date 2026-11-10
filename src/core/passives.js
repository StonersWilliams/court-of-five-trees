/**
 * src/core/passives.js
 * ------------------------------------------------------------
 * 局内“机制型”被动。它们不是简单的数值升级，而是改变子弹、
 * 击杀、受击、拾取的行为，让每两关的三选一产生构筑差异。
 *
 * 每个条目：
 *   id / name / desc / color / apply(player)
 * apply 只负责写入 Player 的被动字段；真正的行为在对应系统里读取。
 */
(function () {
  'use strict';

  const Ink = window.Ink;

  const PASSIVES = {
    ricochet: {
      id: 'ricochet', name: '折墨', color: '#8fd6ff',
      desc: '你的子弹在命中后可折向附近的另一名敌人，\n额外弹射 2 次。',
      apply(p) { p.bonusBounce += 2; }
    },
    wallBounce: {
      id: 'wallBounce', name: '撞墙不回', color: '#9fe8ff',
      desc: '你的子弹碰到墙壁会反弹 1 次，\n而不是直接消散。',
      apply(p) { p.wallBounce += 1; }
    },
    thorn: {
      id: 'thorn', name: '荆棘皮', color: '#b6e08a',
      desc: '受到近身伤害时，将 35% 伤害反弹给伤害来源。',
      apply(p) { p.thorn += 0.35; }
    },
    leech: {
      id: 'leech', name: '汲血', color: '#ff8f9f',
      desc: '每击杀一名敌人回复 2 点生命。',
      apply(p) { p.leech += 2; }
    },
    magnet: {
      id: 'magnet', name: '聚宝', color: '#ffd36b',
      desc: '经验、金币与武器的拾取范围 +80。',
      apply(p) { p.pickupRadius += 80; }
    },
    frost: {
      id: 'frost', name: '霜印', color: '#9fd9ff',
      desc: '你的武器命中会使敌人减速 35%，持续 1.4 秒。',
      apply(p) { p.frostHits = true; p.frostStacks = (p.frostStacks || 0) + 1; }
    },
    ember: {
      id: 'ember', name: '余烬', color: '#ff9a5c',
      desc: '你的武器命中会点燃敌人，持续 2 秒。',
      apply(p) { p.emberHits = true; p.emberStacks = (p.emberStacks || 0) + 1; }
    },
    nova: {
      id: 'nova', name: '墨爆', color: '#c9a6ff',
      desc: '敌人死亡时爆开一团墨，对周围造成\n你攻击力 70% 的范围伤害。',
      apply(p) { p.nova = true; p.novaStacks = (p.novaStacks || 0) + 1; }
    },
    critburst: {
      id: 'critburst', name: '会心裂', color: '#ffb35c',
      desc: '暴击时产生小范围爆裂，\n对周围敌人造成 50% 伤害。',
      apply(p) { p.critBurst = true; p.critBurstStacks = (p.critBurstStacks || 0) + 1; }
    },
    overcharge: {
      id: 'overcharge', name: '超载', color: '#f4d76a',
      desc: '每累计 8 次武器命中，向附近 3 名敌人\n释放一道连锁墨雷。',
      apply(p) { p.overcharge = true; p.overchargeStacks = (p.overchargeStacks || 0) + 1; }
    },
    guardian: {
      id: 'guardian', name: '守庭', color: '#9fe8ff',
      desc: '每进入一个新房间，获得 4 点护甲。',
      apply(p) { p.guardian = true; p.guardianStacks = (p.guardianStacks || 0) + 1; }
    },
    swift: {
      id: 'swift', name: '踏枝', color: '#8ef0c8',
      desc: '击杀敌人后 2 秒内，移动速度 +25%。',
      apply(p) { p.swift = true; p.swiftStacks = (p.swiftStacks || 0) + 1; }
    },
    greed: {
      id: 'greed', name: '拾荒者', color: '#ffd36b',
      desc: '金币拾取量 +50%。',
      apply(p) { p.coinMult += 0.5; }
    },
    piercing: {
      id: 'piercing', name: '洞墨', color: '#bfe6ff',
      desc: '武器弹体额外穿透 1 名敌人。可叠加。',
      apply(p) { p.bonusPierce += 1; }
    },
    seeking: {
      id: 'seeking', name: '引墨', color: '#8fd6ff',
      desc: '武器弹体获得追踪能力，叠加越高越明显。',
      apply(p) { p.bonusHoming += 0.8; }
    },
    armoredKill: {
      id: 'armoredKill', name: '拾甲', color: '#9fe8ff',
      desc: '每次击杀恢复 1 点护甲。可叠加。',
      apply(p) { p.armorOnKill += 1; }
    },
    critical: {
      id: 'critical', name: '点睛', color: '#ffd36b',
      desc: '暴击率 +5%。可叠加。',
      apply(p) { p.critChance += 0.05; }
    },
    lastStand: {
      id: 'lastStand', name: '背水', color: '#ff7d7d',
      desc: '生命低于 35% 时，造成伤害 +30%，每层再 +10%。',
      apply(p) { p.lastStand = true; p.lastStandStacks = (p.lastStandStacks || 0) + 1; }
    },
    phoenix: {
      id: 'phoenix', name: '涅槃', color: '#ffb35c',
      desc: '获得一次免费复活：致命伤时以 50% 生命\n站起，并清空周围敌弹。可叠加次数。',
      apply(p) { p.reviveCharges = (p.reviveCharges || 0) + 1; }
    },
    multishot: {
      id: 'multishot', name: '双管', color: '#8fd6ff',
      desc: '所有远程武器额外发射 1 条弹道。可叠加。',
      apply(p) { p.extraProjectiles = (p.extraProjectiles || 0) + 1; }
    },
    orbit: {
      id: 'orbit', name: '环刃', color: '#9fe8ff',
      desc: '两枚墨刃绕身旋转，持续切割贴近的敌人。\n每层增加一枚。',
      apply(p) { p.orbit = true; p.orbitStacks = (p.orbitStacks || 0) + 1; }
    },
    execute: {
      id: 'execute', name: '斩律', color: '#ff6b6b',
      desc: '对生命低于 30% 的敌人伤害 +50%，\n每层再 +10%。',
      apply(p) { p.execute = true; p.executeStacks = (p.executeStacks || 0) + 1; }
    },
    split: {
      id: 'split', name: '裂墨', color: '#c9a6ff',
      desc: '武器命中后有概率向两侧裂出两发\n40% 伤害的墨弹。',
      apply(p) { p.split = true; p.splitStacks = (p.splitStacks || 0) + 1; }
    },
    auraSlow: {
      id: 'auraSlow', name: '缓时', color: '#9fd9ff',
      desc: '身边 150 范围内的敌人持续减速 25%。\n每层再扩大范围。',
      apply(p) { p.auraSlow = true; p.auraSlowStacks = (p.auraSlowStacks || 0) + 1; }
    },
    bombShot: {
      id: 'bombShot', name: '爆裂弹', color: '#ff9a5c',
      desc: '每第 5 发远程攻击附带一次\n小范围爆炸。',
      apply(p) { p.bombShot = true; p.bombShotStacks = (p.bombShotStacks || 0) + 1; }
    },
    bloodlust: {
      id: 'bloodlust', name: '饮血', color: '#ff8f9f',
      desc: '暴击时回复 3 点生命。可叠加。',
      apply(p) { p.critHeal = (p.critHeal || 0) + 3; }
    },
    deadeye: {
      id: 'deadeye', name: '鹰眼', color: '#ffd36b',
      desc: '对 240 距离外的敌人伤害 +25%，\n每层再 +5%。',
      apply(p) { p.deadeye = true; p.deadeyeStacks = (p.deadeyeStacks || 0) + 1; }
    },
    vampire: {
      id: 'vampire', name: '饮墨', color: '#ff7d9a',
      desc: '武器每次命中回复 0.08 点生命，可叠加。',
      apply(p) { p.hitHeal = (p.hitHeal || 0) + 0.08; }
    },
    chain: {
      id: 'chain', name: '连坐', color: '#c9a6ff',
      desc: '武器每第 5 次命中，额外伤害附近 2 名敌人；每层降低触发间隔。',
      apply(p) { p.chain = true; p.chainStacks = (p.chainStacks || 0) + 1; }
    },
    thunder: {
      id: 'thunder', name: '雷殛', color: '#8fd6ff',
      desc: '武器每第 7 次命中召来一道连锁墨雷；每层降低触发间隔。',
      apply(p) { p.thunder = true; p.thunderStacks = (p.thunderStacks || 0) + 1; }
    },
    slowAura: {
      id: 'slowAura', name: '寒域', color: '#9fd9ff',
      desc: '身边 150 范围的敌人持续被减速，每层扩大范围。',
      apply(p) { p.slowAura = true; p.slowAuraStacks = (p.slowAuraStacks || 0) + 1; }
    },
    bounty: {
      id: 'bounty', name: '悬赏', color: '#ffd36b',
      desc: '金币与关卡结算金币 +25%，可叠加。',
      apply(p) { p.coinMult += 0.25; }
    },
    siphon: {
      id: 'siphon', name: '汲能', color: '#8ef0c8',
      desc: '每次击杀额外回复 3 点能量，可叠加。',
      apply(p) { p.energyOnKill = (p.energyOnKill || 0) + 3; }
    },
    paperShield: {
      id: 'paperShield', name: '纸甲', color: '#e8dfc2',
      desc: '每 9 秒获得一层纸甲，完全挡下一次伤害。\n每层缩短冷却。',
      apply(p) { p.paperShield = true; p.paperShieldStacks = (p.paperShieldStacks || 0) + 1; }
    },
    caddy: {
      id: 'caddy', name: '书箧', color: '#d9a35c',
      desc: '多带一把兵刃，武器槽 +1（最多 4 格）。',
      apply(p) {
        p.maxWeaponSlots = Math.min(4, (p.maxWeaponSlots || 2) + 1);
        while (p.weaponSlots.length < p.maxWeaponSlots) p.weaponSlots.push(null);
      }
    },
    deathWard: {
      id: 'deathWard', name: '替页', color: '#ffe6a8',
      desc: '第一次致命伤时撕掉这一页：免死并回到 35% 生命，每局一次。',
      apply(p) { p.deathWard = true; }
    },
    petBond: {
      id: 'petBond', name: '兽缘', color: '#8ef0c8',
      desc: '黄金台收服的宠物生命与伤害 +40%，\n宠物复活更快。',
      apply(p) { p.petBond = true; }
    }
  };

  const LIST = Object.keys(PASSIVES);

  // 所有条目都允许重复获取；同名层数会累加，不会出现“池子抽空”卡档。

  Ink.Passives = PASSIVES;
  Ink.PassiveList = LIST;

  Ink.getPassive = function (id) {
    return PASSIVES[id] || null;
  };
})();
