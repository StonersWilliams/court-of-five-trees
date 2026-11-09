/* =========================================================================
 *  relics.js — 守门人遗物 / 抗性饰品
 *
 *  每位守门人（除创世者）在专属武器之外，还会掉落一件对应遗物。
 *  遗物不占武器槽、不参与掉落池，拿到即生效；同一件不会重复掉落。
 *  这里只放数据与轻量属性，具体结算在 player.js / game.js。
 * ========================================================================= */
(function () {
  'use strict';

  const Ink = window.Ink;
  if (!Ink) return;

  const LIST = [
    {
      id: 'inkguard', name: '松露墨碟', boss: 'truffle', color: '#c89b6a',
      desc: '菌毯与减速区域的惩罚减半。', slowResist: 0.5
    },
    {
      id: 'sunring', name: '环日残环', boss: 'sunstar', color: '#ffd36b',
      desc: '远程武器暴击率 +8%。', crit: 0.08
    },
    {
      id: 'ninesun', name: '九阳钉', boss: 'ninesun', color: '#ff8a4c',
      desc: '所有武器伤害 +8%。', damage: 0.08
    },
    {
      id: 'peachcharm', name: '桃柱符纸', boss: 'peach', color: '#ff9bb0',
      desc: '地刺与封印伤害减半。', trapResist: 0.5
    },
    {
      id: 'ogadoor', name: '尾刚纸门', boss: 'oga', color: '#8f9dff',
      desc: '主动技能冷却缩短 10%。', cdMult: 0.9
    },
    {
      id: 'junepage', name: '六月残页', boss: 'june', color: '#b7d9ff',
      desc: '区域减速效果降低 35%。', slowResist: 0.35
    },
    {
      id: 'towerbell', name: '伦敦塔钟摆', boss: 'tower', color: '#d7c39a',
      desc: '地刺与封印伤害减半，钟声不再震退。', trapResist: 0.5
    },
    {
      id: 'bigmonart', name: '大大怪涂鸦', boss: 'bigmon', color: '#8ef0c8',
      desc: '所有武器伤害 +10%。', damage: 0.1
    },
    {
      id: 'edomask', name: '江户面具', boss: 'edo', color: '#c084fc',
      desc: '主动技能耗能 -2。', skillCost: 2
    },
    {
      id: 'buzzform', name: '格式审查', boss: 'buzz', color: '#9fbf8f',
      desc: '拾取能量球额外回复 2 点。', energyGain: 2
    },
    {
      id: 'liuhammer', name: '铁砧诗稿', boss: 'liu', color: '#ffb35c',
      desc: '近战命中额外附加一层字印。', meleeInk: true
    },
    {
      id: 'yuenujade', name: '铜鼓玉璧', boss: 'yuenu', color: '#8fe0c8',
      desc: '受到的远程弹幕伤害降低 12%。', rangedResist: 0.12
    }
  ];

  const BY_BOSS = {};
  const BY_ID = {};
  for (const r of LIST) {
    BY_ID[r.id] = r;
    if (r.boss) BY_BOSS[r.boss] = r;
  }

  Ink.Relics = BY_ID;
  Ink.RelicList = LIST;
  Ink.RelicForBoss = (bossId) => BY_BOSS[bossId] || null;
})();
