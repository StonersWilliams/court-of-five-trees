/**
 * 秋雨 —— 雨阵续航
 * 被动「湿意」：生命低于 40% 时，受到的伤害降低 12%。
 * 主动「秋霖」：在指定位置降下一片雨阵，持续伤害并减速敌人；
 *               自己站在雨阵中时获得伤害减免并持续回血。
 */
(function () {
  'use strict';
  const Ink = window.Ink;
  const U = Ink.U;

  class Autumn extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.rain = null;
      this.rainTick = 0;
      this.healTick = 0;
    }

    onRoomEnter() {
      this.rain = null;
    }

    useSkill() {
      const p = this.player;
      const aim = p.getAimPoint();
      const dist = Math.min(300, U.dist(p.x, p.y, aim.x, aim.y));
      const a = U.angleTo(p, aim);
      const x = U.clamp(p.x + Math.cos(a) * Math.max(80, dist), 110, 850);
      const y = U.clamp(p.y + Math.sin(a) * Math.max(80, dist), 150, 520);
      this.rain = { x, y, r: 118, life: 5.2, maxLife: 5.2, tick: 0 };
      this.rainTick = 0;
      this.healTick = 0;
      p.skillFlash = 0.3;
      Ink.FX.ring(this.game, { x, y, r0: 12, r1: 122, life: 0.55, color: '#8fd6ff', width: 3 });
      Ink.FX.text(this.game, '秋霖', x, y - 44, '#c7ecff', 15, 0.9);
      this.game.audio.sfx('skill');
      return true;
    }

    update(dt) {
      const g = this.game;
      const p = this.player;
      if (!this.rain) return;
      const r = this.rain;
      r.life -= dt;
      r.tick -= dt;
      if (r.tick <= 0) {
        r.tick = 0.42;
        const dmg = 7 + p.level * 1.6 + p.weapon.damage * 0.18;
        for (const e of g.enemies.slice()) {
          if (e.dead || U.dist(r.x, r.y, e.x, e.y) > r.r + e.radius) continue;
          g.damageEnemy(e, dmg, { color: '#9fe0ff', source: 'skill' });
          if (e.applySlow) e.applySlow(0.62, 0.8);
        }
        Ink.FX.burst(g, r.x + U.rand(-r.r, r.r) * 0.8, r.y + U.rand(-r.r, r.r) * 0.5,
          ['#8fd6ff', '#c7ecff'], 2, 55, { size: 2, gravity: 220, lifeMult: 0.6 });
      }
      const inside = U.dist(p.x, p.y, r.x, r.y) <= r.r;
      if (inside) {
        this.healTick -= dt;
        if (this.healTick <= 0) {
          this.healTick = 0.55;
          p.heal(1);
          Ink.FX.text(g, '+3', p.x + U.rand(-8, 8), p.y - 36, '#8ef0c8', 11, 0.55);
        }
      }
      if (r.life <= 0) this.rain = null;
    }

    inRain() {
      if (!this.rain) return false;
      return U.dist(this.player.x, this.player.y, this.rain.x, this.rain.y) <= this.rain.r;
    }

    beforeDamage(amount) {
      if (this.inRain()) return amount * 0.55;       // 雨阵中 45% 减伤
      if (this.player.hp < this.player.maxHp * 0.4) return amount * 0.88;
      return amount;
    }

    drawWorld(ctx, game) {
      if (!this.rain) return;
      const r = this.rain;
      const fade = U.clamp(r.life / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = '#6fb6d9';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = '#9fe0ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -game.time * 24;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // 雨丝
      ctx.strokeStyle = 'rgba(190,235,255,.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const a = i * 1.7 + game.time * 0.6;
        const rr = (i * 37 % 100) / 100 * r.r;
        const x = r.x + Math.cos(a) * rr;
        const y = r.y + Math.sin(a) * rr * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  Ink.registerCharacter({
    id: 'autumn', name: '秋雨', title: '听雨人', role: '区域 · 续航',
    color: '#7fb8c9', accent: '#b7d9ff',
    hp: 15, armor: 6, speed: 205, damage: 8, atkInterval: 0.4, range: 340, cooldown: 10.0,
    skillName: '秋霖', skillDesc: '在指定区域降下雨阵，持续 5 秒，对敌人造成伤害和减速；站在雨中减伤 45% 并持续回血。',
    passiveName: '湿意', passiveDesc: '生命低于 40% 时，受到的伤害降低 12%。',
    quote: '雨落下来，路就软了。',
    create(player, game) { return new Autumn(player, game); }
  });
})();
