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
      this._bursting = false;
    }

    useSkill() {
      if (this.burrow > 0 || this._bursting) return false;
      const p = this.player;
      this.burrow = 2.0;
      this.burrowDir = p.aimAngle;
      this.burrowHits.clear();
      this._bursting = false;
      p.invuln = Math.max(p.invuln, 2.15);
      p.skillFlash = 0.3;
      Ink.FX.ring(this.game, { x: p.x, y: p.y, r0: 6, r1: 50, life: 0.35, color: '#d9a35c', width: 3 });
      Ink.FX.burst(this.game, p.x, p.y, ['#d9a35c', '#6b513b'], 16, 110, { size: 3 });
      Ink.FX.text(this.game, '钻地 · 2 秒', p.x, p.y - 42, '#f2ca82', 14, 0.8);
      this.game.audio.sfx('dash');
      return true;
    }

    /** 结束钻地：无论计时结束、进房还是异常状态，都从这里收尾，避免卡在无敌位移。 */
    _finishBurrow(willBurst = true) {
      if (this._bursting) return;
      this._bursting = true;
      const p = this.player;
      const g = this.game;
      this.burrow = 0;
      this.empowered = 4;
      p.invuln = Math.max(p.invuln, 0.25);
      if (willBurst) {
        const dmg = 38 + p.level * 4 + p.weapon.damage * 0.5;
        for (const e of g.enemies.slice()) {
          if (e.dead || U.dist(p.x, p.y, e.x, e.y) > 108 + e.radius) continue;
          g.damageEnemy(e, dmg, { color: '#ffd89a', angle: this.burrowDir, knockback: 150 });
          if (e.applySlow) e.applySlow(0.55, 1.2);
        }
        Ink.FX.explosion(g, p.x, p.y, 112, '#d9a35c');
        Ink.FX.ring(g, { x: p.x, y: p.y, r0: 12, r1: 132, life: 0.5, color: '#ffe1a6', width: 4 });
        Ink.FX.ring(g, { x: p.x, y: p.y, r0: 28, r1: 84, life: 0.32, color: '#8f6a43', width: 6 });
        Ink.FX.text(g, '破土', p.x, p.y - 50, '#ffe1a6', 17, 1.0);
        g.addShake(6, 0.25);
        g.audio.sfx('explosion');
      }
      this._bursting = false;
    }

    onRoomEnter() {
      // 进房/传送时强制清掉钻地状态，防止跨越房间后计时器冻结。
      if (this.burrow > 0) this._finishBurrow(false);
    }

    update(dt) {
      const p = this.player;
      const g = this.game;
      if (this.empowered > 0) this.empowered -= dt;

      if (this.burrow > 0) {
        if (p.dead || g.state !== 'playing') {
          this.burrow = 0;
          return;
        }
        // 钻地期间跟着当前走位方向转向；不输入时沿上一次方向继续。
        const mv = g.getMoveVector();
        if (mv.x || mv.y) this.burrowDir = Math.atan2(mv.y, mv.x);
        this.burrow = Math.max(0, this.burrow - dt);
        p.invuln = Math.max(p.invuln, 0.12);
        const speed = 430;
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
        if (Math.random() < 0.75) {
          Ink.FX.burst(g, p.x + U.rand(-10, 10), p.y + 12, '#8f6a43', 1, 42, {
            size: 3, life: 0.5, gravity: 120
          });
        }
        if (this.burrow <= 0) this._finishBurrow(true);
      }
    }

    modifyDamageDealt(enemy, amount) {
      return this.empowered > 0 ? amount * 1.25 : amount;
    }

    drawWorld(ctx, game) {
      if (this.burrow <= 0) return;
      const p = this.player;
      const pulse = Math.sin(game.time * 18) * 3;
      ctx.save();
      // 地面裂缝 + 尾随土浪，让 2 秒钻地有明确的方向感。
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#d9a35c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + pulse, 0, U.TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#f2ca82';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 + pulse * 1.5, 0, U.TAU);
      ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        const back = 16 + i * 12;
        const bx = p.x - Math.cos(this.burrowDir) * back;
        const by = p.y - Math.sin(this.burrowDir) * back;
        ctx.globalAlpha = 0.28 / i;
        ctx.fillStyle = i === 1 ? '#f2ca82' : '#8f6a43';
        ctx.beginPath();
        ctx.arc(bx + Math.sin(game.time * 8 + i) * 3, by, 6 - i, 0, U.TAU);
        ctx.fill();
      }
      // 方向箭头
      ctx.globalAlpha = 0.7;
      ctx.translate(p.x, p.y);
      ctx.rotate(this.burrowDir);
      ctx.fillStyle = '#ffe1a6';
      ctx.fillRect(24, -2, 9, 4);
      ctx.fillRect(30, -4, 4, 8);
      ctx.restore();
    }
  }

  Ink.registerCharacter({
    id: 'mouse', name: '小牢鼠', title: '掘地行者', role: '突进 · 爆发',
    color: '#b9895a', accent: '#f2ca82',
    hp: 13, armor: 3, speed: 238, damage: 8, atkInterval: 0.34, range: 170, cooldown: 9.0,
    skillName: '钻地', skillDesc: '钻入地下 2 秒：无敌，随走位方向移动，对沿途敌人造成伤害；结束时破土而出，造成高额范围伤害与击退。',
    passiveName: '余震', passiveDesc: '破土后的 4 秒内，武器伤害提高 25%。',
    quote: '地底下，没有墙。',
    create(player, game) { return new Mouse(player, game); }
  });
})();
