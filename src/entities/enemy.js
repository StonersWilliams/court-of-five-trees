/**
 * src/entities/enemy.js
 * ------------------------------------------------------------
 * 六种普通敌人 + 精英变体 + 通用 AI / 状态系统。
 *
 * 新增敌人步骤：
 *   1. 在 TYPES 里登记数值；
 *   2. 在 pixelart.js 的 ENEMY_BUILDERS 里画 16x16 两帧；
 *   3. 在 switch(this.def.ai) 中写行为（或复用已有行为）。
 *
 * 状态：减速、字印、标记、被嘲讽、被字狱困住、击退、受击闪白、出生保护。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  const TYPES = {
    slime: {
      id: 'slime', name: '墨团', hp: 34, speed: 76, damage: 3, radius: 15, xp: 5,
      scale: 3, ai: 'slime', color: '#4fbf94', role: '近战·追击',
      desc: '从地砖缝里挤出的墨苔，会蹦跳着扑向活物。'
    },
    skull: {
      id: 'skull', name: '飞颅', hp: 30, speed: 66, damage: 2, radius: 14, xp: 6,
      scale: 3, ai: 'shooter', color: '#65d7ff', role: '远程·漂浮',
      desc: '被墨渊吐出的旧日头骨，远远地投掷幽蓝魂火。'
    },
    gargoyle: {
      id: 'gargoyle', name: '石像鬼', hp: 94, speed: 38, damage: 5, radius: 20, xp: 10,
      scale: 4, ai: 'charger', color: '#ff8a5c', role: '重装·冲撞',
      desc: '石壳里封着未熄的怒火，蓄力后会直线冲撞。'
    },
    spider: {
      id: 'spider', name: '影蛛', hp: 27, speed: 112, damage: 2, radius: 13, xp: 5,
      scale: 3, ai: 'lunger', color: '#ff5c7a', role: '高速·突袭',
      desc: '沿着影子爬行的猎手，会突然缩短距离。'
    },
    tome: {
      id: 'tome', name: '咒书', hp: 42, speed: 44, damage: 3, radius: 15, xp: 8,
      scale: 3, ai: 'blinker', color: '#c084fc', role: '法术·闪现',
      desc: '无人翻动的书页自己吟唱，并撒出环形咒文。'
    },
    guard: {
      id: 'guard', name: '枪俑', hp: 72, speed: 55, damage: 4, radius: 17, xp: 9,
      scale: 3, ai: 'lancer', color: '#ffb35c', role: '远程·穿刺',
      desc: '陪葬的持枪陶俑，会用一道笔直的枪气封锁走位。'
    },
    moth: {
      id: 'moth', name: '纸蛾', hp: 38, speed: 82, damage: 3, radius: 14, xp: 7,
      scale: 3, ai: 'fan', color: '#c7b6ff', role: '远程·扇射',
      desc: '从旧书页里抖落的纸蛾，会突然展开三枚鳞粉扇面。'
    },
    bell: {
      id: 'bell', name: '铜铃傀', hp: 68, speed: 40, damage: 4, radius: 17, xp: 10,
      scale: 3, ai: 'pulse', color: '#d8c07a', role: '远程·震荡',
      desc: '无风自响的铜铃，每走一步都在地上压出一圈音浪。'
    },
    rat: {
      id: 'rat', name: '书蠹', hp: 24, speed: 148, damage: 2, radius: 11, xp: 5,
      scale: 2.6, ai: 'lunger', color: '#a98b6a', role: '高速·骚扰',
      desc: '啃穿书脊的小蠹虫，会贴着地面突然弹射咬人。'
    }
  };

  const AI_LABELS = {
    slime: '墨团', shooter: '飞颅', charger: '石像鬼',
    lunger: '影蛛', blinker: '咒书', lancer: '枪俑',
    fan: '纸蛾', pulse: '铜铃傀', rat: '书蠹'
  };

  class Enemy {
    constructor(game, type, x, y, opts = {}) {
      const def = TYPES[type];
      if (!def) throw new Error('未知敌人类型: ' + type);
      this.game = game;
      this.def = def;
      this.type = type;
      this.x = x;
      this.y = y;
      this.elite = !!opts.elite;
      this.boss = false;
      this.floor = opts.floor || game.floor || 1;
      this.radius = def.radius + (this.elite ? 2 : 0);
      this.scale = def.scale + (this.elite ? 0.35 : 0);
      this.maxHp = def.hp * (1 + 0.60 * (this.floor - 1)) * (this.elite ? 1.9 : 1);
      this.hp = this.maxHp;
      this.speedBase = def.speed * (1 + 0.022 * (this.floor - 1)) * (this.elite ? 0.94 : 1);
      this.damage = Math.min(15, def.damage * (1 + 0.20 * (this.floor - 1)) * (this.elite ? 1.2 : 1));
      this.xpValue = Math.round((def.xp + this.floor) * (this.elite ? 2.2 : 1));
      this.color = def.color;
      this.spawnTimer = opts.spawnTimer === undefined ? 0.5 : opts.spawnTimer;
      this.time = U.rand(0, 10);
      this.walkTime = 0;
      this.dead = false;
      this.state = 'idle';
      this.stateTimer = 0;
      this.attackCd = U.rand(0.8, 1.8);
      this.contactCd = 0;
      this.teleportCd = U.rand(2.8, 4.2);
      this.aimAngle = 0;
      this.hitFlash = 0;
      this.facing = 1;
      this.aggro = false;
      this.knockVx = 0;
      this.knockVy = 0;

      // 状态效果
      this.slowTimer = 0;
      this.slowMult = 1;
      this.markTimer = 0;
      this.vulnTimer = 0;
      this.inkStacks = 0;
      this.trappedTimer = 0;
      this.tauntTimer = 0;
      this.tauntTarget = null;
      this.stunTimer = 0;
      this.burnTimer = 0;
      this.burnDps = 0;
      this._burnTick = 0;

      // 精英光环 / 出场
      this.spawnFx = opts.spawnFx !== false;
      if (this.spawnFx) {
        Ink.FX.spawnPortal(game, x, y, this.elite ? PAL.gold : this.color, this.spawnTimer);
      }
    }

    get target() {
      const g = this.game;
      if (this.tauntTimer > 0 && this.tauntTarget && this.tauntTarget.alive) return this.tauntTarget;
      return g.player;
    }

    get maxSpeed() {
      return this.speedBase * (this.slowTimer > 0 ? this.slowMult : 1);
    }

    update(dt) {
      if (this.dead) return;
      this.time += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.markTimer = Math.max(0, this.markTimer - dt);
      this.vulnTimer = Math.max(0, this.vulnTimer - dt);
      this.trappedTimer = Math.max(0, this.trappedTimer - dt);
      this.tauntTimer = Math.max(0, this.tauntTimer - dt);
      this.burnTimer = Math.max(0, this.burnTimer - dt);
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      this.contactCd = Math.max(0, this.contactCd - dt);

      if (this.spawnTimer > 0) {
        this.spawnTimer -= dt;
        return;
      }

      // 余烬：持续伤害每 0.5 秒结算一次
      if (this.burnTimer > 0 && this.burnDps > 0) {
        this._burnTick += dt;
        if (this._burnTick >= 0.5) {
          this._burnTick -= 0.5;
          this.takeDamage(this.burnDps * 0.5, {
            source: 'passive', sourceKey: 'burn', color: '#ff9a5c', silent: true
          });
          if (this.dead) return;
        }
      }

      // 击退
      if (Math.abs(this.knockVx) + Math.abs(this.knockVy) > 1) {
        this.x += this.knockVx * dt;
        this.y += this.knockVy * dt;
        this.knockVx *= Math.max(0, 1 - 9 * dt);
        this.knockVy *= Math.max(0, 1 - 9 * dt);
      }

      if (this.trappedTimer > 0 || this.stunTimer > 0) {
        this._clampToArena();
        return;
      }

      this.walkTime += dt;
      const target = this.target;
      if (!target || target.dead) return;
      if (target.x < this.x) this.facing = -1;
      else if (target.x > this.x) this.facing = 1;

      switch (this.def.ai) {
        case 'slime': this._aiSlime(dt, target); break;
        case 'shooter': this._aiShooter(dt, target); break;
        case 'charger': this._aiCharger(dt, target); break;
        case 'lunger': this._aiLunger(dt, target); break;
        case 'blinker': this._aiBlinker(dt, target); break;
        case 'lancer': this._aiLancer(dt, target); break;
        case 'fan': this._aiFan(dt, target); break;
        case 'pulse': this._aiPulse(dt, target); break;
        default: this._aiSlime(dt, target); break;
      }

      this._clampToArena();
      this._contact(dt);
    }

    _clampToArena() {
      const A = Ink.ARENA;
      const inset = 14 + this.radius * 0.25;
      this.x = U.clamp(this.x, A.x + inset, A.x + A.w - inset);
      this.y = U.clamp(this.y, A.y + inset, A.y + A.h - inset);
    }

    _moveToward(target, speed, dt, stopDist = 0) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= stopDist) return;
      const nx = dx / d, ny = dy / d;
      this.x += nx * speed * dt;
      this.y += ny * speed * dt;
    }

    _moveAway(target, speed, dt) {
      const dx = this.x - target.x;
      const dy = this.y - target.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * speed * dt;
      this.y += dy / d * speed * dt;
    }

    _strafe(target, speed, dt, dir) {
      const a = U.angleTo(this, target) + (Math.PI / 2) * dir;
      this.x += Math.cos(a) * speed * dt;
      this.y += Math.sin(a) * speed * dt;
    }

    _contact() {
      if (this.contactCd > 0) return;
      const target = this.target;
      const isDog = target && target === this.game.dog;
      if (!target || target.dead) return;
      if (!U.circleOverlap(this.x, this.y, this.radius + 2, target.x, target.y, target.radius)) return;
      this.contactCd = 0.8;
      if (isDog) {
        target.takeDamage(this.damage * 0.8);
      } else {
        this.game.damagePlayer(this.damage, this);
      }
    }

    // ── 墨团：有节奏地弹跳追击 ────────────────────────────
    _aiSlime(dt, target) {
      const hop = 0.25 + Math.abs(Math.sin(this.time * 3.4)) * 1.05;
      this._moveToward(target, this.maxSpeed * hop, dt, this.radius + 2);
    }

    // ── 飞颅：保持中距并发射魂火 ──────────────────────────
    _aiShooter(dt, target) {
      const d = U.dist(this.x, this.y, target.x, target.y);
      if (d < 160) this._moveAway(target, this.maxSpeed, dt);
      else if (d > 285) this._moveToward(target, this.maxSpeed, dt);
      else this._strafe(target, this.maxSpeed * 0.6, dt, Math.sin(this.time * 0.7) > 0 ? 1 : -1);

      this.attackCd -= dt;
      if (this.attackCd <= 0 && d < 420) {
        this.attackCd = U.rand(1.9, 2.5) * (this.elite ? 0.78 : 1);
        const a = U.angleTo(this, target);
        const count = this.elite ? 3 : (this.floor >= 3 ? 2 : 1);
        const spread = count > 1 ? 0.28 : 0;
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? 0 : i - (count - 1) / 2;
          Ink.fire(this.game, {
            x: this.x, y: this.y - 5,
            angle: a + t * spread,
            speed: 210 + this.floor * 9,
            damage: this.damage,
            radius: 4,
            color: this.color,
            owner: 'enemy',
            source: this,
            visual: 'orb',
            life: 3
          });
        }
        this.game.audio.sfx('shoot');
      }
    }

    // ── 石像鬼：预警后直线冲撞 ────────────────────────────
    _aiCharger(dt, target) {
      if (this.state === 'windup') {
        this.stateTimer -= dt;
        this.aimAngle = U.angleTo(this, target);
        if (this.stateTimer <= 0) {
          this.state = 'charge';
          this.stateTimer = 0.42;
          this.game.audio.sfx('dash');
          this.game.addShake(3, 0.12);
        }
        return;
      }
      if (this.state === 'charge') {
        this.stateTimer -= dt;
        this.x += Math.cos(this.aimAngle) * 440 * dt;
        this.y += Math.sin(this.aimAngle) * 440 * dt;
        this._clampToArena();
        this._contact();
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.attackCd = U.rand(2.4, 3.3);
          Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 8, r1: 46, life: 0.3, color: this.color, width: 3 });
        }
        return;
      }

      this._moveToward(target, this.maxSpeed, dt, this.radius + 12);
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.state = 'windup';
        this.stateTimer = 0.7;
        this.aimAngle = U.angleTo(this, target);
      }
    }

    // ── 影蛛：短前摇扑击 ──────────────────────────────────
    _aiLunger(dt, target) {
      if (this.state === 'windup') {
        this.stateTimer -= dt;
        this.aimAngle = U.angleTo(this, target);
        if (this.stateTimer <= 0) {
          this.state = 'lunge';
          this.stateTimer = 0.26;
          this.game.audio.sfx('dash');
        }
        return;
      }
      if (this.state === 'lunge') {
        this.stateTimer -= dt;
        this.x += Math.cos(this.aimAngle) * 460 * dt;
        this.y += Math.sin(this.aimAngle) * 460 * dt;
        this._clampToArena();
        this._contact();
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.attackCd = U.rand(1.35, 1.9);
        }
        return;
      }
      this._moveToward(target, this.maxSpeed, dt, this.radius + 6);
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.state = 'windup';
        this.stateTimer = 0.26;
        this.aimAngle = U.angleTo(this, target);
      }
    }

    // ── 咒书：闪现 + 环形咒文 ─────────────────────────────
    _aiBlinker(dt, target) {
      const d = U.dist(this.x, this.y, target.x, target.y);
      if (d > 250) this._moveToward(target, this.maxSpeed, dt);
      else if (d < 150) this._moveAway(target, this.maxSpeed, dt);
      else this._strafe(target, this.maxSpeed * 0.8, dt, Math.sin(this.time) > 0 ? 1 : -1);

      this.teleportCd -= dt;
      if (this.teleportCd <= 0) {
        this.teleportCd = U.rand(4, 5.5);
        if (d < 200) {
          Ink.FX.burst(this.game, this.x, this.y, '#c084fc', 10, 110, { size: 3, glow: true });
          const A = Ink.ARENA;
          let tries = 0;
          let nx = this.x, ny = this.y;
          while (tries++ < 20) {
            nx = U.rand(A.x + 90, A.x + A.w - 90);
            ny = U.rand(A.y + 80, A.y + A.h - 80);
            if (U.dist(nx, ny, target.x, target.y) > 230) break;
          }
          this.x = nx; this.y = ny;
          this.attackCd = Math.min(this.attackCd, 0.3);
          Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 8, r1: 44, life: 0.35, color: '#c084fc', width: 3 });
          this.game.audio.sfx('dash');
        }
      }

      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = U.rand(2.2, 3.0);
        const n = this.elite ? 8 : (this.floor >= 3 ? 6 : 5);
        const offset = U.rand(0, U.TAU);
        Ink.radial(this.game, this.x, this.y, n, 135 + this.floor * 5, {
          damage: this.damage, radius: 4, color: '#c084fc', owner: 'enemy',
          source: this, visual: 'orb', life: 3.4, offset
        });
        this.game.audio.sfx('shoot');
      }
    }

    // ── 纸蛾：三枚鳞粉扇面 ────────────────────────────────
    _aiFan(dt, target) {
      const d = U.dist(this.x, this.y, target.x, target.y);
      if (this.state === 'windup') {
        this.stateTimer -= dt;
        this.aimAngle = U.angleTo(this, target);
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.attackCd = U.rand(1.6, 2.0);
          Ink.spread(this.game, this.x, this.y, this.aimAngle, 3, 0.34, {
            owner: 'enemy', source: this, damage: this.damage,
            speed: 205, radius: 4, color: this.color, visual: 'petal', life: 2.4
          });
          Ink.FX.burst(this.game, this.x, this.y, this.color, 6, 70, { size: 2, glow: true });
        }
        return;
      }
      if (d > 260) this._moveToward(target, this.maxSpeed, dt);
      else if (d < 160) this._moveAway(target, this.maxSpeed, dt);
      else this._strafe(target, this.maxSpeed * 0.7, dt, Math.sin(this.time) > 0 ? 1 : -1);
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.state = 'windup';
        this.stateTimer = 0.42;
        this.aimAngle = U.angleTo(this, target);
      }
    }

    // ── 铜铃傀：先摇铃，再放环形音浪 ──────────────────────
    _aiPulse(dt, target) {
      const d = U.dist(this.x, this.y, target.x, target.y);
      if (this.state === 'windup') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.attackCd = U.rand(2.4, 3.0);
          Ink.radial(this.game, this.x, this.y, 8, 150, {
            owner: 'enemy', source: this, damage: this.damage,
            radius: 4, color: this.color, visual: 'orb', life: 2.8
          });
          Ink.FX.ring(this.game, {
            x: this.x, y: this.y, r0: 8, r1: 74, life: 0.35,
            color: this.color, width: 3
          });
          this.game.audio.sfx('skill');
        }
        return;
      }
      if (d > 210) this._moveToward(target, this.maxSpeed, dt);
      else if (d < 120) this._moveAway(target, this.maxSpeed * 0.7, dt);
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.state = 'windup';
        this.stateTimer = 0.62;
        Ink.FX.ring(this.game, {
          x: this.x, y: this.y, r0: 6, r1: 52, life: 0.55,
          color: this.color, width: 2
        });
      }
    }

    // ── 枪俑：保持距离，枪气封路 ──────────────────────────
    _aiLancer(dt, target) {
      const d = U.dist(this.x, this.y, target.x, target.y);
      if (d < 190) this._moveAway(target, this.maxSpeed, dt);
      else if (d > 330) this._moveToward(target, this.maxSpeed, dt);
      else this._strafe(target, this.maxSpeed * 0.35, dt, Math.sin(this.time * 0.55) > 0 ? 1 : -1);

      this.attackCd -= dt;
      if (this.attackCd <= 0 && d < 400) {
        this.attackCd = U.rand(2.3, 3.0);
        const a = U.angleTo(this, target);
        const length = Math.min(390, U.dist(this.x, this.y, target.x, target.y) + 80);
        Ink.FX.beam(this.game, {
          x: this.x, y: this.y - 4, angle: a, length,
          width: 9, warn: 0.55, active: 0.16, damage: this.damage,
          color: this.color, source: this
        });
        this.game.audio.sfx('skill');
      }
    }

    // ── 伤害与状态 ────────────────────────────────────────
    takeDamage(amount, opts = {}) {
      if (this.dead || this.spawnTimer > 0) return 0;
      amount = Math.max(1, amount);
      this.hp -= amount;
      this.hitFlash = 0.09;
      this.aggro = true;
      const color = opts.color || (opts.crit ? '#ffd36b' : '#fff6e7');
      Ink.FX.damageNumber(this.game, this.x, this.y - this.radius, amount, color, opts.crit);
      if (opts.knockback && this.radius < 30) {
        const a = opts.angle !== undefined ? opts.angle : U.angleTo(this.game.player, this);
        this.knockVx += Math.cos(a) * opts.knockback;
        this.knockVy += Math.sin(a) * opts.knockback;
      }
      if (this.hp <= 0) {
        this.die(opts);
        return amount;
      }
      this.game.audio.sfx('hit');
      return amount;
    }

    die(opts = {}) {
      if (this.dead) return;
      this.dead = true;
      const game = this.game;
      const color = this.elite ? PAL.gold : this.color;
      Ink.FX.burst(game, this.x, this.y, [color, '#fff6e7', '#2a1f35'], this.elite ? 26 : 16, 220, {
        size: 4, glow: true, gravity: 40, lifeMult: 1.2
      });
      Ink.FX.ring(game, { x: this.x, y: this.y, r0: 5, r1: this.elite ? 62 : 42, life: 0.4, color, width: 3 });
      game.audio.sfx('kill');
      game.dropXp(this.x, this.y, this.xpValue);
      game.onEnemyKilled(this, opts);
      game.addShake(this.elite ? 4 : 2, 0.12);
    }

    applySlow(mult = 0.5, duration = 1.5) {
      // 取更强的减速；持续时间取最长
      if (mult < this.slowMult || this.slowTimer <= 0) this.slowMult = Math.min(this.slowMult, mult);
      this.slowTimer = Math.max(this.slowTimer, duration);
    }

    applyMark(duration = 5) {
      this.markTimer = Math.max(this.markTimer, duration);
    }

    applyBurn(duration = 2, dps = 4) {
      this.burnTimer = Math.max(this.burnTimer, duration);
      this.burnDps = Math.max(this.burnDps || 0, dps);
    }

    applyInkStack(fromPlayer = true) {
      if (this.inkStacks < 5) {
        this.inkStacks++;
        if (this.inkStacks >= 5) {
          this.applySlow(0.65, 1.6);
          Ink.FX.ring(this.game, {
            x: this.x, y: this.y, r0: 10, r1: 42, life: 0.3,
            color: '#e05a55', width: 2
          });
          Ink.FX.text(this.game, '墨印·封', this.x, this.y - 42, '#ff9b90', 13, 0.6);
        }
      } else {
        // 满层后继续命中会刷新减速
        this.applySlow(0.65, 1.5);
      }
      return this.inkStacks;
    }

    taunt(duration, dog) {
      this.tauntTimer = Math.max(this.tauntTimer, duration);
      this.tauntTarget = dog;
    }

    // ── 绘制 ──────────────────────────────────────────────
    draw(ctx, game) {
      if (this.dead) return;
      const bob = Math.sin(this.time * 3.6) * 1.6;
      const moving = this.spawnTimer <= 0 && this.trappedTimer <= 0;
      const frame = moving ? (Math.floor(this.walkTime * 5 + this.time) % 2) : 0;
      const alpha = this.spawnTimer > 0 ? U.clamp(1 - this.spawnTimer / 0.5, 0, 1) * 0.7 + 0.2 : 1;

      // 影子
      ctx.save();
      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = '#050409';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.radius * 0.85, this.radius * 0.9, this.radius * 0.38, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // 精英光环
      if (this.elite) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.12 + Math.sin(this.time * 3) * 0.04;
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, this.radius * 2, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // 嘲讽目标标记
      if (this.tauntTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ff7d6e';
        ctx.font = 'bold 15px "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', this.x, this.y - this.radius - 28);
        ctx.restore();
      }

      // 蓄力预警线
      if (this.state === 'windup') {
        const isCharge = this.def.ai === 'charger';
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(game.time * 26) * 0.12;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = isCharge ? 7 : 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.aimAngle) * (isCharge ? 280 : 170),
          this.y + Math.sin(this.aimAngle) * (isCharge ? 280 : 170));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 减速光环
      if (this.slowTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#7fd8ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      Ink.Art.drawSprite(ctx, 'enemy:' + this.type, this.x, this.y + bob, this.scale, {
        frame,
        flip: this.facing < 0,
        alpha,
        tint: this.hitFlash > 0 ? '#ffffff' : null
      });

      // 受击闪白：叠加一层较淡的白剪影
      if (this.hitFlash > 0) {
        Ink.Art.drawSprite(ctx, 'enemy:' + this.type, this.x, this.y + bob, this.scale, {
          frame, flip: this.facing < 0, alpha: 0.55, tint: '#ffffff'
        });
      }

      // 字印层数
      if (this.inkStacks > 0) {
        for (let i = 0; i < 5; i++) {
          const filled = i < this.inkStacks;
          ctx.fillStyle = filled ? '#e05a55' : 'rgba(120,90,100,.35)';
          ctx.fillRect(this.x - 14 + i * 6, this.y + this.radius + 7, 4, 4);
          if (filled) {
            ctx.fillStyle = '#ffd2c4';
            ctx.fillRect(this.x - 13 + i * 6, this.y + this.radius + 8, 1, 1);
          }
        }
      }

      // 刺客标记
      if (this.markTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(game.time * 8) * 0.2;
        ctx.strokeStyle = '#ff6f9c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, this.radius + 10 + Math.sin(game.time * 5) * 2, 0, U.TAU);
        ctx.stroke();
        ctx.fillStyle = '#ff6f9c';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✕', this.x, this.y - this.radius - 13);
        ctx.restore();
      }

      // 精英小王冠
      if (this.elite) {
        ctx.save();
        const cy = this.y - this.radius - 26;
        ctx.fillStyle = '#e8c170';
        ctx.fillRect(this.x - 7, cy, 3, 3);
        ctx.fillRect(this.x - 1, cy - 3, 3, 6);
        ctx.fillRect(this.x + 5, cy, 3, 3);
        ctx.fillStyle = '#f7df9c';
        ctx.fillRect(this.x - 8, cy + 3, 17, 2);
        ctx.restore();
      }

      // 血条（精英或已受伤）
      if (this.elite || this.hp < this.maxHp) {
        const w = Math.max(34, this.radius * 2.2);
        const h = this.elite ? 5 : 3;
        const px = this.x - w / 2;
        const py = this.y - this.radius - 16;
        ctx.fillStyle = 'rgba(5,4,10,.85)';
        ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
        ctx.fillStyle = this.elite ? PAL.gold : '#d94f5c';
        ctx.fillRect(px, py, w * U.clamp(this.hp / this.maxHp, 0, 1), h);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(px, py, w * U.clamp(this.hp / this.maxHp, 0, 1), 1);
      }
    }

    /** UI 或 Boss 类复用的数据显示 */
    hpRatio() { return U.clamp(this.hp / this.maxHp, 0, 1); }
  }

  function spawnEnemy(game, type, x, y, opts = {}) {
    const e = new Enemy(game, type, x, y, opts);
    game.enemies.push(e);
    return e;
  }

  Ink.Enemy = Enemy;
  Ink.EnemyTypes = TYPES;
  Ink.AI_LABELS = AI_LABELS;
  Ink.spawnEnemy = spawnEnemy;
})();
