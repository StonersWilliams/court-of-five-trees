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
      apply(p) { p.frostHits = true; }
    },
    ember: {
      id: 'ember', name: '余烬', color: '#ff9a5c',
      desc: '你的武器命中会点燃敌人，持续 2 秒。',
      apply(p) { p.emberHits = true; }
    },
    nova: {
      id: 'nova', name: '墨爆', color: '#c9a6ff',
      desc: '敌人死亡时爆开一团墨，对周围造成\n你攻击力 70% 的范围伤害。',
      apply(p) { p.nova = true; }
    },
    critburst: {
      id: 'critburst', name: '会心裂', color: '#ffb35c',
      desc: '暴击时产生小范围爆裂，\n对周围敌人造成 50% 伤害。',
      apply(p) { p.critBurst = true; }
    },
    overcharge: {
      id: 'overcharge', name: '超载', color: '#f4d76a',
      desc: '每累计 8 次武器命中，向附近 3 名敌人\n释放一道连锁墨雷。',
      apply(p) { p.overcharge = true; }
    },
    guardian: {
      id: 'guardian', name: '守庭', color: '#9fe8ff',
      desc: '每进入一个新房间，获得 4 点护甲。',
      apply(p) { p.guardian = true; }
    },
    swift: {
      id: 'swift', name: '踏枝', color: '#8ef0c8',
      desc: '击杀敌人后 2 秒内，移动速度 +25%。',
      apply(p) { p.swift = true; }
    },
    greed: {
      id: 'greed', name: '拾荒者', color: '#ffd36b',
      desc: '金币拾取量 +50%。',
      apply(p) { p.coinMult *= 1.5; }
    },
    lastStand: {
      id: 'lastStand', name: '背水', color: '#ff7d7d',
      desc: '生命低于 35% 时，造成伤害 +30%。',
      apply(p) { p.lastStand = true; }
    }
  };

  const LIST = Object.keys(PASSIVES);

  Ink.Passives = PASSIVES;
  Ink.PassiveList = LIST;

  Ink.getPassive = function (id) {
    return PASSIVES[id] || null;
  };
})();
