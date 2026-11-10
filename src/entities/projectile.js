/**
 * src/entities/projectile.js
 * ------------------------------------------------------------
 * 通用投射物。玩家与敌人共用，通过 owner / team 决定命中对象。
 * 支持穿透、追踪、命中回调、子母弹和 7 种像素外观。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class Projectile {
    constructor(game, o) {
      this.game = game;
      this.x = o.x;
      this.y = o.y;
      this.startX = o.x;
      this.startY = o.y;
      this.owner = o.owner || 'enemy';
      this.x1 = o.x1 !== undefined ? o.x1 : null; // 备用目标点，用于回旋等扩展
      this.y1 = o.y1 !== undefined ? o.y1 : null;
      const angle = o.angle || 0;
      const speed = o.speed || 300;
      this.vx = o.vx !== undefined ? o.vx : Math.cos(angle) * speed;
      this.vy = o.vy !== undefined ? o.vy : Math.sin(angle) * speed;
      this.angle = Math.atan2(this.vy, this.vx);
      this.radius = o.radius || 5;
      this.damage = o.damage || 8;
      this.color = o.color || (this.owner === 'player' ? PAL.gold : PAL.violet);
      this.visual = o.visual || 'orb';
      this.pierce = o.pierce || 0;
      this.life = o.life || 2.2;
      this.maxLife = this.life;
      this.dead = false;
      this.source = o.source || null;
      this.sourceKey = o.sourceKey || '';
      this.onHit = o.onHit || null;
      this.onExpire = o.onExpire || null;
      this.homing = o.homing || 0;
      this.homingTarget = o.homingTarget || null;
      this.homingDelay = o.homingDelay || 0;
      this.hitSet = new Set();
      this.scale = o.scale || 1;
      this.trail = o.trail !== false;
      this.glow = o.glow !== false;
      this.zigzag = o.zigzag || 0;
      this.time = 0;
      this.spin = o.spin || 0;
      this.rotation = this.angle;
      this.knockback = o.knockback || 0;
      this.crit = !!o.crit;
      this.pierceLeft = this.pierce;
      this.damageType = o.damageType || 'normal';
      this.bounce = o.bounce || 0;          // 命中敌人后的折返次数
      this.wallBounce = o.wallBounce || 0;  // 撞墙反弹次数
      this._wallHitCd = 0;
    }

    update(dt) {
      this.time += dt;
      if (this.dead) return;
      this.life -= dt;
      if (this.life <= 0) {
        this._expire();
        return;
      }

      // 追踪
      if (this.homing > 0) {
        this.homingDelay -= dt;
        if (this.homingDelay <= 0) {
          let target = this.homingTarget;
          if (!target || target.dead) {
            target = null;
            if (this.owner === 'player') {
              let best = 260 * 260;
              for (const e of this.game.enemies) {
                if (e.dead || e.spawnTimer > 0) continue;
                const d = U.dist2(this.x, this.y, e.x, e.y);
                if (d < best) { best = d; target = e; }
              }
            } else if (this.game.player && !this.game.player.dead) {
              target = this.game.player;
            }
          }
          if (target) {
            const want = U.angleTo(this, target);
            const cur = Math.atan2(this.vy, this.vx);
            const speed = Math.hypot(this.vx, this.vy);
            const next = U.lerpAngle(cur, want, U.clamp(this.homing * dt, 0, 1));
            this.vx = Math.cos(next) * speed;
            this.vy = Math.sin(next) * speed;
            this.angle = next;
          }
        }
      }
      this.rotation += this.spin * dt;
      if (this.spin === 0) this.rotation = this.angle;

      // 蛇形弹道（用于部分精英弹幕）
      if (this.zigzag) {
        const perp = this.angle + Math.PI / 2;
        const z = Math.cos(this.time * 9) * this.zigzag * dt * 60;
        this.x += Math.cos(perp) * z;
        this.y += Math.sin(perp) * z;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 墙 / 越界
      const A = Ink.ARENA;
      const pad = 6 + this.radius * 0.3;
      let hitWall = false;
      if (this.x < A.x + pad) { this.x = A.x + pad; this.vx = Math.abs(this.vx); hitWall = true; }
      else if (this.x > A.x + A.w - pad) { this.x = A.x + A.w - pad; this.vx = -Math.abs(this.vx); hitWall = true; }
      if (this.y < A.y + pad) { this.y = A.y + pad; this.vy = Math.abs(this.vy); hitWall = true; }
      else if (this.y > A.y + A.h - pad) { this.y = A.y + A.h - pad; this.vy = -Math.abs(this.vy); hitWall = true; }

      if (hitWall) {
        const bounces = this.wallBounce > 0 ? this.wallBounce : this.bounce;
        if (bounces > 0) {
          if (this.wallBounce > 0) this.wallBounce--;
          else this.bounce--;
          this.angle = Math.atan2(this.vy, this.vx);
          this.life = Math.max(this.life, 0.4);
          Ink.FX.burst(this.game, this.x, this.y, this.color, 4, 70, { size: 2, lifeMult: 0.4 });
          this.game.audio.sfx('hit');
        } else {
          this.dead = true;
          if (this.trail) {
            Ink.FX.burst(this.game, this.x, this.y, this.color, 4, 80, { size: 2, lifeMult: 0.5 });
          }
          return;
        }
      }

      // 障碍物：树/柱子/木箱会挡住子弹
      if (this.game.projectileHitObstacle && this.game.projectileHitObstacle(this)) return;

      if (this.owner === 'player') this._checkEnemies();
      else this._checkPlayer();
    }

    _checkEnemies() {
      const game = this.game;
      for (const e of game.enemies) {
        if (e.dead || e.spawnTimer > 0) continue;
        if (this.hitSet.has(e)) continue;
        if (!U.circleOverlap(this.x, this.y, this.radius, e.x, e.y, e.radius)) continue;

        this.hitSet.add(e);
        const hitAngle = Math.atan2(this.vy, this.vx);
        const dmg = this.crit ? this.damage * 1.75 : this.damage;
        game.damageEnemy(e, dmg, {
          source: 'projectile',
          sourceKey: this.sourceKey,
          color: this.color,
          crit: this.crit,
          angle: hitAngle,
          knockback: this.knockback
        });
        Ink.FX.hit(game, this.x, this.y, hitAngle, this.color, this.crit);
        if (this.onHit) this.onHit(this.game, e, this);

        // 折返：优先飞向附近尚未命中的敌人
        if (this.bounce > 0) {
          this.bounce--;
          let next = null;
          let best = 320 * 320;
          for (const other of game.enemies) {
            if (other.dead || other.spawnTimer > 0 || this.hitSet.has(other)) continue;
            const d = U.dist2(this.x, this.y, other.x, other.y);
            if (d < best) { best = d; next = other; }
          }
          if (next) {
            const a = U.angleTo(this, next);
            const speed = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(a) * speed;
            this.vy = Math.sin(a) * speed;
            this.angle = a;
            this.life = Math.max(this.life, 0.6);
            Ink.FX.ring(game, {
              x: this.x, y: this.y, r0: 2, r1: 18, life: 0.2,
              color: this.color, width: 1
            });
            return;
          }
        }

        if (this.pierceLeft > 0) {
          this.pierceLeft--;
        } else {
          this.dead = true;
          return;
        }
      }
    }

    _checkPlayer() {
      const game = this.game;
      const p = game.player;
      if (!p || p.dead) return;

      // 宠物也会被敌方弹幕击中。
      if (game.pets && game.pets.length) {
        for (const pet of game.pets) {
          if (pet.dead || this.hitSet.has(pet)) continue;
          if (U.circleOverlap(this.x, this.y, this.radius, pet.x, pet.y, pet.radius)) {
            this.hitSet.add(pet);
            pet.takeDamage(this.damage);
            Ink.FX.hit(game, this.x, this.y, Math.atan2(this.vy, this.vx), '#ffd36b');
            this.dead = true;
            return;
          }
        }
      }

      // 影犬可以先挡下子弹
      const dog = game.dog;
      if (dog && dog.alive && !this.hitSet.has(dog) &&
          U.circleOverlap(this.x, this.y, this.radius, dog.x, dog.y, dog.radius)) {
        this.hitSet.add(dog);
        dog.takeDamage(this.damage * 0.8);
        Ink.FX.hit(game, this.x, this.y, Math.atan2(this.vy, this.vx), '#8f7aff');
        this.dead = true;
        return;
      }

      if (!U.circleOverlap(this.x, this.y, this.radius, p.x, p.y, p.radius)) return;
      this.dead = true;
      const hitAngle = Math.atan2(this.vy, this.vx);
      if (this.onHit) this.onHit(game, p, this);
      game.damagePlayer(this.damage, this.source || this, { ranged: true });
      Ink.FX.hit(game, this.x, this.y, hitAngle, this.color);
    }

    _expire() {
      this.dead = true;
      if (this.onExpire) this.onExpire(this.game, this);
    }

    draw(ctx, game) {
      if (this.dead) return;
      const a = this.rotation;
      const alpha = U.clamp(this.life / 0.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (this.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 14 * this.scale, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'source-over';
      }

      // 拖尾
      if (this.trail) {
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const tx = -this.vx / sp, ty = -this.vy / sp;
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = alpha * (0.22 - i * 0.05);
          ctx.fillStyle = this.color;
          ctx.fillRect(this.x + tx * i * 5 - 1, this.y + ty * i * 5 - 1, 3 - i * 0.4, 3 - i * 0.4);
        }
        ctx.globalAlpha = alpha;
      }

      ctx.translate(this.x, this.y);
      ctx.rotate(a);
      const s = this.scale;

      switch (this.visual) {
        case 'chess': {
          // 菱形棋子
          ctx.fillStyle = '#101723';
          ctx.fillRect(-6 * s, -6 * s, 12 * s, 12 * s);
          ctx.fillStyle = this.color;
          ctx.fillRect(-4 * s, -4 * s, 8 * s, 8 * s);
          ctx.fillStyle = '#f7fbff';
          ctx.fillRect(-2 * s, -2 * s, 4 * s, 4 * s);
          ctx.fillStyle = '#264563';
          ctx.fillRect(-4 * s, 2 * s, 8 * s, 2 * s);
          break;
        }
        case 'heart': {
          ctx.fillStyle = this.color;
          ctx.fillRect(-2 * s, 0, 4 * s, 4 * s);
          ctx.fillRect(-5 * s, -3 * s, 3 * s, 4 * s);
          ctx.fillRect(2 * s, -3 * s, 3 * s, 4 * s);
          ctx.fillRect(-3 * s, -5 * s, 6 * s, 3 * s);
          ctx.fillStyle = '#fff0f5';
          ctx.fillRect(-3 * s, -3 * s, 2 * s, 2 * s);
          break;
        }
        case 'ink': {
          ctx.fillStyle = '#1a1118';
          ctx.fillRect(-5 * s, -5 * s, 10 * s, 10 * s);
          ctx.fillStyle = this.color;
          ctx.fillRect(-3 * s, -3 * s, 6 * s, 6 * s);
          ctx.fillStyle = '#e8c170';
          ctx.fillRect(-1 * s, -1 * s, 2 * s, 2 * s);
          break;
        }
        case 'bone': {
          ctx.fillStyle = this.color;
          ctx.fillRect(-5 * s, -1 * s, 10 * s, 2 * s);
          ctx.fillRect(-5 * s, -3 * s, 2 * s, 2 * s);
          ctx.fillRect(3 * s, -3 * s, 2 * s, 2 * s);
          ctx.fillRect(-5 * s, 1 * s, 2 * s, 2 * s);
          ctx.fillRect(3 * s, 1 * s, 2 * s, 2 * s);
          break;
        }
        case 'needle': {
          ctx.fillStyle = this.color;
          ctx.fillRect(-7 * s, -1 * s, 12 * s, 2 * s);
          ctx.fillStyle = '#fff6e7';
          ctx.fillRect(2 * s, -1 * s, 3 * s, 2 * s);
          break;
        }
        case 'petal': {
          ctx.fillStyle = this.color;
          ctx.fillRect(-2 * s, -4 * s, 4 * s, 8 * s);
          ctx.fillRect(-4 * s, -1 * s, 8 * s, 3 * s);
          ctx.fillStyle = '#ffd7e3';
          ctx.fillRect(-1 * s, -2 * s, 2 * s, 3 * s);
          break;
        }
        case 'shadow': {
          ctx.fillStyle = this.color;
          ctx.fillRect(-4 * s, -3 * s, 8 * s, 7 * s);
          ctx.fillStyle = '#d9caff';
          ctx.fillRect(-2 * s, -1 * s, 2 * s, 2 * s);
          ctx.fillRect(1 * s, -1 * s, 2 * s, 2 * s);
          break;
        }
        case 'spike': {
          ctx.rotate(this.time * 6);
          ctx.fillStyle = this.color;
          ctx.fillRect(-1 * s, -7 * s, 2 * s, 14 * s);
          ctx.fillRect(-7 * s, -1 * s, 14 * s, 2 * s);
          ctx.fillStyle = '#fff6e7';
          ctx.fillRect(-1 * s, -3 * s, 2 * s, 6 * s);
          break;
        }
        case 'orb':
        default: {
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(0, 0, 5 * s, 0, U.TAU);
          ctx.fill();
          ctx.fillStyle = '#fff6e7';
          ctx.beginPath();
          ctx.arc(-1 * s, -1 * s, 2.2 * s, 0, U.TAU);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.7;
          ctx.strokeStyle = this.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 8 * s, 0, U.TAU);
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }

  /** 快速创建 */
  Ink.fire = function (game, o) {
    const p = new Projectile(game, o);
    game.projectiles.push(p);
    return p;
  };

  /** 从一点向目标散射 n 发 */
  Ink.spread = function (game, x, y, angle, count, spread, o) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
      Ink.fire(game, Object.assign({}, o, { x, y, angle: angle + t * spread }));
    }
  };

  /** 环形弹幕 */
  Ink.radial = function (game, x, y, count, speed, o) {
    const offset = o.offset || 0;
    for (let i = 0; i < count; i++) {
      const a = offset + i / count * U.TAU;
      Ink.fire(game, Object.assign({}, o, {
        x, y, angle: a,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed
      }));
    }
  };

  Ink.Projectile = Projectile;
})();
