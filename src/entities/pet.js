/**
 * 黄金台宠物：由「黄金台」收服的怪物，或宠物击杀后转化的小兽。
 * 独立血条、自动索敌；死亡后不消失，房间清空时自动复活。
 */
(function () {
  'use strict';

  const U = Ink.U;

  class Pet {
    constructor(game, type, x, y) {
      this.game = game;
      this.type = type;
      this.isPet = true;
      this.x = x;
      this.y = y;
      this.radius = 13;
      this.maxHp = 22 + game.floorIndex * 4 + (game.player && game.player.petBond ? 12 : 0);
      this.hp = this.maxHp;
      this.speed = 185;
      this.damage = 5 + Math.floor(game.floorIndex * 1.2) + (game.player && game.player.petBond ? 4 : 0);
      this.attackCd = 0;
      this.dead = false;
      this.revivePending = false;
      this.deadTimer = 0;
      this.time = U.rand(0, 10);
      this.facing = 1;
      this.hitFlash = 0;
      this.target = null;
      this.retarget = 0;
      this.tint = Ink.EnemyTypes && Ink.EnemyTypes[type] ? Ink.EnemyTypes[type].color : '#ffd36b';
    }

    pickTarget() {
      let best = null;
      let bestD = 1e9;
      for (const e of this.game.enemies) {
        if (e.dead || e.isBoss) continue;
        const d = U.dist2(this.x, this.y, e.x, e.y);
        if (d < bestD) { best = e; bestD = d; }
      }
      return best && bestD < 430 * 430 ? best : null;
    }

    update(dt) {
      if (this.dead) {
        this.deadTimer += dt;
        return;
      }
      this.time += dt;
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.retarget -= dt;
      if (this.retarget <= 0 || !this.target || this.target.dead) {
        this.target = this.pickTarget();
        this.retarget = 0.35;
      }

      const p = this.game.player;
      let tx = p.x;
      let ty = p.y;
      let attacking = false;
      if (this.target) {
        const d = U.dist(this.x, this.y, this.target.x, this.target.y);
        if (d > 48) {
          tx = this.target.x;
          ty = this.target.y;
        } else {
          attacking = true;
          if (this.attackCd <= 0) {
            this.attackCd = 0.72;
            this.game.damageEnemy(this.target, this.damage, {
              source: 'pet', pet: this, color: this.tint, sourceKey: 'pet'
            });
            Ink.FX.slash(this.game, {
              x: this.target.x, y: this.target.y, angle: U.angleTo(this.x, this.y, this.target.x, this.target.y),
              range: 28, arc: 1.6, life: 0.18, color: this.tint
            });
          }
        }
      } else {
        // 没有敌人时绕在主人身边。
        const a = this.time * 1.25;
        tx = p.x + Math.cos(a) * 56;
        ty = p.y + Math.sin(a) * 38 + 18;
      }
      if (!attacking) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const len = Math.hypot(dx, dy) || 1;
        if (len > 10) {
          const step = Math.min(len, this.speed * dt);
          this.x += (dx / len) * step;
          this.y += (dy / len) * step;
          this.facing = dx < 0 ? -1 : 1;
        }
      }
      const A = Ink.ARENA;
      this.x = U.clamp(this.x, A.x + 18, A.x + A.w - 18);
      this.y = U.clamp(this.y, A.y + 30, A.y + A.h - 12);
    }

    takeDamage(amount) {
      if (this.dead) return;
      this.hp -= Math.max(1, Math.round(amount));
      this.hitFlash = 0.12;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        this.revivePending = true;
        this.deadTimer = 0;
        Ink.FX.burst(this.game, this.x, this.y, [this.tint, '#ffffff'], 16, 120, { size: 2 });
      }
    }

    revive() {
      if (!this.revivePending) return;
      this.dead = false;
      this.revivePending = false;
      this.hp = this.maxHp;
      this.deadTimer = 0;
      this.x = this.game.player.x + U.rand(-36, 36);
      this.y = this.game.player.y + U.rand(22, 46);
      Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 4, r1: 42, life: 0.4, color: this.tint, width: 2 });
    }

    draw(ctx) {
      if (this.dead) {
        // 死亡后留一个渐渐淡去的墨印，提示房间清完会回来。
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = this.tint;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 8, 14, 5, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      const bob = Math.sin(this.time * 5) * 1.4;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = this.tint;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 18, 0, U.TAU);
      ctx.fill();
      // 金色契约环：即使宠物被角色/敌人挡住，也能一眼看到它跟随的位置。
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#e8c170';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 10, 13, 5, 0, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
      Ink.Art.drawSprite(ctx, 'enemy:' + this.type, this.x, this.y + bob, 2.1, {
        frame: Math.floor(this.time * 5) % 2,
        flip: this.facing < 0,
        tint: this.hitFlash > 0 ? '#ffffff' : this.tint
      });
      const w = 30;
      ctx.fillStyle = 'rgba(4,3,9,.8)';
      ctx.fillRect(this.x - w / 2, this.y - 30, w, 4);
      ctx.fillStyle = '#8ef0c8';
      ctx.fillRect(this.x - w / 2, this.y - 30, w * U.clamp(this.hp / this.maxHp, 0, 1), 4);
    }
  }

  Ink.Pet = Pet;
})();
