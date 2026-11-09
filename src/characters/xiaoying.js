/**
 * src/characters/xiaoying.js
 * 小影 —— 近战刺客
 *
 * 被动「残影」：击杀敌人会留下可拾取的残影，触碰回复生命；
 *               击杀被标记目标额外缩短主动技能冷却。
 * 主动「影袭」：向瞄准方向突进，对路径附近敌人造成伤害并标记；
 *               被标记敌人受到小影的伤害提高 25%。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class Xiaoying extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.combo = 0;
      this.chain = 0;
      this.chainTimer = 0;
    }

    update(dt) {
      if (this.chainTimer > 0) {
        this.chainTimer -= dt;
        if (this.chainTimer <= 0) this.chain = 0;
      }
    }

    basicAttack() {
      const p = this.player;
      this.combo++;
      const offset = (this.combo % 2 === 0 ? -1 : 1) * 0.12;
      p.melee({
        range: 84,
        arc: 1.45,
        damageMult: 1,
        color: '#ff8fb3',
        knockback: 70,
        angleOffset: offset
      });
      this.game.audio.sfx('slash');
      return true;
    }

    useSkill() {
      const p = this.player;
      const g = this.game;
      const aim = p.getAimPoint();
      const a = U.angleTo(p, aim);
      const dist = Math.min(205, U.dist(p.x, p.y, aim.x, aim.y) + 46);
      const sx = p.x, sy = p.y;
      const A = Ink.ARENA;
      const tx = U.clamp(p.x + Math.cos(a) * dist, A.x + 24, A.x + A.w - 24);
      const ty = U.clamp(p.y + Math.sin(a) * dist, A.y + 24, A.y + A.h - 24);

      p.invuln = Math.max(p.invuln, 0.34);
      p.speedBoostTimer = 0.5;
      p.x = tx;
      p.y = ty;

      // 残影拖尾
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        Ink.FX.ghost(g, {
          charId: 'xiaoying',
          x: U.lerp(sx, tx, t),
          y: U.lerp(sy, ty, t),
          life: 0.28 + t * 0.12,
          tint: '#ff8fb3',
          alpha: 0.34,
          size: 3,
          float: 0
        });
      }
      Ink.FX.slash(g, {
        x: sx, y: sy, angle: a, range: dist + 30, arc: 0.9,
        color: '#ff8fb3', life: 0.25
      });
      Ink.FX.burst(g, tx, ty, '#ff8fb3', 14, 150, { size: 3, glow: true });
      Ink.FX.text(g, '影袭', tx, ty - 34, '#ffc2d4', 14, 0.7);

      const dmg = 18 + p.level * 2.4 + p.upgrades.damage * 1.8;
      let marked = 0;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const onPath = U.pointSegDist(e.x, e.y, sx, sy, tx, ty) < 54 + e.radius;
        const nearEnd = U.dist(e.x, e.y, tx, ty) < 66 + e.radius;
        if (!onPath && !nearEnd) continue;
        g.damageEnemy(e, dmg, {
          color: '#ffd0dd', crit: true,
          knockback: 55, angle: U.angleTo(p, e)
        });
        if (!e.dead) {
          e.applyMark(5.5);
          marked++;
        }
      }
      g.audio.sfx('dash');
      g.addShake(4, 0.18);
      if (marked > 0) Ink.FX.text(g, '标记 ×' + marked, tx, ty - 52, '#ff6f9c', 12, 0.8);
      return true;
    }

    onBasicHit(enemy) {
      // 近战本身不叠状态，标记来自主动
      if (enemy.markTimer > 0 && Math.random() < 0.25) {
        Ink.FX.hit(this.game, enemy.x, enemy.y, U.rand(0, U.TAU), '#ff8fb3', false);
      }
    }

    onKill(enemy) {
      const p = this.player;
      const g = this.game;
      this.chain = (this.chain || 0) + 1;
      this.chainTimer = 4;
      p.heal(0.65 + Math.min(1.2, this.chain * 0.22));
      const marked = enemy.markTimer > 0;
      Ink.FX.ghost(g, {
        charId: 'xiaoying',
        x: enemy.x, y: enemy.y,
        life: 3,
        tint: marked ? '#ffd36b' : '#ff8fb3',
        alpha: 0.55,
        size: 3,
        float: 5,
        heal: 2,
        pickupRadius: 40,
        onCollect: (game) => {
          p.heal(1);
          game.audio.sfx('pickup');
          Ink.FX.text(game, '+2', p.x, p.y - 30, '#7fe3d2', 12, 0.7);
        }
      });
      if (marked) {
        p.skillCd = Math.max(0, p.skillCd - p.skillCdMax * 0.6);
        p.heal(1);
        Ink.FX.text(g, '标记猎杀 · 冷却 -60%', p.x, p.y - 44, '#ffd36b', 12, 0.9);
      }
    }

    modifyDamageDealt(enemy, amount) {
      // 被标记的敌人受到小影的伤害 +25%
      return enemy.markTimer > 0 ? amount * 1.30 : amount;
    }
  }

  Ink.registerCharacter({
    id: 'xiaoying',
    name: '小影',
    title: '影巷刺客',
    role: '近战 · 爆发',
    color: PAL.xiaoying,
    accent: '#ff8fb3',
    hp: 14,
    armor: 2,
    speed: 252,
    damage: 11,
    atkInterval: 0.3,
    range: 84,
    cooldown: 7,
    skillName: '影袭',
    skillDesc: '向瞄准方向突进，对路径附近的敌人造成伤害并标记 5.5 秒；突进后短暂加速。',
    passiveName: '残影',
    passiveDesc: '击杀留下 3 秒残影；连续击杀回复递增；击杀标记目标返还 60% 冷却。',
    quote: '你看不见我，是因为你已经在影子里了。',
    create(player, game) { return new Xiaoying(player, game); }
  });
})();
