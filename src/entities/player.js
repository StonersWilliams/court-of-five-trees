/**
 * src/entities/player.js
 * ------------------------------------------------------------
 * 玩家实体：移动、瞄准、普攻、技能冷却、生命/护甲、经验与升级。
 * 角色差异全部委托给 player.char（角色实例）处理。
 *
 * 关键约定：
 *   - 桌面：WASD 移动，鼠标瞄准，左键普攻，空格 / 右键主动技能。
 *   - 触屏：game.touchMode = true，自动锁定最近敌人并自动开火；
 *           移动与技能由 game 的虚拟摇杆 / 按钮设置。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  // 每个角色的初始兵刃：后续仍可自由更换/丢弃，不锁死职业。
  const STARTING_WEAPON = {
    qiyun: 'chunqiu',
    xiaoying: 'judgebrush',
    xinyue: 'mirror',
    ziyu: 'seal',
    smartdog: 'puppet'
  };

  class Player {
    constructor(game, charId) {
      this.game = game;
      this.charId = charId;
      this.def = Ink.Characters[charId];
      if (!this.def) throw new Error('未知角色: ' + charId);
      this.char = Ink.createCharacter(charId, this, game);

      this.x = Ink.ARENA.x + Ink.ARENA.w / 2;
      this.y = Ink.ARENA.y + Ink.ARENA.h / 2 + 40;
      this.radius = 14;
      this.facing = 1;
      this.aimAngle = -Math.PI / 2;
      this.dead = false;
      this.hitFlash = 0;
      this.invuln = 1.0;
      this.walkTime = 0;
      this.time = 0;

      // 面板基础值
      this.baseMaxHp = this.def.hp;
      this.baseArmor = this.def.armor;
      this.baseSpeed = this.def.speed;
      this.baseDamage = this.def.damage;
      this.baseAtkInterval = this.def.atkInterval;
      this.baseCooldown = this.def.cooldown;

      this.level = 1;
      this.xp = 0;
      this.xpNext = 10;
      this.upgrades = { damage: 0, atkSpeed: 0, cooldown: 0, speed: 0, survival: 0 };

      this.maxHp = this.baseMaxHp;
      this.hp = this.maxHp;
      this.maxArmor = this.baseArmor;
      this.armor = this.maxArmor;
      this.armorRegenTimer = 0;
      this.speed = this.baseSpeed;
      this.damage = this.baseDamage;
      this.atkInterval = this.baseAtkInterval;
      this.atkCd = 0;
      this.critChance = 0.08;

      this.skillCdMax = this.baseCooldown;
      this.skillCd = 0;
      this.slowTimer = 0;
      this.slowMult = 1;

      // ── 武器 / 局内资源 / 机制被动 ──────────────────────
      this.weaponId = STARTING_WEAPON[charId] || 'flintlock';
      this.weaponCd = 0;
      this.weaponCdMax = this.weapon ? this.weapon.cooldown : 1;
      this.weaponRecoil = 0;
      this.weaponFlash = 0;
      this.skillFlash = 0;
      this.coins = 0;
      this.passives = [];
      this.bonusBounce = 0;
      this.wallBounce = 0;
      this.thorn = 0;
      this.leech = 0;
      this.pickupRadius = 34;
      this.frostHits = false;
      this.emberHits = false;
      this.nova = false;
      this.critBurst = false;
      this.overcharge = false;
      this.overchargeHits = 0;
      this.coinMult = 1;
      this.lastStand = false;
      this.guardian = false;
      this.swift = false;
      this.swiftTimer = 0;

      // 兵器专属节奏：连段、蓄力、变身与临时增益
      this.weaponShots = 0;
      this.weaponHits = 0;
      this.maskTimer = 0;
      this.mirrorTimer = 0;
      this.mirrorCharges = 0;
      this.diceTimer = 0;
      this.diceMode = '';
      this.compassTarget = null;

      this._prevRight = false;
      this.char.onSpawn();
    }

    get weapon() {
      return Ink.WeaponDefs ? Ink.WeaponDefs[this.weaponId] : null;
    }

    // ── 属性与升级 ────────────────────────────────────────
    // 局内不再成长基础属性：生命/护甲/移速来自角色面板，
    // 输出完全由当前武器提供；升级只给机制被动。
    recomputeStats(healDelta = false) {
      const oldMax = this.maxHp;
      const oldArmorMax = this.maxArmor;

      this.maxHp = Math.round(this.baseMaxHp);
      this.maxArmor = Math.round(this.baseArmor);
      this.speed = this.baseSpeed;
      this.damage = this.baseDamage;
      this.atkInterval = this.baseAtkInterval;
      this.skillCdMax = this.baseCooldown;

      if (healDelta) this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMax));
      this.hp = Math.min(this.hp, this.maxHp);
      if (this.maxArmor > oldArmorMax) this.armor = Math.min(this.maxArmor, this.armor + (this.maxArmor - oldArmorMax));
      this.armor = Math.min(this.armor, this.maxArmor);
      this.skillCd = Math.min(this.skillCd, this.skillCdMax);
    }

    /** 兼容旧接口；新版本不再提供基础属性升级。 */
    applyUpgrade(kind) {
      return false;
    }

    // ── 武器 / 被动 / 金币 ──────────────────────────────
    /**
     * 装备武器。默认把旧武器丢在脚下，避免“到手就消失”。
     * opts.silent 用于空手回退等内部切换。
     */
    equipWeapon(id, opts = {}) {
      const def = Ink.WeaponDefs && Ink.WeaponDefs[id];
      if (!def) return false;
      const oldId = this.weaponId;
      this.weaponId = id;
      this.weaponCdMax = def.cooldown;
      this.weaponCd = Math.min(this.weaponCd, 0.18);
      this.weaponRecoil = 0.7;
      this.weaponFlash = 0.06;

      if (opts.dropCurrent && oldId && oldId !== id && !opts.silent) {
        // 旧枪落在身后 66px，避免刚换枪就被自动捡回。
        this.dropWeaponAt(
          oldId,
          this.x - Math.cos(this.aimAngle) * 66,
          this.y - Math.sin(this.aimAngle) * 66,
          false
        );
      }
      if (!opts.silent && this.game && this.game.ui) {
        this.game.ui.showToast('装备 · ' + def.name, def.color || '#e8c170', 2.0);
      }
      if (this.game && this.game.audio) this.game.audio.sfx('skillReady');
      return true;
    }

    /** 把指定武器作为地面掉落物放到场景里。 */
    dropWeaponAt(id, x, y, scatter = true) {
      if (!id || id === 'fists' || !this.game) return null;
      return this.game.dropWeaponPickup(id, x, y, scatter);
    }

    /** G / 触屏“丢”按钮：丢下当前武器并空手。 */
    dropWeapon() {
      if (!this.weapon || this.weaponId === 'fists') return false;
      const id = this.weaponId;
      // 丢在准星方向 66px：玩家需要走一步才能重新捡起，避免原地无限交换。
      this.dropWeaponAt(
        id,
        this.x + Math.cos(this.aimAngle) * 66,
        this.y + Math.sin(this.aimAngle) * 66,
        false
      );
      this.weaponId = 'fists';
      this.weaponCdMax = 0.45;
      this.weaponCd = 0.2;
      if (this.game && this.game.ui) {
        this.game.ui.showToast('已丢下兵刃 · 空手作战', '#ffb35c', 1.6);
      }
      return true;
    }

    hasPassive(id) {
      return this.passives.indexOf(id) !== -1;
    }

    applyPassive(id) {
      if (this.hasPassive(id)) return false;
      const def = Ink.Passives && Ink.Passives[id];
      if (!def) return false;
      this.passives.push(id);
      if (typeof def.apply === 'function') def.apply(this);
      return true;
    }

    addCoins(amount) {
      if (!amount) return;
      if (amount < 0) {
        this.coins = Math.max(0, this.coins + amount);
        return;
      }
      const gain = Math.max(1, Math.round(amount * this.coinMult));
      this.coins += gain;
      Ink.FX.text(this.game, '+' + gain + ' 金币', this.x, this.y - 38, '#ffd36b', 12, 0.8);
      this.game.audio.sfx('pickup');
    }

    damageMultiplier() {
      if (this.lastStand && this.hp < this.maxHp * 0.35) return 1.3;
      return 1;
    }

    _weaponCooldown() {
      return this.weaponCdMax;
    }

    updateWeapon(dt) {
      this.weaponCd = Math.max(0, this.weaponCd - dt);
      if (this.dead || this.weaponCd > 0) return;
      if (!this.wantFire()) return;
      this.fireWeapon();
    }

    fireWeapon() {
      const def = this.weapon;
      if (!def) return false;
      const shots = def.shots || 1;
      const spread = def.spread || 0;
      for (let i = 0; i < shots; i++) {
        const t = shots === 1 ? 0 : (i / (shots - 1)) - 0.5;
        this.weaponShot({
          angleOffset: t * spread,
          speed: def.speed,
          radius: def.radius,
          life: def.life,
          pierce: def.pierce,
          knockback: def.knockback,
          visual: def.visual,
          color: def.color,
          scale: def.scale,
          trail: def.trail,
          glow: def.glow,
          homing: def.homing,
          bounce: def.bounce,
          slow: def.slow,
          burn: def.burn,
          ink: def.ink,
          explode: def.explode,
          explodeMult: def.explodeMult,
          def
        });
      }
      this.weaponSpecial(def);
      this.weaponCd = this._weaponCooldown();
      this.weaponCdMax = def.cooldown;
      this.weaponRecoil = 1;
      this.weaponFlash = 0.085;
      if ((def.damage || 0) >= 40) this.game.addShake(3, 0.1);
      this.game.audio.sfx(def.sfx || 'shoot');
      return true;
    }

    weaponShot(opts) {
      const def = opts.def || {};
      const crit = Math.random() < this.critChance;
      const angle = this.aimAngle + (opts.angleOffset || 0);
      const px = this.x + Math.cos(angle) * 24;
      const py = this.y + Math.sin(angle) * 24 - 2;
      const self = this;
      // 伤害来自武器本体，而不是角色基础伤害 × 倍率。
      const dmg = (opts.damage || def.damage || 8) *
        (crit ? 1.65 : 1) * this.damageMultiplier();
      const proj = Ink.fire(this.game, {
        x: px, y: py, angle,
        speed: opts.speed || 600,
        damage: dmg,
        radius: opts.radius || 5,
        color: opts.color || '#e8c170',
        owner: 'player',
        source: this,
        sourceKey: 'weapon',
        visual: opts.visual || 'orb',
        pierce: opts.pierce || 0,
        life: opts.life || 1.4,
        homing: opts.homing || 0,
        homingTarget: this.nearestEnemy(420),
        trail: opts.trail,
        glow: opts.glow,
        scale: opts.scale || 1,
        knockback: opts.knockback || 0,
        crit,
        bounce: opts.bounce || this.bonusBounce,
        wallBounce: this.wallBounce,
        onHit: (game, enemy, projectile) => {
          self.onWeaponHit(enemy, projectile, opts);
        },
        onExpire: (game, projectile) => {
          if (opts.explode && !projectile._exploded) self.weaponExplode(projectile, opts);
        }
      });
      Ink.FX.burst(this.game, px, py, opts.color || '#e8c170', 3, 60, { size: 2, lifeMult: 0.45 });
      return proj;
    }

    /**
     * 每把兵器的“签名节奏”。
     * 不额外增加按键：第三/四/五发本身就是蓄力或连段，移动端也能稳定触发。
     */
    weaponSpecial(def) {
      if (!def || !def.special) return;
      this.weaponShots++;
      const n = this.weaponShots;
      const aim = this.getAimPoint();
      const ring = (x, y, r, color, width) => Ink.FX.ring(this.game, {
        x, y, r0: 6, r1: r, life: 0.34, color: color || def.color, width: width || 2
      });
      const aoe = (x, y, radius, mult, status) => {
        let hits = 0;
        for (const e of this.game.enemies.slice()) {
          if (e.dead) continue;
          if (U.dist(x, y, e.x, e.y) > radius + e.radius) continue;
          this.game.damageEnemy(e, def.damage * mult, {
            source: 'weapon', sourceKey: def.id, color: def.color
          });
          hits++;
          if (status && !e.dead) status(e);
        }
        return hits;
      };
      const slow = (e) => e.applySlow && e.applySlow(0.55, 1.6);
      const stun = (e) => { e.stunTimer = Math.max(e.stunTimer || 0, 0.9); };

      switch (def.special) {
        case 'combo3':
          if (n % 3 === 0) {
            const angle = this.aimAngle;
            for (let i = -1; i <= 1; i++) {
              this.weaponShot({
                def, angleOffset: i * 0.22, speed: 680, radius: 6, life: 0.8,
                visual: 'ink', color: '#c94e5c', pierce: 2, damage: def.damage * 0.85
              });
            }
            aoe(this.x + Math.cos(angle) * 70, this.y + Math.sin(angle) * 70, 54, 1.2, slow);
            Ink.FX.text(this.game, '诛', aim.x, aim.y - 22, '#d24b4b', 18, 0.8);
            ring(aim.x, aim.y, 44, '#d24b4b', 3);
            this.game.audio.sfx('slash');
          }
          break;

        case 'judge':
          if (n % 4 === 0) {
            const target = this.nearestEnemy(220);
            if (target && target.hpRatio && target.hpRatio() < 0.3 && !target.isBoss) {
              this.game.damageEnemy(target, target.hp + 6, { source: 'weapon', sourceKey: 'judge', color: '#ff6b6b' });
              Ink.FX.text(this.game, '处决', target.x, target.y - 26, '#ff6b6b', 16, 1.0);
              this.weaponCd = Math.max(0, this.weaponCd - this.weaponCdMax * 0.5);
            } else {
              this.weaponCd = Math.max(0, this.weaponCd - this.weaponCdMax * 0.18);
            }
          }
          break;

        case 'slam3':
        case 'spin':
          if (n % 3 === 0) {
            aoe(this.x + Math.cos(this.aimAngle) * 50, this.y + Math.sin(this.aimAngle) * 50, 76, 1.35, slow);
            ring(this.x, this.y, 82, def.color, 4);
            Ink.FX.burst(this.game, this.x, this.y + 14, '#b08a5a', 12, 130, { size: 3, gravity: 80 });
            this.game.addShake(4, 0.18);
            this.game.audio.sfx('hit');
          }
          break;

        case 'stunwave':
        case 'bellwave':
          if (n % (def.special === 'bellwave' ? 4 : 4) === 0) {
            const times = def.special === 'bellwave' ? 2 : 1;
            for (let k = 0; k < times; k++) {
              const radius = 128 + k * 46;
              const hit = aoe(this.x, this.y, radius, 1.2, stun);
              ring(this.x, this.y, radius, '#e8c170', 4);
              if (hit) this.game.addShake(4, 0.2);
            }
            this.game.audio.sfx('explosion');
          }
          break;

        case 'fan':
          if (n % 3 === 0) {
            this.guardTimer = 0.85;
            Ink.FX.ring(this.game, {
              x: this.x, y: this.y, r0: 16, r1: 34, life: 0.3, color: '#e9dfc2', width: 2
            });
          }
          break;

        case 'rainfield':
        case 'inkwave':
        case 'lanternfield':
          if (n % 3 === 0) {
            const x = this.x + Math.cos(this.aimAngle) * 86;
            const y = this.y + Math.sin(this.aimAngle) * 86;
            aoe(x, y, def.special === 'inkwave' ? 92 : 70, 1.1, (e) => {
              slow(e);
              if (def.special === 'lanternfield' && e.applyBurn) e.applyBurn(2.0, 4);
            });
            ring(x, y, def.special === 'inkwave' ? 92 : 70, def.color, 3);
            Ink.FX.burst(this.game, x, y, def.color, 12, 100, { size: 3 });
          }
          break;

        case 'sealfield':
          if (n % 3 === 0) {
            const x = aim.x, y = aim.y;
            aoe(x, y, 86, 1.4, (e) => {
              e.trappedTimer = Math.max(e.trappedTimer || 0, 0.7);
              e.stunTimer = Math.max(e.stunTimer || 0, 1.2);
            });
            ring(x, y, 86, '#c94e5c', 4);
            Ink.FX.text(this.game, '封', x, y - 20, '#c94e5c', 18, 1.0);
          }
          break;

        case 'type':
          // 平/上/去/入：直飞、抛射、穿透、爆炸
          {
            const roll = n % 4;
            const names = ['平', '上', '去', '入'];
            const colors = ['#8fd6ff', '#ffd36b', '#ff7d7d', '#c084fc'];
            this.weaponShot({
              def, damage: def.damage * (roll === 3 ? 1.5 : 1),
              speed: roll === 1 ? 380 : 620, pierce: roll === 2 ? 5 : 0,
              explode: roll === 3 ? 62 : 0, explodeMult: 0.65,
              visual: 'ink', color: colors[roll], radius: 7
            });
            Ink.FX.text(this.game, names[roll], this.x, this.y - 38, colors[roll], 14, 0.5);
          }
          break;

        case 'spread':
          if (n % 3 === 0) {
            for (let i = -2; i <= 2; i++) {
              this.weaponShot({
                def, angleOffset: i * 0.16, damage: def.damage * 0.8,
                speed: 720, pierce: 2, visual: 'needle', color: def.color
              });
            }
            ring(this.x, this.y, 56, def.color, 2);
          }
          break;

        case 'pierce':
          if (n % 3 === 0) {
            this.weaponShot({
              def, damage: def.damage * 1.6, speed: 860, radius: 5,
              pierce: 9, visual: 'needle', color: n % 6 === 0 ? '#ffb7c8' : '#e8dfc2'
            });
          }
          break;

        case 'sound':
          if (n % 4 === 0) {
            aoe(this.x + Math.cos(this.aimAngle) * 90, this.y + Math.sin(this.aimAngle) * 90, 96, 1.1, slow);
            ring(this.x, this.y, 90, '#b7e6ef', 4);
            ring(this.x, this.y, 58, '#e8dfc2', 2);
          }
          break;

        case 'bounce':
          if (n % 4 === 0) this.bonusBounce = Math.min(8, (this.bonusBounce || 0) + 1);
          break;

        case 'beam':
          if (n % 4 === 0) {
            this.weaponShot({
              def, damage: def.damage * 1.65, speed: 980, radius: 5,
              pierce: 12, life: 1.5, visual: 'ink', color: '#fff6e7', scale: 1.4
            });
            this.game.addShake(4, 0.15);
          }
          break;

        case 'mirror':
          this.mirrorTimer = 1.0;
          this.mirrorCharges = 1;
          if (n % 4 === 0) {
            aoe(this.x + Math.cos(this.aimAngle) * 100, this.y + Math.sin(this.aimAngle) * 100, 74, 1.2, slow);
            ring(this.x, this.y, 78, '#c7efd4', 3);
          }
          break;

        case 'markstrong':
          if (n % 3 === 0 || !this.compassTarget || this.compassTarget.dead) {
            let best = null;
            for (const e of this.game.enemies) {
              if (e.dead) continue;
              if (!best || (e.maxHp || e.hp) > (best.maxHp || best.hp)) best = e;
            }
            if (best) {
              best.applyMark && best.applyMark(6);
              this.compassTarget = best;
              Ink.FX.text(this.game, '司南·指', best.x, best.y - 28, '#c94e5c', 13, 0.7);
            }
          }
          break;

        case 'dice':
          if (n % 3 === 0) {
            const pips = U.randInt(1, 6);
            const names = ['礼', '乐', '射', '御', '书', '数'];
            Ink.FX.text(this.game, names[pips - 1], this.x, this.y - 42, def.color, 15, 0.7);
            if (pips === 1) this.addArmor(5);
            else if (pips === 2) {
              this.weaponShot({ def, damage: def.damage, speed: 620, visual: 'orb', color: '#8fd6ff', pierce: 2 });
            } else if (pips === 3) {
              this.weaponShot({ def, damage: def.damage * 1.4, speed: 900, visual: 'needle', pierce: 6 });
            } else if (pips === 4) this.swiftTimer = 2;
            else if (pips === 5) {
              this.weaponShot({ def, damage: def.damage, speed: 520, visual: 'ink', explode: 48, explodeMult: 0.6 });
            } else {
              aoe(this.x + Math.cos(this.aimAngle) * 70, this.y + Math.sin(this.aimAngle) * 70, 90, 1.4, slow);
              ring(this.x, this.y, 92, '#ffd36b', 4);
            }
          }
          break;

        case 'coin':
          if (n % 5 === 0) {
            const x = this.x + Math.cos(this.aimAngle) * 80;
            const y = this.y + Math.sin(this.aimAngle) * 80;
            aoe(x, y, 78, 0.7, slow);
            this.game.dropCoin && this.game.dropCoin(x, y, 2);
            ring(x, y, 78, '#ffd36b', 3);
          }
          break;

        case 'kite':
          if (n % 4 === 0) {
            for (let i = -1; i <= 1; i++) {
              this.weaponShot({
                def, angleOffset: i * 0.4, damage: def.damage * 0.65,
                speed: 430, homing: 5, explode: 46, explodeMult: 0.5,
                visual: 'petal', color: def.color, radius: 6
              });
            }
            Ink.FX.text(this.game, '断线', this.x, this.y - 38, '#d9a35c', 13, 0.7);
          }
          break;

        case 'puppet':
          if (n % 4 === 0) {
            const forms = ['生', '旦', '净', '丑'];
            const f = forms[n % forms.length];
            Ink.FX.text(this.game, f, this.x, this.y - 38, '#c79a62', 14, 0.6);
            if (f === '生') {
              this.weaponShot({ def, damage: def.damage * 1.5, speed: 820, pierce: 3, visual: 'needle' });
            } else if (f === '旦') {
              this.weaponShot({ def, damage: def.damage, speed: 560, homing: 3, visual: 'orb' });
            } else if (f === '净') {
              aoe(this.x + Math.cos(this.aimAngle) * 54, this.y + Math.sin(this.aimAngle) * 54, 72, 1.5, stun);
            } else {
              this.weaponShot({ def, damage: def.damage, speed: 480, explode: 50, explodeMult: 0.7, visual: 'petal' });
            }
          }
          break;

        case 'mask':
          if (n % 5 === 0 && this.maskTimer <= 0) {
            this.maskTimer = 8;
            Ink.FX.text(this.game, '傩面·变身', this.x, this.y - 42, '#b54b45', 16, 1.0);
            Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 8, r1: 78, life: 0.5, color: '#b54b45', width: 4 });
            this.game.addShake(4, 0.2);
          }
          if (this.maskTimer > 0) {
            aoe(this.x + Math.cos(this.aimAngle) * 42, this.y + Math.sin(this.aimAngle) * 42, 48, 0.8, slow);
          }
          break;

        default:
          // 庭主遗物：每第四发打出一次大范围余波
          if (def.bossOnly && n % 4 === 0) {
            const x = this.x + Math.cos(this.aimAngle) * 90;
            const y = this.y + Math.sin(this.aimAngle) * 90;
            aoe(x, y, 100, 1.5, slow);
            ring(x, y, 100, def.color, 4);
            this.game.addShake(4, 0.16);
          }
          break;
      }
    }

    updateWeaponHooks(dt) {
      this.guardTimer = Math.max(0, (this.guardTimer || 0) - dt);
      this.maskTimer = Math.max(0, this.maskTimer - dt);
      this.mirrorTimer = Math.max(0, this.mirrorTimer - dt);
      if (this.maskTimer <= 0 && this._maskWasActive) {
        this._maskWasActive = false;
        for (const p of this.game.projectiles) {
          if (p.owner === 'enemy' && U.dist(this.x, this.y, p.x, p.y) < 150) p.dead = true;
        }
        Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 20, r1: 150, life: 0.5, color: '#ffd36b', width: 5 });
        Ink.FX.text(this.game, '傩面·收', this.x, this.y - 38, '#ffd36b', 14, 0.8);
      }
      if (this.maskTimer > 0) this._maskWasActive = true;

      if (this.mirrorTimer > 0) {
        for (const p of this.game.projectiles) {
          if (p.owner !== 'enemy' || p.dead) continue;
          if (U.dist(this.x, this.y, p.x, p.y) > 62) continue;
          p.owner = 'player';
          p.source = this;
          p.sourceKey = 'mirror';
          p.damage = Math.max(p.damage * 1.45, 12);
          p.vx *= -1;
          p.vy *= -1;
          p.angle += Math.PI;
          p.color = '#c7efd4';
          p.dead = false;
          this.mirrorCharges--;
          Ink.FX.burst(this.game, p.x, p.y, '#c7efd4', 6, 80, { size: 2 });
          if (this.mirrorCharges <= 0) break;
        }
      }
    }

    onWeaponHit(enemy, proj, opts) {
      this.applyHitPassives(enemy, opts);
      if (opts.ink && enemy.applyInkStack) enemy.applyInkStack();
      if (opts.slow && enemy.applySlow) enemy.applySlow(opts.slow[0], opts.slow[1]);
      if (opts.burn && enemy.applyBurn) enemy.applyBurn(opts.burn[0], opts.burn[1]);
      if (opts.explode && !proj._exploded) this.weaponExplode(proj, opts);
      if (this.overcharge) {
        this.overchargeHits++;
        if (this.overchargeHits % 8 === 0) this.chainLightning(enemy);
      }
      if (!enemy.dead && this.char.onBasicHit) this.char.onBasicHit(enemy, proj);
    }

    applyHitPassives(enemy) {
      if (!enemy) return;
      if (this.frostHits && enemy.applySlow) enemy.applySlow(0.65, 1.4);
      if (this.emberHits && enemy.applyBurn) enemy.applyBurn(2.0, 2.0);
    }

    weaponExplode(proj, opts) {
      proj._exploded = true;
      const radius = opts.explode || 60;
      const mult = opts.explodeMult || 0.6;
      Ink.FX.explosion(this.game, proj.x, proj.y, radius, opts.color || '#ffb35c');
      Ink.FX.ring(this.game, {
        x: proj.x, y: proj.y, r0: 8, r1: radius, life: 0.32,
        color: opts.color || '#ffb35c', width: 3
      });
      this.game.addShake(3, 0.12);
      this.game.audio.sfx('explosion');
      for (const e of this.game.enemies.slice()) {
        if (e.dead || e.spawnTimer > 0) continue;
        if (U.dist(proj.x, proj.y, e.x, e.y) > radius + e.radius) continue;
        this.game.damageEnemy(e, (proj.damage || this.damage) * mult, {
          source: 'weapon', color: opts.color || '#ffb35c', crit: false
        });
      }
    }

    chainLightning(from) {
      const targets = this.game.enemies
        .filter((e) => !e.dead && e !== from)
        .sort((a, b) => U.dist2(from.x, from.y, a.x, a.y) - U.dist2(from.x, from.y, b.x, b.y))
        .slice(0, 3);
      let prev = from;
      for (const e of targets) {
        const a = U.angleTo(prev, e);
        Ink.FX.beam(this.game, {
          x: prev.x, y: prev.y, angle: a,
          length: U.dist(prev.x, prev.y, e.x, e.y),
          color: '#f4d76a', width: 2, warn: 0, active: 0.22, damage: 0
        });
        this.game.damageEnemy(e, this.damage * 0.45, {
          source: 'passive', sourceKey: 'overcharge', color: '#f4d76a'
        });
        prev = e;
      }
      if (targets.length) {
        Ink.FX.text(this.game, '超载', this.x, this.y - 46, '#f4d76a', 13, 0.7);
        this.game.audio.sfx('crit');
      }
    }

    gainXp(amount) {
      if (amount <= 0) return;
      this.xp += amount;
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = Math.round(10 + (this.level - 1) * 8 + Math.pow(this.level, 1.25) * 2);
        this.hp = Math.min(this.maxHp, this.hp + 8);
        this.game.onPlayerLevelUp(this.level);
      }
    }

    // ── 每帧 ──────────────────────────────────────────────
    update(dt) {
      if (this.dead) return;
      this.time += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.atkCd = Math.max(0, this.atkCd - dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 9);
      this.weaponFlash = Math.max(0, this.weaponFlash - dt);
      this.skillFlash = Math.max(0, this.skillFlash - dt);
      this.swiftTimer = Math.max(0, this.swiftTimer - dt);
      this.updateWeaponHooks(dt);

      // 护甲回复：脱战 4.5 秒后每秒回复 1.5 点
      if (this.armorRegenTimer > 0) {
        this.armorRegenTimer -= dt;
      } else if (this.armor < this.maxArmor) {
        this.armor = Math.min(this.maxArmor, this.armor + 1.5 * dt);
      }

      // 主动技能输入（桌面空格 / 右键；触屏由 game 设置 skillRequest）
      if (this.game.skillRequest) {
        this.game.skillRequest = false;
        this.tryUseSkill();
      }
      const input = this.game.input;
      if (input.wasPressed('Space', 'KeyE')) this.tryUseSkill();
      if (input.wasPressed('KeyG')) this.dropWeapon();
      const rightNow = input.mouse.right;
      if (rightNow && !this._prevRight) this.tryUseSkill();
      this._prevRight = rightNow;

      // 移动
      const mv = this.game.getMoveVector();
      const sp = this.speed
        * (this.swiftTimer > 0 ? 1.25 : 1)
        * (this.maskTimer > 0 ? 1.15 : 1)
        * (this.slowTimer > 0 && this.maskTimer <= 0 ? this.slowMult : 1);
      if (mv.x !== 0 || mv.y !== 0) {
        this.x += mv.x * sp * dt;
        this.y += mv.y * sp * dt;
        this.walkTime += dt;
        if (!this.game.touchMode) this.facing = mv.x >= 0 ? 1 : -1;
      } else {
        this.walkTime += dt * 0.35;
      }

      // 瞄准
      this.updateAim();

      const A = Ink.ARENA;
      this.x = U.clamp(this.x, A.x + this.radius + 4, A.x + A.w - this.radius - 4);
      this.y = U.clamp(this.y, A.y + this.radius + 4, A.y + A.h - this.radius - 4);

      this.char.update(dt);

      // 角色不再自带普攻；所有基础输出都由手中武器提供。
      // 角色的 onBasicHit 仍会在武器命中时触发，棋云/字狱/小影的被动因此保留。
      this.updateWeapon(dt);
    }

    updateAim() {
      const input = this.game.input;
      const target = this.nearestEnemy();
      if (this.game.touchMode) {
        if (target) {
          this.aimAngle = U.angleTo(this, target);
          this.facing = target.x < this.x ? -1 : 1;
        }
      } else if (input.mouse.inside) {
        this.aimAngle = U.angleTo(this, input.mouse);
        this.facing = input.mouse.x < this.x ? -1 : 1;
      } else if (target) {
        this.aimAngle = U.angleTo(this, target);
      }
    }

    nearestEnemy(maxDist = 760) {
      let best = null;
      let bestD = maxDist;
      for (const e of this.game.enemies) {
        if (e.dead || e.spawnTimer > 0) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }

    getAimPoint() {
      const input = this.game.input;
      if (!this.game.touchMode && input.mouse.inside) {
        return { x: input.mouse.x, y: input.mouse.y };
      }
      const target = this.nearestEnemy(620);
      if (target) return { x: target.x, y: target.y };
      return {
        x: this.x + Math.cos(this.aimAngle) * 220,
        y: this.y + Math.sin(this.aimAngle) * 220
      };
    }

    wantFire() {
      const input = this.game.input;
      const range = this.weapon ? this.weapon.range : this.def.range;
      if (this.game.touchMode) {
        const target = this.nearestEnemy(range + 24);
        return !!target;
      }
      return input.mouse.down || input.isDown('KeyJ');
    }

    // ── 攻击 ──────────────────────────────────────────────
    fireBasic(opts) {
      const crit = Math.random() < this.critChance;
      const mult = (opts.damageMult || 1) * (crit ? 1.65 : 1) * this.damageMultiplier();
      const angle = this.aimAngle + (opts.angleOffset || 0);
      const speed = opts.speed || 540;
      const px = this.x + Math.cos(angle) * 18;
      const py = this.y + Math.sin(angle) * 18 - 2;
      const self = this;

      Ink.fire(this.game, {
        x: px, y: py, angle,
        speed,
        damage: this.damage * mult,
        radius: opts.radius || 5,
        color: opts.color || PAL.gold,
        owner: 'player',
        source: this,
        sourceKey: 'basic',
        visual: opts.visual || 'orb',
        pierce: opts.pierce || 0,
        life: opts.life || 1.6,
        homing: opts.homing,
        homingTarget: opts.homingTarget,
        homingDelay: opts.homingDelay,
        trail: opts.trail,
        glow: opts.glow,
        scale: opts.scale || 1,
        knockback: opts.knockback || 0,
        crit,
        bounce: this.bonusBounce,
        wallBounce: this.wallBounce,
        onHit: (game, enemy, proj) => {
          self.applyHitPassives(enemy);
          if (self.critBurst && crit) self.critExplode(enemy);
          self.char.onBasicHit(enemy, proj);
        }
      });
      Ink.FX.burst(this.game, px, py, opts.color || PAL.gold, crit ? 5 : 3, 70, { size: 2, lifeMult: 0.5 });
      if (crit) this.game.audio.sfx('crit');
      return true;
    }

    critExplode(enemy) {
      if (!enemy) return;
      const radius = 54;
      Ink.FX.ring(this.game, {
        x: enemy.x, y: enemy.y, r0: 4, r1: radius, life: 0.25,
        color: '#ffb35c', width: 2
      });
      for (const e of this.game.enemies.slice()) {
        if (e.dead || e === enemy || e.spawnTimer > 0) continue;
        if (U.dist(enemy.x, enemy.y, e.x, e.y) > radius + e.radius) continue;
        this.game.damageEnemy(e, this.damage * 0.5, {
          source: 'passive', sourceKey: 'critburst', color: '#ffb35c'
        });
      }
    }

    melee(opts) {
      const angle = this.aimAngle + (opts.angleOffset || 0);
      const range = opts.range || 80;
      const arc = opts.arc || 1.4;
      const critCount = Math.random() < this.critChance;
      const dmg = this.damage * (opts.damageMult || 1) * (critCount ? 1.65 : 1) * this.damageMultiplier();
      Ink.FX.slash(this.game, {
        x: this.x, y: this.y, angle, range, arc,
        color: opts.color || '#ff8fb3', life: 0.22
      });

      let hitAny = false;
      for (const e of this.game.enemies) {
        if (e.dead) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d > range + e.radius) continue;
        const a = U.angleTo(this, e);
        if (Math.abs(U.angleDiff(a, angle)) > arc / 2) continue;
        hitAny = true;
        this.game.damageEnemy(e, dmg, {
          color: '#ffd0dd', crit: critCount,
          knockback: opts.knockback || 60, angle
        });
        if (!e.dead) {
          this.applyHitPassives(e);
          if (this.critBurst && critCount) this.critExplode(e);
          this.char.onBasicHit(e, null);
        }
      }
      if (hitAny) {
        this.game.addShake(2, 0.08);
        this.game.audio.sfx('hit');
      }
      return true;
    }

    // ── 技能 ──────────────────────────────────────────────
    tryUseSkill() {
      if (this.dead || this.skillCd > 0) {
        if (this.skillCd > 0) this.game.audio.sfx('uiBack');
        return false;
      }
      const ok = this.char.useSkill();
      if (ok) {
        this.skillCd = this.skillCdMax;
        this.skillFlash = 0.28;
        this.game.addShake(2.5, 0.16);
        Ink.FX.ring(this.game, {
          x: this.x, y: this.y - 4, r0: 10, r1: 62, life: 0.36,
          color: this.def.accent || PAL.gold, width: 2
        });
        this.game.audio.sfx('skill');
      }
      return ok;
    }

    reduceCooldown(seconds) {
      this.skillCd = Math.max(0, this.skillCd - seconds);
    }

    skillReady() { return this.skillCd <= 0; }
    skillRatio() { return this.skillCdMax > 0 ? U.clamp(this.skillCd / this.skillCdMax, 0, 1) : 0; }

    // ── 生命 / 护甲 ───────────────────────────────────────
    addArmor(amount) {
      if (amount <= 0 || this.dead) return;
      const before = this.armor;
      this.armor = Math.min(this.maxArmor, this.armor + amount);
      const gained = this.armor - before;
      if (gained > 0.5) this.game.audio.sfx('armor');
    }

    heal(amount) {
      if (this.dead || amount <= 0) return;
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      if (this.hp - before > 0.5) {
        Ink.FX.text(this.game, '+' + Math.round(this.hp - before), this.x, this.y - 30, '#7fe3d2', 12, 0.7);
      }
    }

    applySlow(mult, duration) {
      if (this.maskTimer > 0) return;
      this.slowMult = Math.min(this.slowMult, mult);
      this.slowTimer = Math.max(this.slowTimer, duration);
    }

    takeDamage(amount, source) {
      if (this.dead || this.invuln > 0) return;
      amount = Math.max(1, Math.round(amount));
      // 题扇 / 雨巷伞的格挡窗口，傩面变身的减伤
      if ((this.guardTimer || 0) > 0) amount *= 0.35;
      if (this.maskTimer > 0) amount *= 0.7;
      amount = Math.max(1, Math.round(amount));
      this.invuln = 0.6;
      this.hitFlash = 0.12;
      this.armorRegenTimer = 4.5;
      this.game.addShake(4, 0.16);

      let remaining = amount;
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, remaining);
        this.armor = Math.max(0, this.armor - absorbed);
        remaining -= absorbed;
        Ink.FX.text(this.game, '护甲 -' + Math.round(absorbed), this.x, this.y - 30, '#9fe8ff', 12, 0.7);
      }
      if (remaining > 0) {
        this.hp = Math.max(0, this.hp - remaining);
        Ink.FX.damageNumber(this.game, this.x, this.y - 20, Math.round(remaining), '#ff7d7d', false);
      }
      Ink.FX.hit(this.game, this.x, this.y, U.rand(0, U.TAU), '#ff7d7d', true);
      this.game.audio.sfx(remaining > 0 ? 'hurt' : 'armor');

      // 荆棘皮：只反弹给能受伤的实体，避免把投射物当敌人
      if (this.thorn > 0 && source && source.takeDamage && !source.dead) {
        this.game.damageEnemy(source, amount * this.thorn, {
          source: 'passive', sourceKey: 'thorn', color: '#b6e08a'
        });
      }

      if (this.hp <= 0) this.die();
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      Ink.FX.burst(this.game, this.x, this.y, ['#ff7d7d', '#e8c170', '#fff6e7'], 34, 220, {
        size: 4, gravity: 50, lifeMult: 1.4
      });
      Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 8, r1: 90, life: 0.7, color: '#ff7d7d', width: 4 });
      this.game.audio.sfx('gameover');
      this.game.addShake(10, 0.7);
      this.game.onPlayerDeath();
    }

    onRoomEnter() {
      this.char.onRoomEnter();
      this.invuln = Math.max(this.invuln, 0.6);
      if (this.guardian) this.addArmor(4);
      // 司南：进房自动指向最强敌人
      if (this.weapon && this.weapon.special === 'markstrong') {
        let best = null;
        for (const e of this.game.enemies) {
          if (e.dead) continue;
          if (!best || (e.maxHp || e.hp) > (best.maxHp || best.hp)) best = e;
        }
        if (best) {
          best.applyMark && best.applyMark(6);
          this.compassTarget = best;
        }
      }
    }

    /** 击杀回调：傩面延长变身，司南重新指向。 */
    onWeaponKill(enemy) {
      if (this.maskTimer > 0) this.maskTimer = Math.min(13, this.maskTimer + 1.2);
      if (enemy && this.compassTarget === enemy) this.compassTarget = null;
    }

    // ── 绘制 ──────────────────────────────────────────────
    draw(ctx, game) {
      if (this.dead) return;
      this.char.drawWorld(ctx, game);

      const walking = Math.abs(this.game.getMoveVector().x) + Math.abs(this.game.getMoveVector().y) > 0;
      const frame = walking ? (Math.floor(this.walkTime * 8) % 2) : 0;
      const bob = walking ? Math.sin(this.walkTime * 9) * 1.5 : Math.sin(this.time * 2.4) * 0.8;
      const blink = this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0;

      // 影子
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#050409';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 18, 15, 5, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // 护甲护盾
      if (this.armor > 0) {
        ctx.save();
        ctx.globalAlpha = 0.16 + (this.armor / Math.max(1, this.maxArmor)) * 0.14;
        ctx.strokeStyle = '#9fe8ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 22 + Math.sin(this.time * 3) * 1.5, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x, this.y + bob, 3, {
        frame,
        flip: this.facing < 0,
        alpha: blink ? 0.55 : 1
      });
      if (this.hitFlash > 0) {
        Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x, this.y + bob, 3, {
          frame, flip: this.facing < 0, alpha: 0.5, tint: '#ffffff'
        });
      }

      // 手持武器实体：跟随手部、朝准星旋转，开火时后坐 + 枪口火光
      if (this.weapon && this.weapon.id !== 'fists') {
        // 武器挂在手部：沿瞄准方向伸出手臂，避免整把枪压在角色身体里。
        const handX = this.x + Math.cos(this.aimAngle) * 16 + this.facing * 3;
        const handY = this.y + bob + 4 + Math.sin(this.aimAngle) * 10;
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.fillStyle = this.weapon.color || '#e8c170';
        ctx.beginPath();
        ctx.arc(handX, handY, 13, 0, U.TAU);
        ctx.fill();
        ctx.restore();
        Ink.Weapons.drawHeld(ctx, this.weapon, handX, handY, this.aimAngle, 1.9, {
          recoil: this.weaponRecoil,
          flash: this.weaponFlash
        });
      }

      // 技能释放瞬间的通用光爆，强化“按下技能”的反馈
      if (this.skillFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.skillFlash / 0.28 * 0.5;
        ctx.strokeStyle = this.def.accent || PAL.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 30 + (0.28 - this.skillFlash) * 180, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 瞄准短线（桌面）
      if (!game.touchMode && game.input.mouse.inside) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = this.def.accent || PAL.gold;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(this.aimAngle) * 22, this.y + Math.sin(this.aimAngle) * 22 - 2);
        ctx.lineTo(this.x + Math.cos(this.aimAngle) * 40, this.y + Math.sin(this.aimAngle) * 40 - 2);
        ctx.stroke();
        ctx.restore();
      }

      // 蓄力 / 技能就绪的脚下光环
      if (this.skillCd <= 0) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(this.time * 4) * 0.08;
        ctx.strokeStyle = this.def.accent || PAL.gold;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -this.time * 12;
        ctx.beginPath();
        ctx.arc(this.x, this.y + 14, 20, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  Ink.Player = Player;
})();
