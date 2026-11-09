/**
 * 三瑞 —— 召唤协同
 * 被动「分瑞」：技能期间，玩家受到伤害的 25% 由仍存活的瑞兽分摊。
 * 主动「三瑞」：召唤福、禄、寿三头瑞兽撕咬敌人，造成伤害与短暂沉默；
 *               技能结束时，存活的瑞兽分别献上生命、护甲、金币。
 */
(function () {
  'use strict';
  const Ink = window.Ink;
  const U = Ink.U;

  const BEASTS = [
    { name: '福', color: '#ffd36b', hp: 52 },
    { name: '禄', color: '#8ef0c8', hp: 44 },
    { name: '寿', color: '#ff9bb0', hp: 60 }
  ];

  class Sanrui extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.beasts = [];
      this.duration = 0;
      this.maxDuration = 8;
    }

    onRoomEnter() {
      this.beasts.length = 0;
      this.duration = 0;
    }

    useSkill() {
      const p = this.player;
      this.duration = this.maxDuration;
      this.beasts = BEASTS.map((b, i) => {
        const a = -Math.PI / 2 + (i - 1) * 1.2;
        return {
          name: b.name, color: b.color,
          maxHp: b.hp + p.level * 3, hp: b.hp + p.level * 3,
          x: p.x + Math.cos(a) * 48, y: p.y + Math.sin(a) * 34,
          cd: 0.2 + i * 0.12, alive: true, target: null
        };
      });
      p.skillFlash = 0.3;
      for (const b of this.beasts) {
        Ink.FX.ring(this.game, { x: b.x, y: b.y, r0: 4, r1: 34, life: 0.35, color: b.color, width: 2 });
      }
      Ink.FX.text(this.game, '福 · 禄 · 寿', p.x, p.y - 50, '#ffe1a6', 15, 1.0);
      this.game.audio.sfx('bark');
      return true;
    }

    update(dt) {
      if (this.duration <= 0) return;
      const g = this.game;
      const p = this.player;
      this.duration -= dt;

      for (const b of this.beasts) {
        if (!b.alive) continue;
        // 选一个未被其他瑞兽锁定的最近敌人，避免三只咬同一个。
        let best = null, bd = 1e9;
        for (const e of g.enemies) {
          if (e.dead) continue;
          if (this.beasts.some(o => o !== b && o.alive && o.target === e)) continue;
          const d = U.dist(b.x, b.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) {
          for (const e of g.enemies) {
            if (!e.dead && U.dist(b.x, b.y, e.x, e.y) < bd) { bd = U.dist(b.x, b.y, e.x, e.y); best = e; }
          }
        }
        b.target = best;
        let tx = p.x + (b.name === '福' ? -44 : b.name === '禄' ? 44 : 0);
        let ty = p.y + (b.name === '寿' ? 38 : -28);
        if (best && bd < 300) { tx = best.x; ty = best.y; }
        const a = U.angleTo(b, { x: tx, y: ty });
        const sp = bd < 300 && best ? 250 : 180;
        b.x += Math.cos(a) * sp * dt;
        b.y += Math.sin(a) * sp * dt;
        b.x = U.clamp(b.x, Ink.ARENA.x + 16, Ink.ARENA.x + Ink.ARENA.w - 16);
        b.y = U.clamp(b.y, Ink.ARENA.y + 16, Ink.ARENA.y + Ink.ARENA.h - 16);

        b.cd -= dt;
        if (best && bd < 60 + best.radius && b.cd <= 0) {
          b.cd = 0.82;
          const dmg = 9 + p.level * 2 + p.weapon.damage * 0.22;
          g.damageEnemy(best, dmg, { color: b.color, source: 'skill', knockback: 24 });
          best.stunTimer = Math.max(best.stunTimer || 0, 0.32);
          Ink.FX.slash(g, {
            x: b.x, y: b.y, angle: a, range: 34, arc: 1.6,
            color: b.color, life: 0.18, width: 2
          });
          Ink.FX.text(g, '沉默', best.x, best.y - 30, b.color, 10, 0.5);
        }
        // 贴身敌人会咬伤瑞兽，让“存活”成为可失败条件。
        for (const e of g.enemies) {
          if (e.dead || U.dist(b.x, b.y, e.x, e.y) > 30 + e.radius) continue;
          b.hp -= 7 * dt;
          if (b.hp <= 0) {
            b.alive = false;
            Ink.FX.burst(g, b.x, b.y, [b.color, '#fff6e7'], 14, 100, { size: 3 });
            Ink.FX.text(g, b.name + ' · 散', b.x, b.y - 26, b.color, 12, 0.8);
            break;
          }
        }
      }

      if (this.duration <= 0) {
        this.duration = 0;
        let hp = 0, armor = 0, coins = 0;
        for (const b of this.beasts) {
          if (!b.alive) continue;
          if (b.name === '福') hp += 18;
          if (b.name === '禄') armor += 6;
          if (b.name === '寿') coins += 20;
        }
        if (hp) p.heal(Math.min(4, hp));
        if (armor) p.addArmor(armor);
        if (coins) p.addCoins(coins);
        if (hp || armor || coins) {
          Ink.FX.text(g, '三瑞献礼', p.x, p.y - 50, '#ffe1a6', 14, 1.0);
        }
        this.beasts.length = 0;
      }
    }

    beforeDamage(amount) {
      const alive = this.beasts.filter(b => b.alive);
      if (!alive.length || this.duration <= 0) return amount;
      const shared = amount * 0.25;
      alive[0].hp -= shared;
      if (alive[0].hp <= 0) {
        alive[0].alive = false;
        Ink.FX.text(this.game, alive[0].name + ' · 替主而散', alive[0].x, alive[0].y - 24, alive[0].color, 11, 0.8);
      }
      return amount * 0.75;
    }

    drawWorld(ctx, game) {
      for (const b of this.beasts) {
        if (!b.alive) continue;
        const bob = Math.sin(game.time * 8 + b.x * 0.1) * 2;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y + 10, 16, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - 10, b.y - 8 + bob, 20, 15);
        ctx.fillStyle = '#241a20';
        ctx.fillRect(b.x - 6, b.y - 3 + bob, 3, 3);
        ctx.fillRect(b.x + 3, b.y - 3 + bob, 3, 3);
        ctx.fillStyle = '#fff6e7';
        ctx.fillRect(b.x - 2, b.y + 4 + bob, 4, 2);
        // 角/耳
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - 11, b.y - 12 + bob, 5, 6);
        ctx.fillRect(b.x + 6, b.y - 12 + bob, 5, 6);
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = b.color;
        ctx.fillText(b.name, b.x, b.y - 18);
        ctx.restore();
        // 瑞兽血条
        const ratio = U.clamp(b.hp / b.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(b.x - 15, b.y + 13, 30, 3);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - 15, b.y + 13, 30 * ratio, 3);
      }
    }
  }

  Ink.registerCharacter({
    id: 'sanrui', name: '三瑞', title: '瑞兽之主', role: '召唤 · 协同',
    color: '#c9a45c', accent: '#ffe1a6',
    hp: 16, armor: 4, speed: 200, damage: 7, atkInterval: 0.42, range: 420, cooldown: 11.0,
    skillName: '三瑞', skillDesc: '召唤福、禄、寿三头瑞兽撕咬敌人，造成伤害与短暂沉默。瑞兽有独立血量；技能结束时存活的瑞兽分别献上生命、护甲、金币。',
    passiveName: '分瑞', passiveDesc: '技能期间，玩家受到伤害的 25% 由仍存活的瑞兽分摊。',
    quote: '福、禄、寿，都饿着。',
    create(player, game) { return new Sanrui(player, game); }
  });
})();
