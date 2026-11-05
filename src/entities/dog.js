/**
 * src/entities/dog.js
 * ------------------------------------------------------------
 * 聪明小狗的“影犬”召唤物。
 *
 * 被动：自动寻找敌人并发射影弹；玩家受击时主动分担一部分伤害。
 * 被击破后进入召唤冷却，复活时继承一部分生命；由 smartdog.js 负责
 * “被击破回复护甲 / 缩短召唤时间”的角色被动词条。
 *
 * 影犬不是敌人，不进入 game.enemies；它由 game.dog 单独管理。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class ShadowDog {
    constructor(game, player, opts = {}) {
      this.game = game;
      this.player = player;
      this.companion = !!opts.companion;
      this.slotAngle = opts.angle == null ? Math.PI * 0.72 : opts.angle;
      this.slotDist = opts.dist || 62;
      this.x = player.x - 48;
      this.y = player.y + 26;
      this.radius = 14;
      this.alive = true;
      // 同伴犬略脆，主犬保持原血量；避免八只都同样肉。
      this.maxHp = (46 + game.floor * 7) * (this.companion ? 0.62 : 1);
      this.hp = this.maxHp;
      this.speed = 190;
      this.mode = 'follow'; // follow | fight | charge | dead
      this.attackCd = 0.6;
      this.chargeTimer = 0;
      this.chargeTarget = null;
      this.tauntRadius = 155;
      this.respawnTime = 12;
      this.respawnTimer = 0;
      this.facing = 1;
      this.time = 0;
      this.hitFlash = 0;
      this.dead = false; // 兼容投射物/敌人的通用检查
      this.isDog = true;
      this.bob = 0;

      // 被动：只有主犬登场时给主人护甲，同伴犬不重复叠加。
      if (!this.companion && player && player.addArmor) player.addArmor(4);
    }

    get target() {
      let best = null;
      let bestD = 1e9;
      for (const e of this.game.enemies) {
        if (e.dead || e.spawnTimer > 0) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }

    update(dt) {
      this.time += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);

      if (!this.alive) {
        this.mode = 'dead';
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.revive();
        return;
      }

      const p = this.player;
      if (!p || p.dead) return;

      // 离得太远时闪现回主人身边，避免卡在墙外
      if (U.dist(this.x, this.y, p.x, p.y) > 620) {
        Ink.FX.burst(this.game, this.x, this.y, '#8d7bd6', 10, 100, { size: 3 });
        this.x = p.x - 40 * (p.facing || 1);
        this.y = p.y + 22;
        Ink.FX.burst(this.game, this.x, this.y, '#8d7bd6', 10, 100, { size: 3 });
      }

      if (this.mode === 'charge' && this.chargeTarget && !this.chargeTarget.dead) {
        this.updateCharge(dt);
      } else {
        if (this.mode === 'charge') this.mode = 'follow';
        this.updateCombat(dt);
      }

      this.facing = (this.target && this.target.x < this.x) ? -1 : 1;
      const A = Ink.ARENA;
      this.x = U.clamp(this.x, A.x + 20, A.x + A.w - 20);
      this.y = U.clamp(this.y, A.y + 20, A.y + A.h - 20);
    }

    updateCombat(dt) {
      const p = this.player;
      const target = this.target;
      const distToPlayer = U.dist(this.x, this.y, p.x, p.y);

      if (target && U.dist(this.x, this.y, target.x, target.y) < 460) {
        this.mode = 'fight';
        const d = U.dist(this.x, this.y, target.x, target.y);
        if (d > 190) {
          const a = U.angleTo(this, target);
          this.x += Math.cos(a) * this.speed * dt;
          this.y += Math.sin(a) * this.speed * dt;
        } else if (d < 100) {
          const a = U.angleTo(this, target) + Math.PI;
          this.x += Math.cos(a) * this.speed * 0.7 * dt;
          this.y += Math.sin(a) * this.speed * 0.7 * dt;
        } else {
          const a = U.angleTo(this, target) + Math.PI / 2;
          this.x += Math.cos(a) * this.speed * 0.4 * dt;
          this.y += Math.sin(a) * this.speed * 0.4 * dt;
        }
        if (this.attackCd <= 0 && d < 430) this.shoot(target);
      } else {
        this.mode = 'follow';
        const home = this.companion
          ? {
              x: p.x + Math.cos(this.slotAngle) * this.slotDist,
              y: p.y + Math.sin(this.slotAngle) * this.slotDist * 0.8
            }
          : {
              x: p.x - (p.facing || 1) * 52,
              y: p.y + 26
            };
        if (distToPlayer > 80) {
          const a = U.angleTo(this, home);
          this.x += Math.cos(a) * this.speed * dt;
          this.y += Math.sin(a) * this.speed * dt;
        } else {
          this.x = U.lerp(this.x, home.x, Math.min(1, dt * 3));
          this.y = U.lerp(this.y, home.y, Math.min(1, dt * 3));
        }
      }
    }

    updateCharge(dt) {
      const t = this.chargeTarget;
      const d = U.dist(this.x, this.y, t.x, t.y);
      const a = U.angleTo(this, t);
      this.x += Math.cos(a) * 540 * dt;
      this.y += Math.sin(a) * 540 * dt;
      this.chargeTimer -= dt;

      if (d < t.radius + this.radius + 14 || this.chargeTimer <= 0) {
        // 落地嘲讽：周围敌人强制攻击影犬
        let taunted = 0;
        for (const e of this.game.enemies) {
          if (e.dead) continue;
          const ed = U.dist(this.x, this.y, e.x, e.y);
          if (ed < this.tauntRadius + e.radius) {
            e.taunt(3.4, this);
            taunted++;
          }
        }
        Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 6, r1: 150, life: 0.45, color: '#b48cff', width: 3 });
        Ink.FX.text(this.game, taunted > 1 ? '群嘲 ×' + taunted : '嘲讽', this.x, this.y - 30, '#d7c4ff', 13, 0.8);
        this.game.audio.sfx('bark');
        this.game.addShake(3, 0.15);
        this.mode = 'follow';
        this.chargeTarget = null;
        this.attackCd = 0.2;
      }
    }

    commandCharge() {
      if (!this.alive) {
        this.revive(0.5);
      }
      const t = this.target;
      this.chargeTarget = t;
      this.mode = 'charge';
      this.chargeTimer = t ? 1.25 : 0.45;
      if (!t) {
        // 没敌人就朝玩家面朝方向冲一段，至少有个动作
        this.chargeTarget = {
          x: this.player.x + (this.player.facing || 1) * 160,
          y: this.player.y,
          radius: 10,
          dead: false
        };
      }
      Ink.FX.burst(this.game, this.x, this.y, '#b48cff', 14, 120, { size: 3, glow: true });
      this.game.audio.sfx('bark');
      return true;
    }

    shoot(target) {
      this.attackCd = 1.15;
      const damage = 4 + this.game.floor * 1.3 + (this.player.upgrades ? this.player.upgrades.damage * 1.5 : 0);
      Ink.fire(this.game, {
        x: this.x + this.facing * 10,
        y: this.y - 6,
        angle: U.angleTo(this, target),
        speed: 400,
        damage,
        radius: 5,
        color: '#b48cff',
        owner: 'player',
        source: this,
        sourceKey: 'dog',
        visual: 'shadow',
        life: 2,
        trail: true,
        glow: true
      });
      this.game.audio.sfx('shoot');
    }

    /** 替主人分担伤害，返回实际吸收量。由 game.damagePlayer 调用。 */
    absorbDamage(amount) {
      if (!this.alive || amount <= 1) return 0;
      const d = U.dist(this.x, this.y, this.player.x, this.player.y);
      if (d > 300) return 0;
      const absorbed = Math.min(amount * 0.34, 16 + this.game.floor * 2);
      if (absorbed < 0.5) return 0;
      this.takeDamage(absorbed, true);
      Ink.FX.text(this.game, '影犬代承', this.x, this.y - 26, '#c9b8ff', 11, 0.55);
      return absorbed;
    }

    takeDamage(amount, silent = false) {
      if (!this.alive) return;
      this.hp -= amount;
      this.hitFlash = 0.12;
      if (!silent) Ink.FX.text(this.game, '-' + Math.round(amount), this.x, this.y - 20, '#c9b8ff', 11, 0.5);
      if (this.hp <= 0) this.breakDown();
    }

    breakDown() {
      if (!this.alive) return;
      this.alive = false;
      this.mode = 'dead';
      this.hp = 0;
      this.respawnTimer = this.respawnTime;
      Ink.FX.burst(this.game, this.x, this.y, ['#b48cff', '#5b4a8f', '#fff6e7'], 24, 190, {
        size: 4, glow: true, gravity: 20
      });
      Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 6, r1: 60, life: 0.4, color: '#b48cff', width: 3 });
      Ink.FX.text(this.game, '影犬·散', this.x, this.y - 30, '#d7c4ff', 14, 0.9);
      this.game.audio.sfx('bark');
      this.game.addShake(3, 0.2);
      if (this.game.onDogBroken) this.game.onDogBroken();
    }

    revive(hpRatio = 0.6) {
      this.alive = true;
      this.mode = 'follow';
      this.maxHp = 46 + this.game.floor * 7;
      this.hp = Math.round(this.maxHp * hpRatio);
      this.x = this.player.x - 42 * (this.player.facing || 1);
      this.y = this.player.y + 22;
      this.respawnTimer = 0;
      Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 50, r1: 8, life: 0.45, color: '#b48cff', width: 3 });
      Ink.FX.spawnPortal(this.game, this.x, this.y, '#b48cff', 0.4);
      this.game.audio.sfx('portal');
    }

    reduceRespawn(seconds) {
      if (!this.alive) this.respawnTimer = Math.max(0.5, this.respawnTimer - seconds);
    }

    draw(ctx, game) {
      if (!this.alive) {
        // 冷却提示：在主人身边画一个虚影计时
        if (this.respawnTimer > 0 && this.player && !this.player.dead) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          Ink.Art.drawSprite(ctx, 'dog', this.player.x - 40, this.player.y + 26, 2.4, {
            frame: 0, alpha: 0.4, tint: '#6b5a9e'
          });
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#b48cff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(Math.ceil(this.respawnTimer) + 's', this.player.x - 40, this.player.y + 52);
          ctx.restore();
        }
        return;
      }

      this.bob = Math.sin(this.time * 6) * 1.5;
      // 影子
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#050409';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 18, 16, 6, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // 幽紫光
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.mode === 'charge' ? 0.3 : 0.14;
      const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 34);
      g.addColorStop(0, '#b48cff');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 34, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      Ink.Art.drawSprite(ctx, 'dog', this.x, this.y + this.bob, 2.4, {
        frame: Math.floor(this.time * 6) % 2,
        flip: this.facing < 0,
        alpha: 0.94
      });
      if (this.hitFlash > 0) {
        Ink.Art.drawSprite(ctx, 'dog', this.x, this.y + this.bob, 2.4, {
          frame: 0, flip: this.facing < 0, alpha: 0.5, tint: '#ffffff'
        });
      }

      // 血条
      const w = 30;
      const hpRatio = U.clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(5,4,10,.8)';
      ctx.fillRect(this.x - w / 2 - 1, this.y - 28, w + 2, 4);
      ctx.fillStyle = hpRatio > 0.35 ? '#b48cff' : '#ff6f7d';
      ctx.fillRect(this.x - w / 2, this.y - 27, w * hpRatio, 2);

      if (this.mode === 'charge') {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#d7c4ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 8 + Math.sin(this.time * 18) * 2, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  Ink.ShadowDog = ShadowDog;
})();
