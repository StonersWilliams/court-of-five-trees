/**
 * 小牢鼠 —— 地下突袭
 * 被动「余震」：从地下钻出后的 4 秒内，武器伤害 +25%。
 * 主动「钻地」：钻进地下，期间无敌并推动自己向前，对沿途敌人造成伤害；
 *               结束时破土而出，对周围造成高额伤害与击退。
 */
(function () {
  'use strict';
  const Ink = window.Ink;
  const U = Ink.U;

  class Mouse extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.burrow = 0;
      this.burrowDir = 0;
      this.burrowHits = new Set();
      this.empowered = 0;
    }

    useSkill() {
      if (this.burrow > 0) return false;
      const p = this.player;
      this.burrow = 0.95;
      this.burrowDir = p.aimAngle;
      this.burrowHits.clear();
      p.invuln = Math.max(p.invuln, 0.95);
      p.skillFlash = 0.3;
      Ink.FX.ring(this.game, { x: p.x, y: p.y, r0: 6, r1: 50, life: 0.35, color: '#d9a35c', width: 3 });
      Ink.FX.burst(this.game, p.x, p.y, ['#d9a35c', '#6b513b'], 16, 110, { size: 3 });
      Ink.FX.text(this.game, '钻地', p.x, p.y - 42, '#f2ca82', 14, 0.8);
      this.game.audio.sfx('dash');
      return true;
    }

    update(dt) {
      const p = this.player;
      const g = this.game;
      if (this.empowered > 0) this.empowered -= dt;

      if (this.burrow > 0) {
        this.burrow -= dt;
        p.invuln = Math.max(p.invuln, 0.12);
        const speed = 560;
        p.x = U.clamp(p.x + Math.cos(this.burrowDir) * speed * dt, Ink.ARENA.x + 20, Ink.ARENA.x + Ink.ARENA.w - 20);
        p.y = U.clamp(p.y + Math.sin(this.burrowDir) * speed * dt, Ink.ARENA.y + 20, Ink.ARENA.y + Ink.ARENA.h - 20);
        for (const e of g.enemies) {
          if (e.dead || this.burrowHits.has(e)) continue;
          if (U.dist(p.x, p.y, e.x, e.y) > 38 + e.radius) continue;
          this.burrowHits.add(e);
          g.damageEnemy(e, 18 + p.level * 2, {
            color: '#d9a35c', source: 'skill', angle: this.burrowDir, knockback: 60
          });
        }
        if (Math.random() < 0.55) {
          Ink.FX.particle(g, {
            x: p.x + U.rand(-10, 10), y: p.y + 12, vx: U.rand(-40, 40), vy: U.rand(-70, -20),
            life: 0.5, size: 3, color: '#8f6a43', gravity: 120
          });
        }
        if (this.burrow <= 0) {
          this.burrow = 0;
          this.empowered = 4;
          p.invuln = Math.max(p.invuln, 0.25);
          const dmg = 38 + p.level * 4 + p.weapon.damage * 0.5;
          for (const e of g.enemies.slice()) {
            if (e.dead || U.dist(p.x, p.y, e.x, e.y) > 96 + e.radius) continue;
            g.damageEnemy(e, dmg, { color: '#ffd89a', angle: this.burrowDir, knockback: 150 });
            if (e.applySlow) e.applySlow(0.55, 1.2);
          }
          Ink.FX.explosion(g, p.x, p.y, 100, '#d9a35c');
          Ink.FX.ring(g, { x: p.x, y: p.y, r0: 12, r1: 118, life: 0.45, color: '#ffe1a6', width: 4 });
          Ink.FX.text(g, '破土', p.x, p.y - 50, '#ffe1a6', 17, 1.0);
          g.addShake(6, 0.25);
          g.audio.sfx('explosion');
        }
      }
    }

    modifyDamageDealt(enemy, amount) {
      return this.empowered > 0 ? amount * 1.25 : amount;
    }

    drawWorld(ctx, game) {
      if (this.burrow <= 0) return;
      const p = this.player;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#d9a35c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + Math.sin(game.time * 18) * 3, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  Ink.registerCharacter({
    id: 'mouse', name: '小牢鼠', title: '掘地行者', role: '突进 · 爆发',
    color: '#b9895a', accent: '#f2ca82',
    hp: 86, armor: 3, speed: 238, damage: 8, atkInterval: 0.34, range: 170, cooldown: 9.0,
    skillName: '钻地', skillDesc: '钻入地下 0.95 秒：无敌、向前位移，对沿途敌人造成伤害；结束时破土而出，造成高额范围伤害与击退。',
    passiveName: '余震', passiveDesc: '破土后的 4 秒内，武器伤害提高 25%。',
    quote: '地底下，没有墙。',
    create(player, game) { return new Mouse(player, game); }
  });
})();
