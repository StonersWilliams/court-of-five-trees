/**
 * src/entities/boss.js
 * ------------------------------------------------------------
 * 九位庭主。Boss 复用 Enemy 的状态系统，但拥有独立招式循环、
 * 阶段切换和绘制。每层从三名庭主中随机一位，数值随层数增长。
 *
 * 招式写法：
 *   this.windup(秒, 回调, 预警数据)  先给玩家反应时间
 *   this.after(秒, 回调)             延迟弹幕/爆炸
 *   this.orbit(dt, target, 距离)      保持中距离绕行
 *   this.ring / fireAt / fieldAt      基础弹幕工具
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  const BOSSES = {
    truffle: {
      id: 'truffle', name: '松露君', title: '菌伞下的甜梦',
      baseType: 'slime', ai: 'truffle', hp: 560, speed: 54, damage: 14,
      radius: 42, color: '#c89b6a', xp: 125, interval: 2.0,
      roomName: '松露菌庭', quote: '来，尝一口。吃完就不疼了。'
    },
    sunstar: {
      id: 'sunstar', name: '环日星神', title: '把太阳戴在颈上的神',
      baseType: 'skull', ai: 'sunstar', hp: 540, speed: 60, damage: 15,
      radius: 42, color: '#ffd36b', xp: 130, interval: 1.95,
      roomName: '环日台', quote: '光会平等地烧过每一片叶子。'
    },
    ninesun: {
      id: 'ninesun', name: '九阳神君', title: '九轮不落的暴君',
      baseType: 'guard', ai: 'ninesun', hp: 600, speed: 52, damage: 16,
      radius: 44, color: '#ff8a4c', xp: 140, interval: 1.9,
      roomName: '九阳阶', quote: '天上有九日，地上只配有一道影子。'
    },
    peach: {
      id: 'peach', name: '桃柱', title: '开花不倒的庭柱',
      baseType: 'spider', ai: 'peach', hp: 640, speed: 54, damage: 16,
      radius: 43, color: '#ff9bb0', xp: 145, interval: 2.0,
      roomName: '桃柱庭', quote: '花落下来，是为了埋人。'
    },
    oga: {
      id: 'oga', name: '尾刚一郎', title: '只挥一刀的剑鬼',
      baseType: 'gargoyle', ai: 'oga', hp: 620, speed: 74, damage: 17,
      radius: 42, color: '#8f9dff', xp: 150, interval: 1.85,
      roomName: '一郎剑庭', quote: '一刀。你若还站着，算我输。'
    },
    june: {
      id: 'june', name: '六月云之末', title: '梅雨尽头的云',
      baseType: 'tome', ai: 'june', hp: 600, speed: 58, damage: 16,
      radius: 42, color: '#b7d9ff', xp: 150, interval: 1.95,
      roomName: '云末庭', quote: '雨停之前，你都还在我的云里。'
    },
    tower: {
      id: 'tower', name: '伦敦塔', title: '会走路的钟楼',
      baseType: 'guard', ai: 'tower', hp: 720, speed: 42, damage: 18,
      radius: 46, color: '#d7c39a', xp: 160, interval: 2.1,
      roomName: '钟塔庭', quote: '钟声一响，所有门都关上。'
    },
    bigmon: {
      id: 'bigmon', name: '大大怪', title: '五树庭的笨重噩梦',
      baseType: 'gargoyle', ai: 'bigmon', hp: 760, speed: 48, damage: 18,
      radius: 46, color: '#8ef0c8', xp: 165, interval: 2.0,
      roomName: '大怪庭', quote: '大不大？怪不怪？你说了不算。'
    },
    edo: {
      id: 'edo', name: '江户十二口女', title: '十二张嘴的都市传说',
      baseType: 'spider', ai: 'edo', hp: 680, speed: 68, damage: 17,
      radius: 42, color: '#c084fc', xp: 170, interval: 1.8,
      roomName: '十二口庭', quote: '别数我的嘴，数你的心跳。'
    }
  };

  class Boss extends Ink.Enemy {
    constructor(game, id, x, y) {
      const conf = BOSSES[id];
      if (!conf) throw new Error('未知 Boss: ' + id);
      super(game, conf.baseType, x, y, { spawnTimer: 1.35, spawnFx: false, floor: game.floor });
      this.id = id;
      this.conf = conf;
      this.type = 'boss:' + id;
      this.name = conf.name;
      this.title = conf.title;
      this.isBoss = true;
      this.boss = true;
      this.elite = false;
      this.radius = conf.radius;
      this.scale = 4;
      this.maxHp = Math.round(conf.hp * (1.18 + 0.62 * (this.floor - 1)));
      this.hp = this.maxHp;
      this.speedBase = conf.speed * (1 + 0.06 * (this.floor - 1));
      this.damage = Math.round(conf.damage * (1.10 + 0.32 * (this.floor - 1)));
      this.xpValue = conf.xp + this.floor * 20;
      this.color = conf.color;
      this.spawnTimer = 1.35;
      this.phase = 1;
      this.attackCd = 1.35;
      this.pattern = 0;
      this.telegraph = null;
      this.dash = null;
      this.bossTimers = [];
      this.introDone = false;
      this.contactCd = 1;
      this.animTime = 0;
      this.walkTime = 0;
      this.facing = -1;
      this.inkStacks = 0;
      this.markTimer = 0;
      this.slowTimer = 0;
      this.slowMult = 1;
      this.trappedTimer = 0;
      this.tauntTimer = 0;
      this.spawnFx = false;
      Ink.FX.ring(game, { x, y, r0: 100, r1: 20, life: 0.7, color: conf.color, width: 4 });
    }

    // ── 通用招式工具 ──────────────────────────────────────
    windup(seconds, fn, data = {}) {
      this.telegraph = { t: seconds, total: seconds, fn, data };
      this.attackCd = Math.max(this.attackCd, seconds + 0.45);
    }

    after(seconds, fn) {
      this.bossTimers.push({ t: seconds, fn });
    }

    _updateTimers(dt) {
      for (let i = this.bossTimers.length - 1; i >= 0; i--) {
        const t = this.bossTimers[i];
        t.t -= dt;
        if (t.t <= 0) {
          this.bossTimers.splice(i, 1);
          if (!this.dead) t.fn();
        }
      }
    }

    orbit(dt, target, dist, speedMul = 1) {
      const d = U.dist(this.x, this.y, target.x, target.y) || 1;
      const sp = this.maxSpeed * speedMul;
      if (d > dist + 45) {
        this.x += (target.x - this.x) / d * sp * dt;
        this.y += (target.y - this.y) / d * sp * dt;
      } else if (d < dist - 55) {
        this.x -= (target.x - this.x) / d * sp * dt;
        this.y -= (target.y - this.y) / d * sp * dt;
      } else {
        const a = U.angleTo(this, target) + Math.PI / 2;
        const dir = Math.sin(this.animTime * 0.5) > 0 ? 1 : -1;
        this.x += Math.cos(a) * sp * 0.55 * dt * dir;
        this.y += Math.sin(a) * sp * 0.55 * dt * dir;
      }
      this.walkTime += dt;
    }

    clampPoint(x, y, pad = 40) {
      const A = Ink.ARENA;
      return {
        x: U.clamp(x, A.x + pad, A.x + A.w - pad),
        y: U.clamp(y, A.y + pad, A.y + A.h - pad)
      };
    }

    fireAt(target, opts = {}) {
      const a = U.angleTo(this, target) + (opts.offset || 0);
      Ink.fire(this.game, Object.assign({
        x: this.x, y: this.y - 8, angle: a, speed: 240,
        damage: this.damage, radius: 6, color: this.color,
        owner: 'enemy', source: this, visual: 'orb', life: 4, scale: 1.2
      }, opts, { angle: a }));
    }

    ring(n, speed, opts = {}) {
      Ink.radial(this.game, this.x, this.y - 6, n, speed, Object.assign({
        damage: this.damage, radius: 5, color: this.color,
        owner: 'enemy', source: this, visual: 'orb', life: 4,
        offset: U.rand(0, U.TAU)
      }, opts));
    }

    /** 在目标点放一团地面危害。 */
    fieldAt(kind, x, y, radius, delay, life, opts = {}) {
      const p = this.clampPoint(x, y, 44);
      Ink.FX.field(this.game, {
        x: p.x, y: p.y, kind,
        radius: radius || 58,
        delay: delay === undefined ? 0.35 : delay,
        life: life || 2.4,
        damage: opts.damage || this.damage * 0.55,
        tick: opts.tick || 0.45,
        slow: opts.slow || 0,
        team: 'enemy',
        color: opts.color || this.color,
        source: this
      });
    }

    /** 近身范围伤害（用于踏地/花爆）。 */
    aoeAt(x, y, radius, damage) {
      const game = this.game;
      const p = game.player;
      Ink.FX.explosion(game, x, y, radius, this.color);
      Ink.FX.ring(game, {
        x, y, r0: 8, r1: radius, life: 0.42,
        color: this.color, width: 3
      });
      game.addShake(6, 0.25);
      if (p && !p.dead && U.dist(x, y, p.x, p.y) < radius + p.radius) {
        game.damagePlayer(damage, this);
      }
    }

    phaseCheck() {
      if (this.phase === 1 && this.hp <= this.maxHp * 0.6) {
        this.phase = 2;
        this.speedBase *= 1.22;
        this.attackCd = Math.min(this.attackCd, 0.55);
        Ink.FX.explosion(this.game, this.x, this.y, 120, this.color);
        Ink.FX.text(this.game, '二阶段 · ' + this.name + ' 动了真格', this.x, this.y - 88, '#ffd36b', 18, 1.4);
        this.game.addShake(9, 0.45);
        this.game.audio.sfx('boss');
        this.ring(24, 205, { color: '#ffd36b' });
      }
    }

    takeDamage(amount, opts = {}) {
      const dealt = super.takeDamage(amount, opts);
      this.phaseCheck();
      return dealt;
    }

    applySlow(mult, duration) {
      // Boss 有减速抗性，最高 35% 减速
      super.applySlow(Math.max(0.65, mult), duration * 0.6);
    }

    update(dt) {
      if (this.dead) return;
      this.time += dt;
      this.animTime += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.markTimer = Math.max(0, this.markTimer - dt);
      this.trappedTimer = 0; // Boss 永不被困
      this.tauntTimer = Math.max(0, this.tauntTimer - dt);
      this.contactCd = Math.max(0, this.contactCd - dt);
      this._updateTimers(dt);

      if (this.spawnTimer > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && !this.introDone) {
          this.introDone = true;
          this.game.addShake(7, 0.35);
          this.game.audio.sfx('boss');
          Ink.FX.text(this.game, this.name, this.x, this.y - 92, this.color, 22, 1.6);
          Ink.FX.text(this.game, '—— ' + this.title, this.x, this.y - 70, '#c9bfd6', 12, 1.8);
        }
        return;
      }

      const target = this.target;
      if (!target || target.dead) return;
      this.facing = target.x < this.x ? -1 : 1;

      if (this.telegraph) {
        this.telegraph.t -= dt;
        if (this.telegraph.t <= 0) {
          const fn = this.telegraph.fn;
          this.telegraph = null;
          fn();
        }
        this._clampToArena();
        return;
      }

      this.aiUpdate(dt, target);
      this._clampToArena();
      this._contact();
    }

    // ── 出招节奏 ──────────────────────────────────────────
    _tickAttack(dt, intervalScale = 1) {
      this.attackCd -= dt;
      if (this.attackCd > 0) return false;
      const floorRush = Math.max(0.72, 1 - 0.07 * (this.floor - 1));
      this.attackCd = this.conf.interval * intervalScale * floorRush * (this.phase === 2 ? 0.68 : 1);
      this.pattern++;
      return true;
    }

    aiUpdate(dt, target) {
      const fn = this[this.conf.ai];
      if (typeof fn === 'function') fn.call(this, dt, target);
      else this.orbit(dt, target, 220);
    }

    // ── 松露君：孢子环 / 召唤菌团 / 踏地 ─────────────────
    truffle(dt, target) {
      this.orbit(dt, target, 210);
      if (!this._tickAttack(dt, 1.0)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        this.ring(12, 155, { color: '#d8b07a', visual: 'spike', radius: 6 });
        this.fieldAt('poison', target.x, target.y, 60, 0.25, 2.6, { slow: 0.65 });
        this.fieldAt('poison', this.x, this.y, 70, 0.35, 2.2);
      } else if (p === 1) {
        this.windup(0.65, () => {
          this.ring(16, 180, { color: '#e0bd83' });
          this.fieldAt('poison', target.x, target.y, 68, 0.2, 2.8, { slow: 0.6 });
          this.game.audio.sfx('boss');
        }, { type: 'circle', radius: 130, color: '#d8b07a' });
      } else {
        this.spawnMinions(['slime', 'slime'], 2);
      }
    }

    // ── 环日星神：日冕弹 / 圣光场 / 环日爆发 ─────────────
    sunstar(dt, target) {
      this.orbit(dt, target, 250);
      if (!this._tickAttack(dt, 1.0)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        this.ring(14, 165, { color: '#ffd36b', radius: 6 });
        for (let i = 0; i < 4; i++) {
          this.fireAt(target, { offset: i * Math.PI / 2, speed: 210, color: '#fff0b0' });
        }
      } else if (p === 1) {
        for (let i = 0; i < 3; i++) {
          const a = U.rand(0, U.TAU);
          const d = U.rand(70, 170);
          this.fieldAt('holy', target.x + Math.cos(a) * d, target.y + Math.sin(a) * d, 58, 0.55, 2.4, { slow: 0.7 });
        }
      } else {
        this.windup(0.6, () => {
          this.ring(20, 210, { color: '#ffe08a' });
          this.aoeAt(this.x, this.y, 130, this.damage * 1.1);
        }, { type: 'circle', radius: 140, color: '#ffd36b' });
      }
    }

    // ── 九阳神君：九日轮 / 火焰地脉 / 双环 ────────────────
    ninesun(dt, target) {
      this.orbit(dt, target, 230);
      if (!this._tickAttack(dt, 0.95)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        this.ring(9, 190, { color: '#ff8a4c', radius: 7 });
        this.after(0.22, () => this.ring(9, 160, { color: '#ffd36b', offset: Math.PI / 9 }));
      } else if (p === 1) {
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * U.TAU + this.animTime;
          this.fieldAt('fire', target.x + Math.cos(a) * 70, target.y + Math.sin(a) * 70, 62, 0.3, 2.5);
        }
      } else {
        this.windup(0.7, () => {
          this.ring(18, 220, { color: '#ffb35c' });
          this.fireAt(target, { speed: 420, radius: 8, color: '#fff0b0' });
        }, { type: 'circle', radius: 120, color: '#ff8a4c' });
      }
    }

    // ── 桃柱：花雨 / 召唤花傀 / 桃柱震地 ─────────────────
    peach(dt, target) {
      this.orbit(dt, target, 220);
      if (!this._tickAttack(dt, 1.0)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        this.ring(14, 150, { color: '#ffb7c8', visual: 'petal', radius: 5 });
        this.fieldAt('bloom', target.x, target.y, 65, 0.25, 2.6, { slow: 0.55 });
      } else if (p === 1) {
        this.spawnMinions(['spider', 'spider'], 2);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04);
        Ink.FX.text(this.game, '桃柱·回春', this.x, this.y - 70, '#ffb7c8', 14, 1.0);
      } else {
        this.windup(0.7, () => {
          this.aoeAt(this.x, this.y, 145, this.damage * 1.2);
          this.ring(12, 170, { color: '#ffd0dd', visual: 'petal' });
        }, { type: 'circle', radius: 150, color: '#ff9bb0' });
      }
    }

    // ── 尾刚一郎：居合冲 / 三连斩波 / 剑环 ───────────────
    oga(dt, target) {
      if (this.dash) return this._updateDash(dt, target);
      this.orbit(dt, target, 250);
      if (!this._tickAttack(dt, 0.92)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        const a = U.angleTo(this, target);
        this.windup(0.55, () => {
          this.dash = { angle: a, speed: 540, t: 0.42, hit: false };
        }, { type: 'line', angle: a, length: 430, color: '#8f9dff' });
      } else if (p === 1) {
        for (let i = -1; i <= 1; i++) {
          this.fireAt(target, {
            offset: i * 0.2, speed: 520, radius: 8,
            visual: 'needle', color: '#b9c4ff', damage: this.damage * 0.9
          });
        }
      } else {
        this.ring(12, 190, { color: '#8f9dff', visual: 'needle' });
      }
    }

    _updateDash(dt, target) {
      const dash = this.dash;
      dash.t -= dt;
      this.x += Math.cos(dash.angle) * dash.speed * dt;
      this.y += Math.sin(dash.angle) * dash.speed * dt;
      this.walkTime += dt * 2;
      if (!dash.hit && U.dist(this.x, this.y, target.x, target.y) < this.radius + target.radius + 6) {
        dash.hit = true;
        this.game.damagePlayer(this.damage * 1.5, this);
        this.game.addShake(7, 0.25);
        Ink.FX.hit(this.game, target.x, target.y, dash.angle, '#b9c4ff', true);
      }
      if (dash.t <= 0) {
        Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 8, r1: 90, life: 0.35, color: '#8f9dff', width: 3 });
        this.dash = null;
      }
    }

    // ── 六月云之末：云雨 / 天雷 / 雾隐 ───────────────────
    june(dt, target) {
      this.orbit(dt, target, 235);
      if (!this._tickAttack(dt, 1.0)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        this.ring(12, 145, { color: '#b7d9ff', visual: 'orb', radius: 5 });
        for (let i = 0; i < 3; i++) {
          const a = U.rand(0, U.TAU);
          this.fieldAt('shadow', target.x + Math.cos(a) * 80, target.y + Math.sin(a) * 80, 56, 0.35, 2.6, { slow: 0.65 });
        }
      } else if (p === 1) {
        const a = U.angleTo(this, target);
        const bp = this.clampPoint(this.x, this.y, 40);
        Ink.FX.beam(this.game, {
          x: bp.x, y: bp.y, angle: a, length: 760, width: 18,
          warn: 0.55, active: 0.3, damage: this.damage * 1.2,
          color: '#b7d9ff', source: this
        });
        this.after(0.35, () => {
          Ink.FX.beam(this.game, {
            x: bp.x, y: bp.y, angle: a + Math.PI, length: 760, width: 18,
            warn: 0.55, active: 0.3, damage: this.damage * 1.2,
            color: '#d7ecff', source: this
          });
        });
      } else {
        const pnt = this.clampPoint(target.x - 80, target.y - 30, 60);
        Ink.FX.burst(this.game, this.x, this.y, '#b7d9ff', 16, 120, { size: 3, glow: true });
        this.x = pnt.x;
        this.y = pnt.y;
        this.ring(16, 180, { color: '#d7ecff' });
      }
    }

    // ── 伦敦塔：十字钟光 / 砖雨 / 钟摆环 ─────────────────
    tower(dt, target) {
      this.orbit(dt, target, 200);
      if (!this._tickAttack(dt, 1.05)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        for (let i = 0; i < 4; i++) {
          Ink.FX.beam(this.game, {
            x: this.x, y: this.y, angle: i * Math.PI / 2 + this.animTime * 0.2,
            length: 760, width: 16, warn: 0.6, active: 0.28,
            damage: this.damage, color: '#ffd36b', source: this
          });
        }
      } else if (p === 1) {
        for (let i = 0; i < 5; i++) {
          this.fieldAt('holy', target.x + U.rand(-90, 90), target.y + U.rand(-70, 70), 44, 0.3 + i * 0.08, 2.1);
        }
      } else {
        this.ring(10, 200, { color: '#ffd36b', visual: 'spike' });
        this.after(0.18, () => this.ring(10, 170, { color: '#fff0b0', visual: 'spike' }));
      }
    }

    // ── 大大怪：冲撞 / 落石 / 踏地 ───────────────────────
    bigmon(dt, target) {
      if (this.dash) return this._updateDash(dt, target);
      this.orbit(dt, target, 240);
      if (!this._tickAttack(dt, 1.05)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        const a = U.angleTo(this, target);
        this.windup(0.65, () => {
          this.dash = { angle: a, speed: 470, t: 0.48, hit: false };
        }, { type: 'line', angle: a, length: 470, color: '#8ef0c8' });
      } else if (p === 1) {
        for (let i = -1; i <= 1; i++) {
          this.fireAt(target, {
            offset: i * 0.22, speed: 380, radius: 10,
            visual: 'orb', color: '#b6e08a', damage: this.damage * 1.1
          });
        }
        this.fieldAt('poison', target.x, target.y, 60, 0.35, 2.2);
      } else {
        this.windup(0.7, () => {
          this.aoeAt(this.x, this.y, 155, this.damage * 1.3);
          this.ring(20, 190, { color: '#b6e08a', visual: 'spike' });
        }, { type: 'circle', radius: 160, color: '#8ef0c8' });
      }
    }

    // ── 江户十二口女：扇面 / 十二口 / 咒域 ───────────────
    edo(dt, target) {
      this.orbit(dt, target, 220);
      if (!this._tickAttack(dt, 0.9)) return;
      const p = this.pattern % 3;
      if (p === 0) {
        for (let i = -2; i <= 2; i++) {
          this.fireAt(target, {
            offset: i * 0.18, speed: 350, radius: 6,
            visual: 'spike', color: '#d3a6ff', damage: this.damage * 0.9
          });
        }
        this.after(0.16, () => {
          for (let i = -2; i <= 2; i++) {
            this.fireAt(target, {
              offset: i * 0.18 + 0.09, speed: 380, radius: 6,
              visual: 'spike', color: '#c084fc', damage: this.damage * 0.9
            });
          }
        });
      } else if (p === 1) {
        const pnt = this.clampPoint(target.x + U.rand(-120, 120), target.y + U.rand(-90, 90), 70);
        Ink.FX.burst(this.game, this.x, this.y, '#c084fc', 18, 150, { size: 3, glow: true });
        this.x = pnt.x;
        this.y = pnt.y;
        this.ring(12, 200, { color: '#d3a6ff', visual: 'spike' });
      } else {
        for (let i = 0; i < 4; i++) {
          const a = U.rand(0, U.TAU);
          this.fieldAt('shadow', target.x + Math.cos(a) * 80, target.y + Math.sin(a) * 80, 55, 0.4, 2.5, { slow: 0.55 });
        }
        this.ring(16, 150, { color: '#c084fc', visual: 'spike' });
      }
    }

    // ── 召唤小怪 ─────────────────────────────────────────
    spawnMinions(types, count) {
      const alive = this.game.enemies.filter((e) => !e.dead && !e.isBoss).length;
      if (alive >= 6) {
        this.ring(10, 160, { color: this.color });
        return;
      }
      for (let i = 0; i < count; i++) {
        const a = i / count * U.TAU + this.animTime;
        const p = this.clampPoint(this.x + Math.cos(a) * 70, this.y + Math.sin(a) * 70, 70);
        Ink.spawnEnemy(this.game, types[i % types.length] || 'slime', p.x, p.y, {
          floor: this.floor, spawnTimer: 0.6
        });
      }
      Ink.FX.text(this.game, '召来', this.x, this.y - 72, this.color, 14, 0.9);
      this.game.audio.sfx('portal');
    }

    // ── 绘制 ──────────────────────────────────────────────
    drawTelegraph(ctx, game) {
      if (!this.telegraph) return;
      const tg = this.telegraph;
      const d = tg.data || {};
      const progress = 1 - tg.t / tg.total;
      ctx.save();
      ctx.globalAlpha = 0.32 + Math.sin(game.time * 24) * 0.12;
      ctx.strokeStyle = d.color || this.color;
      ctx.fillStyle = d.color || this.color;
      ctx.lineWidth = 2;
      if (d.type === 'line') {
        const a = d.angle || 0;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(a) * (d.length || 360), this.y + Math.sin(a) * (d.length || 360));
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (d.type === 'circle') {
        const r = (d.radius || 60) * (0.5 + progress * 0.5);
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(d.x !== undefined ? d.x : this.x, d.y !== undefined ? d.y : this.y, r, 0, U.TAU);
        ctx.stroke();
        ctx.globalAlpha *= 0.15;
        ctx.beginPath();
        ctx.arc(d.x !== undefined ? d.x : this.x, d.y !== undefined ? d.y : this.y, r, 0, U.TAU);
        ctx.fill();
        ctx.setLineDash([]);
      } else if (d.type === 'cross') {
        ctx.setLineDash([12, 8]);
        const cx = d.x !== undefined ? d.x : this.x;
        const cy = d.y !== undefined ? d.y : this.y;
        ctx.beginPath();
        ctx.moveTo(cx - 240, cy); ctx.lineTo(cx + 240, cy);
        ctx.moveTo(cx, cy - 240); ctx.lineTo(cx, cy + 240);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    draw(ctx, game) {
      if (this.dead) return;
      const bob = Math.sin(this.animTime * 2.4) * 3;
      const alpha = this.spawnTimer > 0 ? U.clamp(1 - this.spawnTimer / 1.35, 0.2, 1) : 1;

      ctx.save();
      ctx.globalAlpha = 0.4 * alpha;
      ctx.fillStyle = '#040308';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.radius * 0.75, this.radius * 1.1, this.radius * 0.4, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.1 + Math.sin(this.animTime * 3) * 0.03) * alpha;
      const g = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, this.radius * 2.4);
      g.addColorStop(0, this.phase === 2 ? '#ff8a6a' : this.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 2.4, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      this.drawTelegraph(ctx, game);

      if (this.spawnTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -game.time * 36;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 20 + Math.sin(game.time * 4) * 6, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      const frame = Math.floor(this.walkTime * 3.4 + this.animTime) % 2;
      Ink.Art.drawSprite(ctx, 'boss:' + this.id, this.x, this.y + bob, this.scale, {
        frame, flip: this.facing < 0, alpha
      });
      if (this.hitFlash > 0) {
        Ink.Art.drawSprite(ctx, 'boss:' + this.id, this.x, this.y + bob, this.scale, {
          frame, flip: this.facing < 0, alpha: 0.4, tint: '#ffffff'
        });
      }

      if (this.phase === 2) {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(game.time * 6) * 0.25;
        ctx.fillStyle = '#ffb27a';
        ctx.font = 'bold 11px "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('狂', this.x, this.y - this.radius - 30);
        ctx.restore();
      }

      if (this.inkStacks > 0) {
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i < this.inkStacks ? '#e05a55' : 'rgba(120,90,100,.3)';
          ctx.fillRect(this.x - 15 + i * 7, this.y + this.radius + 12, 5, 5);
        }
      }
      if (this.markTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#ff6f9c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 14 + Math.sin(game.time * 5) * 3, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.bossTimers.length = 0;
      const game = this.game;
      for (let i = 0; i < 8; i++) {
        const a = U.rand(0, U.TAU);
        const r = U.rand(0, this.radius);
        Ink.FX.explosion(game, this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, U.rand(24, 62), i % 2 ? this.color : '#ffd36b');
      }
      Ink.FX.burst(game, this.x, this.y, [this.color, '#fff6e7', '#ffd36b'], 54, 280, {
        size: 5, glow: true, lifeMult: 1.6, gravity: 30
      });
      Ink.FX.ring(game, { x: this.x, y: this.y, r0: 20, r1: 170, life: 0.9, color: '#fff6e7', width: 5 });
      game.audio.sfx('bossDie');
      game.addShake(16, 0.9);
      game.dropXp(this.x, this.y, this.xpValue);
      game.onEnemyKilled(this, { boss: true });
      game.onBossDefeated(this);
    }
  }

  Ink.Boss = Boss;
  Ink.Bosses = BOSSES;
  Ink.spawnBoss = function (game, id, x, y) {
    const b = new Boss(game, id, x, y);
    game.enemies.push(b);
    game.boss = b;
    return b;
  };
})();
