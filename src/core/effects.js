/**
 * src/core/effects.js
 * ------------------------------------------------------------
 * 粒子和技能表现。为了保持“零依赖、单循环”的简单架构，所有效果都是
 * 带 update(dt, game) / draw(ctx, game) 的普通对象，由 game.effects 统一管理。
 *
 * 这里也放了可持续伤害区域、预警线、激光、门传送等可复用效果。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  // ═══════════════════════════════════════════════════════════
  //  基础粒子
  // ═══════════════════════════════════════════════════════════
  class Particle {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.vx = o.vx || 0; this.vy = o.vy || 0;
      this.life = o.life || 0.5;
      this.maxLife = this.life;
      this.size = o.size || 3;
      this.color = o.color || PAL.gold;
      this.gravity = o.gravity || 0;
      this.drag = o.drag === undefined ? 2.2 : o.drag;
      this.glow = !!o.glow;
      this.fade = o.fade === undefined ? true : o.fade;
      this.shrink = o.shrink === undefined ? true : o.shrink;
      this.alpha = o.alpha === undefined ? 1 : o.alpha;
      this.dead = false;
      this.shape = o.shape || 'square';
      this.rotation = o.rotation || 0;
      this.spin = o.spin || 0;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.vy += this.gravity * dt;
      const d = Math.max(0, 1 - this.drag * dt);
      this.vx *= d; this.vy *= d;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.spin * dt;
    }
    draw(ctx) {
      const t = U.clamp(this.life / this.maxLife, 0, 1);
      const size = Math.max(1, this.size * (this.shrink ? (0.35 + t * 0.65) : 1));
      ctx.save();
      ctx.globalAlpha = this.alpha * (this.fade ? t : 1);
      if (this.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = this.color;
      if (this.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, U.TAU);
        ctx.fill();
      } else if (this.shape === 'line') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillRect(-size * 1.8, -1, size * 3.6, 2);
      } else {
        const s = Math.max(1, Math.round(size));
        ctx.fillRect(Math.round(this.x), Math.round(this.y), s, s);
        if (this.glow) {
          ctx.globalAlpha *= 0.5;
          ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, s + 2, s + 2);
        }
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  漂浮文字（伤害、拾取、状态）
  // ═══════════════════════════════════════════════════════════
  class FloatText {
    constructor(text, x, y, color, size = 16, life = 0.85, vy = -42) {
      this.text = text;
      this.x = x + U.rand(-4, 4);
      this.y = y;
      this.color = color || PAL.white;
      this.size = size;
      this.life = life;
      this.maxLife = life;
      this.vy = vy;
      this.dead = false;
      this.crit = false;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.y += this.vy * dt;
      this.vy *= 1 - dt * 1.8;
    }
    draw(ctx) {
      const t = 1 - this.life / this.maxLife;
      const alpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
      ctx.save();
      ctx.globalAlpha = U.clamp(alpha, 0, 1);
      ctx.font = `bold ${this.size}px "Microsoft YaHei", "PingFang SC", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,4,10,.9)';
      ctx.strokeText(this.text, this.x, this.y);
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  扩散环
  // ═══════════════════════════════════════════════════════════
  class Ring {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.r0 = o.r0 || 4;
      this.r1 = o.r1 || 80;
      this.life = o.life || 0.4;
      this.maxLife = this.life;
      this.color = o.color || PAL.gold;
      this.width = o.width || 3;
      this.fill = !!o.fill;
      this.dead = false;
      this.dash = o.dash || 0;
      this.alpha = o.alpha === undefined ? 1 : o.alpha;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const t = 1 - U.clamp(this.life / this.maxLife, 0, 1);
      const r = U.lerp(this.r0, this.r1, U.easeOutCubic(t));
      const a = (1 - t) * this.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.width * (1 - t * 0.5);
      if (this.dash) ctx.setLineDash(this.dash);
      if (this.fill) {
        ctx.fillStyle = U.rgba(this.color, 0.12);
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, U.TAU); ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  挥砍弧光
  // ═══════════════════════════════════════════════════════════
  class Slash {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.angle = o.angle || 0;
      this.range = o.range || 80;
      this.arc = o.arc || Math.PI * 0.7;
      this.life = o.life || 0.16;
      this.maxLife = this.life;
      this.color = o.color || PAL.violet2;
      this.dead = false;
      this.reverse = !!o.reverse;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const t = 1 - this.life / this.maxLife;
      const a0 = this.angle - this.arc / 2;
      const a1 = this.angle + this.arc / 2;
      const sweep = U.lerp(a0, a1, U.easeOutCubic(t));
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 9 * (1 - t * 0.55);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range * (0.72 + t * 0.25), a0, sweep);
      ctx.stroke();
      ctx.globalAlpha = (1 - t) * 0.45;
      ctx.strokeStyle = '#fff8e7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range * (0.74 + t * 0.25), a0, sweep);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  残影 / 角色幽灵
  // ═══════════════════════════════════════════════════════════
  class Ghost {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.charId = o.charId;
      this.life = o.life || 3;
      this.maxLife = this.life;
      this.dead = false;
      this.tint = o.tint || '#a681e8';
      this.alpha = o.alpha === undefined ? 0.55 : o.alpha;
      this.size = o.size || 3;
      this.frame = o.frame || 0;
      this.float = o.float === undefined ? 6 : o.float;
      this.heal = o.heal || 0;
      this.pickupRadius = o.pickupRadius || 34;
      this.collected = false;
      this.onCollect = o.onCollect || null;
    }
    update(dt, game) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.heal && game.player && !game.player.dead) {
        if (U.dist(this.x, this.y, game.player.x, game.player.y) < this.pickupRadius) {
          this.collected = true;
          this.dead = true;
          if (this.onCollect) this.onCollect(game);
        }
      }
    }
    draw(ctx, game) {
      const t = this.life / this.maxLife;
      const bob = Math.sin(game.time * 4 + this.x) * this.float;
      const alpha = this.alpha * U.clamp(t * 2, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = this.tint;
      ctx.beginPath();
      ctx.arc(this.x, this.y + bob, 26, 0, U.TAU);
      ctx.fill();
      ctx.restore();
      Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x, this.y + bob, this.size, {
        alpha, tint: this.tint, frame: this.frame
      });
      if (this.heal) {
        ctx.save();
        ctx.globalAlpha = 0.8 * t;
        ctx.fillStyle = '#7fe3d2';
        ctx.font = 'bold 11px "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('残影', this.x, this.y - 32);
        ctx.restore();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  持续伤害 / 治疗区域
  // ═══════════════════════════════════════════════════════════
  class Field {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.radius = o.radius || 80;
      this.life = o.life || 3;
      this.maxLife = this.life;
      this.team = o.team || 'enemy'; // enemy=伤害玩家, player=伤害敌人
      this.damage = o.damage || 6;
      this.tick = o.tick || 0.5;
      this.t = 0;
      this.kind = o.kind || 'poison';
      this.color = o.color || '#7fc46a';
      this.dead = false;
      this.delay = o.delay || 0;
      this.source = o.source || null;
      this.slow = o.slow || 0;
    }
    update(dt, game) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.delay > 0) { this.delay -= dt; return; }
      this.t -= dt;
      if (this.t > 0) return;
      this.t = this.tick;
      if (this.team === 'enemy') {
        if (game.player && !game.player.dead &&
            U.dist(this.x, this.y, game.player.x, game.player.y) < this.radius + game.player.radius) {
          game.damagePlayer(this.damage, this.source || this);
          if (this.slow) game.player.applySlow(this.slow, 1.5);
        }
        if (game.dog && game.dog.alive &&
            U.dist(this.x, this.y, game.dog.x, game.dog.y) < this.radius + game.dog.radius) {
          game.dog.takeDamage(this.damage * 0.5);
        }
      } else {
        for (const e of game.enemies) {
          if (e.dead) continue;
          if (U.dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
            game.damageEnemy(e, this.damage, { source: 'field', color: this.color });
            if (this.slow) e.applySlow(this.slow, 1.2);
          }
        }
      }
    }
    draw(ctx, game) {
      const t = this.life / this.maxLife;
      const alpha = this.delay > 0 ? 0.25 + Math.sin(game.time * 20) * 0.1 : U.clamp(t * 3, 0, 1) * 0.9;
      Ink.Art.drawGroundField(ctx, this.kind, this.x, this.y, this.radius, game.time, alpha);
      // 气泡/尘点
      ctx.save();
      ctx.globalAlpha = 0.6 * alpha;
      ctx.fillStyle = this.color;
      for (let i = 0; i < 5; i++) {
        const a = game.time * 0.9 + i * 1.7;
        const r = (i / 5) * this.radius;
        ctx.fillRect(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r - (game.time * 12 + i * 9) % 16, 2, 2);
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  激光 / 冲撞预警线
  // ═══════════════════════════════════════════════════════════
  class Beam {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      this.angle = o.angle || 0;
      this.length = o.length || 400;
      this.width = o.width || 12;
      this.warn = o.warn === undefined ? 0.75 : o.warn;
      this.active = o.active || 0.28;
      this.damage = o.damage || 12;
      this.color = o.color || '#ff6f9c';
      this.life = this.warn + this.active;
      this.maxLife = this.life;
      this.dead = false;
      this.hit = false;
      this.follow = !!o.follow;
      this.source = o.source || null;
    }
    update(dt, game) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.follow && this.source && !this.source.dead) {
        this.x = this.source.x; this.y = this.source.y;
        this.angle = U.angleTo(this, game.player);
      }
      if (this.life <= this.active && !this.hit && game.player) {
        const p = game.player;
        const d = U.pointSegDist(p.x, p.y, this.x, this.y, this.x + Math.cos(this.angle) * this.length, this.y + Math.sin(this.angle) * this.length);
        if (d < this.width / 2 + p.radius) {
          this.hit = true;
          game.damagePlayer(this.damage, this.source || this);
        }
      }
    }
    draw(ctx, game) {
      const warning = this.life > this.active;
      const t = warning
        ? 1 - (this.life - this.active) / Math.max(0.001, this.warn)
        : (this.life / Math.max(0.001, this.active));
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      if (warning) {
        ctx.globalAlpha = 0.35 + Math.sin(game.time * 26) * 0.12;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.length, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = this.color;
        ctx.fillRect(0, -this.width / 2, this.length, this.width);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#fff6e7';
        ctx.fillRect(this.length * U.clamp(t, 0, 1) - 4, -3, 8, 6);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = U.clamp(t * 1.5, 0, 1);
        const g = ctx.createLinearGradient(0, 0, this.length, 0);
        g.addColorStop(0, this.color);
        g.addColorStop(0.7, '#fff6e7');
        g.addColorStop(1, this.color);
        ctx.fillStyle = g;
        ctx.fillRect(0, -this.width / 2, this.length, this.width);
        ctx.globalAlpha *= 0.25;
        ctx.fillRect(0, -this.width * 1.4, this.length, this.width * 2.8);
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  敌人出生预警
  // ═══════════════════════════════════════════════════════════
  class SpawnPortal {
    constructor(x, y, color, life = 0.6) {
      this.x = x; this.y = y;
      this.life = life;
      this.maxLife = life;
      this.color = color || '#a681e8';
      this.dead = false;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const t = 1 - this.life / this.maxLife;
      const r = 24 * (1 - t) + 6;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.2;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  传送门（清层）
  // ═══════════════════════════════════════════════════════════
  class Portal {
    constructor(x, y, color = PAL.gold, label = '下层') {
      this.x = x; this.y = y;
      this.color = color;
      this.label = label;
      this.time = 0;
      this.dead = false;
    }
    update(dt) {
      this.time += dt;
    }
    draw(ctx, game) {
      const t = this.time;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.32 - i * 0.08;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, 30 + i * 9 + Math.sin(t * 2 + i) * 2, 12 + i * 4, 0, 0, U.TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.18;
      const g = ctx.createRadialGradient(this.x, this.y - 20, 2, this.x, this.y - 20, 64);
      g.addColorStop(0, U.rgba(this.color, 0.8));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x - 70, this.y - 90, 140, 140);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.65 + Math.sin(t * 3) * 0.15;
      ctx.font = 'bold 13px "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.color;
      ctx.fillText(this.label, this.x, this.y + 40);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  对外工厂
  // ═══════════════════════════════════════════════════════════
  const FX = {
    particles: [],
    MAX_PARTICLES: 460,

    reset() { this.particles.length = 0; },

    /** 在 game.effects 中注册一个对象 */
    add(game, obj) {
      if (obj) game.effects.push(obj);
      return obj;
    },

    particle(game, o) {
      if (this.particles.length >= this.MAX_PARTICLES) this.particles.shift();
      this.particles.push(o);
      return o;
    },

    burst(game, x, y, color, count = 10, speed = 130, opts = {}) {
      for (let i = 0; i < count; i++) {
        const a = opts.angle !== undefined
          ? opts.angle + U.rand(-(opts.spread || 1), (opts.spread || 1))
          : U.rand(0, U.TAU);
        const s = U.rand(speed * 0.3, speed);
        this.particle(game, new Particle({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: U.rand(0.25, 0.65) * (opts.lifeMult || 1),
          size: opts.size || U.rand(2, 5),
          color: Array.isArray(color) ? U.pick(color) : color,
          gravity: opts.gravity || 0,
          drag: opts.drag === undefined ? 2.4 : opts.drag,
          glow: !!opts.glow,
          shape: opts.shape || 'square',
          rotation: a,
          spin: U.rand(-8, 8),
          alpha: opts.alpha
        }));
      }
    },

    text(game, text, x, y, color, size = 15, life = 0.85) {
      return this.add(game, new FloatText(text, x, y, color, size, life));
    },

    ring(game, o) {
      return this.add(game, new Ring(o));
    },

    slash(game, o) {
      return this.add(game, new Slash(o));
    },

    ghost(game, o) {
      return this.add(game, new Ghost(o));
    },

    field(game, o) {
      return this.add(game, new Field(o));
    },

    beam(game, o) {
      return this.add(game, new Beam(o));
    },

    spawnPortal(game, x, y, color, life) {
      return this.add(game, new SpawnPortal(x, y, color, life));
    },

    portal(game, x, y, color, label) {
      return this.add(game, new Portal(x, y, color, label));
    },

    /** 常用组合：命中火花 */
    hit(game, x, y, angle, color = PAL.gold, big = false) {
      this.burst(game, x, y, [color, '#fff6e7'], big ? 12 : 6, big ? 190 : 120, {
        angle, spread: 0.9, size: big ? 3 : 2, glow: true, lifeMult: 0.7
      });
      this.ring(game, { x, y, r0: 2, r1: big ? 34 : 18, life: 0.22, color, width: 2 });
    },

    /** 常用组合：爆炸 */
    explosion(game, x, y, radius, color = PAL.gold) {
      this.ring(game, { x, y, r0: radius * 0.2, r1: radius, life: 0.4, color, width: 4, fill: true });
      this.ring(game, { x, y, r0: 4, r1: radius * 1.2, life: 0.55, color: '#fff6e7', width: 1.5 });
      this.burst(game, x, y, [color, '#ffb35c', '#fff6e7'], 24, 260, { size: 4, glow: true, gravity: 40, lifeMult: 1.4 });
      this.burst(game, x, y, '#3a2a4a', 8, 80, { size: 6, drag: 4, lifeMult: 1.6 });
    },

    damageNumber(game, x, y, amount, color, crit = false) {
      const txt = crit ? `${Math.round(amount)}!` : `${Math.round(amount)}`;
      const t = new FloatText(txt, x, y - 16, color, crit ? 21 : 15, crit ? 1.0 : 0.75);
      t.crit = crit;
      this.add(game, t);
    }
  };

  Ink.FX = FX;
  Ink.Particle = Particle;
  Ink.FloatText = FloatText;
  Ink.Ring = Ring;
  Ink.Slash = Slash;
  Ink.Ghost = Ghost;
  Ink.Field = Field;
  Ink.Beam = Beam;
  Ink.SpawnPortal = SpawnPortal;
  Ink.Portal = Portal;
})();
