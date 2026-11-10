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
    qiyun: 'qi_staff',
    xiaoying: 'shadow_blade',
    xinyue: 'heart_bell',
    ziyu: 'ink_prison',
    smartdog: 'dog_bone',
    mouse: 'burrow_claw',
    autumn: 'autumn_umbrella',
    sanrui: 'three_seal'
  };

  // 主动技能的能量消耗：辅助/召唤型略高，爆发型略低。
  // 技能以冷却为主要门槛；能量只驱动武器，技能默认不耗能。
  const SKILL_ENERGY = {
    qiyun: 0, xiaoying: 0, xinyue: 0, ziyu: 0,
    smartdog: 0, mouse: 0, autumn: 0, sanrui: 0
  };

  // 手刀基础伤害：刺客/近战角色更痛，法师型较轻。
  const HAND_DAMAGE = {
    qiyun: 5, xiaoying: 8, xinyue: 5, ziyu: 6,
    smartdog: 6, mouse: 7, autumn: 5, sanrui: 6
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
      // 能量：武器与主动技能共用；不自然恢复，靠能量球/击杀/事件补充。
      this.maxEnergy = 60;
      this.energy = this.maxEnergy;
      // 战斗中缓慢回能：每 2.5 秒 +1，避免长时间空能量只能站着。
      this.energyRegenTimer = 0;
      this.energyCost = 0;
      this.lowEnergyCd = 0;
      // 手刀：无消耗的备用近战，按输入触发；不依赖近战武器。
      this.handCd = 0;
      this.handDamage = HAND_DAMAGE[charId] || 6;
      this.handRange = 58;
      this.preferMelee = false;
      this.skillEnergyCost = SKILL_ENERGY[charId] ?? 0;
      this._prevMouseDown = false;
      this._handHeld = false;
      this.chargeTimer = 0;
      this.chargePower = 1;
      this.chargeChainTimer = 0;
      this.speedBoostTimer = 0;
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
      // 双武器槽：默认 2 格，可通过「藏书夹」类被动再扩 1 格。
      this.weaponSlots = [this.weaponId, null];
      this.weaponSlot = 0;
      this.maxWeaponSlots = 2;
      this.weaponCd = 0;
      this.weaponCdMax = this.weapon ? this.weapon.cooldown : 1;
      this.weaponRecoil = 0;
      this.weaponFlash = 0;
      this.skillFlash = 0;
      this.coins = 0;
      this.tools = { wand: 0, review: 0 };
      this.passives = [];
      this.passiveStacks = {};
      this.bonusBounce = 0;
      this.wallBounce = 0;
      this.thorn = 0;
      this.leech = 0;
      this.pickupRadius = 34;
      this.bonusPierce = 0;
      this.bonusHoming = 0;
      this.armorOnKill = 0;
      this.frostHits = false;
      this.frostStacks = 0;
      this.emberHits = false;
      this.emberStacks = 0;
      this.nova = false;
      this.novaStacks = 0;
      this.critBurst = false;
      this.critBurstStacks = 0;
      this.overcharge = false;
      this.overchargeStacks = 0;
      this.overchargeHits = 0;
      this.coinMult = 1;
      this.lastStand = false;
      this.lastStandStacks = 0;
      this.guardian = false;
      this.guardianStacks = 0;
      this.swift = false;
      this.swiftStacks = 0;
      this.swiftTimer = 0;
      this.hitHeal = 0;
      this.hitHealAcc = 0;
      this.chain = false;
      this.chainStacks = 0;
      this.chainHits = 0;
      this.thunder = false;
      this.thunderStacks = 0;
      this.thunderHits = 0;
      this.slowAura = false;
      this.slowAuraStacks = 0;
      this.auraTick = 0;
      this.energyOnKill = 0;

      // 守门人遗物：不占武器槽，拾取即生效。
      this.relics = {};
      this.relicSlowResist = 0;
      this.relicTrapResist = 0;
      this.relicCrit = 0;
      this.relicDamage = 0;
      this.relicCdMult = 1;
      this.relicSkillCost = 0;
      this.relicEnergyGain = 0;
      this.relicMeleeInk = false;
      this.relicRangedResist = 0;

      // 第二批机制被动：复活、额外弹道、环刃、处决、裂墨、缓时、爆裂弹、饮血、鹰眼、纸甲。
      this.reviveCharges = 0;
      this.extraProjectiles = 0;
      this.orbit = false;
      this.orbitStacks = 0;
      this.orbitAngle = 0;
      this.orbitCd = 0;
      this.execute = false;
      this.executeStacks = 0;
      this.split = false;
      this.splitStacks = 0;
      this.splitCd = 0;
      this.auraSlow = false;
      this.auraSlowStacks = 0;
      this.auraCd = 0;
      this.bombShot = false;
      this.bombShotStacks = 0;
      this.bombCount = 0;
      this.critHeal = 0;
      this.deadeye = false;
      this.deadeyeStacks = 0;
      this.paperShield = false;
      this.paperShieldStacks = 0;
      this.paperShieldCd = 0;
      this.chargeTimer = 0;
      this.chargePower = 1;
      // 基础属性成长只来自随机事件，不再由升级三选一提供。
      this.growthHp = 0;
      this.growthDamage = 0;
      this.growthSpeed = 0;

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

      this.maxHp = Math.min(20, Math.round(this.baseMaxHp + (this.growthHp || 0)));
      this.maxArmor = Math.round(this.baseArmor);
      this.speed = this.baseSpeed * (1 + (this.growthSpeed || 0));
      this.damage = this.baseDamage * (1 + (this.growthDamage || 0));
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

    /** 随机事件专用：小幅提高基础属性（生命/伤害/移速）。 */
    applyStatGrowth() {
      this.growthHp += 1;
      this.growthDamage += 0.05;
      this.growthSpeed += 0.015;
      this.recomputeStats(true);
      this.heal(1);
      if (this.game && this.game.ui) {
        this.game.ui.showToast('研习旧帖 · 生命上限 +1 / 伤害 +5% / 移速 +1.5%', '#e8c170', 2.2);
      }
    }

    // ── 武器 / 被动 / 金币 ──────────────────────────────
    /**
     * 装备武器。默认把旧武器丢在脚下，避免“到手就消失”。
     * opts.silent 用于空手回退等内部切换。
     */
    equipWeapon(id, opts = {}) {
      const def = Ink.WeaponDefs && Ink.WeaponDefs[id];
      if (!def) return false;
      let slot = Number.isInteger(opts.slot) ? opts.slot : -1;
      if (slot < 0) {
        const existing = this.weaponSlots.indexOf(id);
        if (existing >= 0) {
          slot = existing;
        } else if (opts.pickup) {
          // 拾取时优先填满空槽；两把都满才替换当前槽。
          const empty = this.weaponSlots.findIndex((w, i) => i < this.maxWeaponSlots && (!w || w === 'fists'));
          slot = empty >= 0 ? empty : this.weaponSlot;
        } else {
          slot = this.weaponSlot;
        }
      }
      if (slot < 0 || slot >= this.maxWeaponSlots) slot = 0;
      const oldId = this.weaponSlots[slot];
      this.weaponSlots[slot] = id;
      this.weaponSlot = slot;
      this.weaponId = id;
      this.weaponCdMax = def.cooldown;
      this.weaponCd = Math.min(this.weaponCd, 0.18);
      this.weaponRecoil = 0.7;
      this.weaponFlash = 0.06;
      this.chargeTimer = 0;
      this.chargePower = 1;

      if (opts.dropCurrent && oldId && oldId !== id && oldId !== 'fists' && !opts.silent) {
        // 旧枪落在身后 66px，避免刚换枪就被自动捡回。
        this.dropWeaponAt(
          oldId,
          this.x - Math.cos(this.aimAngle) * 66,
          this.y - Math.sin(this.aimAngle) * 66,
          false
        );
      }
      this.syncPetWeapon();
      if (!opts.silent && this.game && this.game.ui) {
        this.game.ui.showToast('装备 · ' + def.name, def.color || '#e8c170', 2.0);
      }
      if (this.game && this.game.audio) this.game.audio.sfx('skillReady');
      return true;
    }

    hasWeapon(id) {
      return this.weaponId === id || (this.weaponSlots || []).includes(id);
    }

    /** Q / 触屏槽位：在两把武器之间切换。 */
    switchWeapon() {
      if (!this.weaponSlots || this.maxWeaponSlots < 2) return false;
      for (let i = 1; i <= this.maxWeaponSlots; i++) {
        const idx = (this.weaponSlot + i) % this.maxWeaponSlots;
        const id = this.weaponSlots[idx];
        if (id && id !== 'fists') {
          this.equipWeapon(id, { slot: idx, silent: true });
          if (this.game && this.game.ui) this.game.ui.showToast('换兵 · ' + this.weapon.name, this.weapon.color, 1.2);
          return true;
        }
      }
      return false;
    }

    /** 黄金台离手时，所有由它收服的宠物立即散去。 */
    syncPetWeapon() {
      if (this.game && this.game.clearPets && !this.hasWeapon('golden_altar')) {
        this.game.clearPets();
      }
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
      // 清空当前槽；若另一把还在，自动切过去，否则空手。
      this.weaponSlots[this.weaponSlot] = null;
      const other = this.weaponSlots.findIndex((w, i) => i !== this.weaponSlot && w && w !== 'fists');
      if (other >= 0) {
        this.equipWeapon(this.weaponSlots[other], { slot: other, silent: true });
      } else {
        this.weaponId = 'fists';
        this.weaponSlots[this.weaponSlot] = 'fists';
        this.weaponCdMax = 0.45;
        this.weaponCd = 0.2;
      }
      this.syncPetWeapon();
      if (this.game && this.game.ui) {
        this.game.ui.showToast(other >= 0 ? '已丢下兵刃 · 换持另一把' : '已丢下兵刃 · 空手作战', '#ffb35c', 1.6);
      }
      return true;
    }

    hasPassive(id) {
      return (this.passiveStacks[id] || 0) > 0;
    }

    passiveStack(id) {
      return this.passiveStacks[id] || 0;
    }

    applyPassive(id) {
      const def = Ink.Passives && Ink.Passives[id];
      if (!def) return false;
      // 机制被动可以重复叠加；同名条目记录层数，数值/概率型继续累加。
      this.passives.push(id);
      this.passiveStacks[id] = (this.passiveStacks[id] || 0) + 1;
      if (typeof def.apply === 'function') def.apply(this, this.passiveStacks[id]);
      return true;
    }

    addRelic(id) {
      const def = Ink.Relics && Ink.Relics[id];
      if (!def || this.relics[id]) return false;
      this.relics[id] = true;
      this.relicSlowResist = Math.min(0.8, this.relicSlowResist + (def.slowResist || 0));
      this.relicTrapResist = Math.min(0.8, this.relicTrapResist + (def.trapResist || 0));
      this.relicCrit += def.crit || 0;
      this.relicDamage += def.damage || 0;
      this.relicCdMult = Math.min(this.relicCdMult, def.cdMult || 1);
      this.relicSkillCost += def.skillCost || 0;
      this.relicEnergyGain += def.energyGain || 0;
      this.relicMeleeInk = this.relicMeleeInk || !!def.meleeInk;
      this.relicRangedResist = Math.min(0.5, this.relicRangedResist + (def.rangedResist || 0));
      this.game.audio.sfx('levelup');
      Ink.FX.text(this.game, '遗物 · ' + def.name, this.x, this.y - 46, def.color, 13, 1.4);
      this.game.ui.showToast('拾得守门人遗物 ·「' + def.name + '」', def.color, 2.6);
      return true;
    }

    hasRelic(id) {
      return !!this.relics[id];
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
      let mult = 1 + (this.relicDamage || 0);
      if (this.lastStand && this.hp < this.maxHp * 0.35) {
        mult *= Math.min(1.65, 1.3 + 0.1 * Math.max(0, this.lastStandStacks - 1));
      }
      return mult;
    }

    _weaponCooldown() {
      return this.weaponCdMax;
    }

    /** 每把武器单次开火的能量消耗；近战与空手为 0。 */
    weaponEnergyCost(def = this.weapon) {
      if (!def || def.melee || def.id === 'fists') return 0;
      if (def.energyCost !== undefined) return def.energyCost;
      return Math.max(1, Math.min(8, Math.round((def.damage || 8) / 9)));
    }

    addEnergy(amount) {
      if (!amount) return;
      if (amount > 0 && this.relicEnergyGain) amount += this.relicEnergyGain;
      const before = this.energy;
      this.energy = U.clamp(this.energy + amount, 0, this.maxEnergy);
      const gain = Math.round(this.energy - before);
      if (gain > 0) {
        Ink.FX.text(this.game, '+' + gain + ' 能量', this.x, this.y - 44, '#8fd6ff', 11, 0.7);
      }
    }

    _showEnergyToast(text) {
      if (this.lowEnergyCd > 0) return;
      this.lowEnergyCd = 1.2;
      if (this.game.ui) this.game.ui.showToast(text, '#8fd6ff', 1.0);
    }

    _chargeDuration(def) {
      const chain = (this.chargeChainTimer || 0) > 0 ? 0.7 : 1;
      return (def.chargeTime || 0.9) * chain;
    }

    /**
     * 手刀：不消耗能量、不进入武器冷却的备用近战。
     * 输入保持时以 0.12s 的输入节流触发，而不是传统技能冷却。
     */
    handKnife() {
      // 手刀没有内置冷却；同一次按住只挥一次，攻击频率由玩家点击/点按频率决定。
      if (this.dead || this._handHeld) return false;
      this._handHeld = true;
      const range = this.handRange || 58;
      const arc = 1.65;
      const dmg = this.handDamage || 6;
      let hits = 0;
      for (const e of this.game.enemies) {
        if (e.dead || e.spawnTimer > 0) continue;
        if (U.dist(this.x, this.y, e.x, e.y) > range + e.radius) continue;
        if (Math.abs(U.angleDiff(U.angleTo(this, e), this.aimAngle)) > arc / 2) continue;
        this.game.damageEnemy(e, dmg, {
          source: 'hand', sourceKey: 'hand_knife', color: '#ffe0b0', knockback: 55
        });
        hits++;
      }
      Ink.FX.slash(this.game, {
        x: this.x + Math.cos(this.aimAngle) * 12,
        y: this.y + Math.sin(this.aimAngle) * 12,
        angle: this.aimAngle, range: range + 6, arc, color: '#ffe0b0', life: 0.16, width: 4
      });
      this.game.audio.sfx('slash');
      this.weaponFlash = 0.06;
      if (hits) this.game.addShake(1.5, 0.08);
      return true;
    }

    /** 手刀优先级：空手、能量不足且贴脸，或玩家手动切到近战优先。 */
    shouldHandKnife(def = this.weapon) {
      if (this.dead) return false;
      if (!def || def.id === 'fists') return true;
      if (def.melee) return false;
      if (this.wantFire() === false) return false;
      const target = this.nearestEnemy(this.handRange + 22);
      if (!target) return false;
      if (this.preferMelee) return true;
      return this.energy < this.weaponEnergyCost(def) && U.dist(this.x, this.y, target.x, target.y) <= this.handRange + target.radius;
    }

    updateWeapon(dt) {
      this.handCd = 0;
      this.lowEnergyCd = Math.max(0, this.lowEnergyCd - dt);
      this.chargeChainTimer = Math.max(0, (this.chargeChainTimer || 0) - dt);
      this.weaponCd = Math.max(0, this.weaponCd - dt);
      if (this.dead) return;

      const def = this.weapon;
      const firing = this.wantFire();
      if (!firing) this._handHeld = false;
      // 近战优先 / 空手 / 能量不足贴脸：手刀完全独立于武器冷却。
      if (firing && this.shouldHandKnife(def)) {
        this.handKnife();
        return;
      }
      if (!def) return;
      if (def.charged && this.weaponCd <= 0) {
        // 蓄力武器：按住蓄力、满蓄自动释放；松开时 12% 以上甩出半蓄攻击。
        if (firing) {
          this.chargeTimer = Math.min(1, this.chargeTimer + dt / this._chargeDuration(def));
          // 自动释放可被每把武器关闭；完美区间武器仍可按住等完美窗口。
          if (this.chargeTimer >= 1 && def.chargeAuto !== false) this.fireWeapon();
        } else if (this.chargeTimer > 0.12) {
          this.fireWeapon();
        }
        return;
      }

      if (this.weaponCd > 0) return;
      if (!firing) return;
      this.fireWeapon();
    }

    fireWeapon() {
      const def = this.weapon;
      if (!def) return false;
      const cost = this.weaponEnergyCost(def);
      if (cost > 0 && this.energy < cost) {
        // 能量不足时优先落到手刀，而不是罚站空按。
        if (this.shouldHandKnife(def)) {
          this.handKnife();
          return false;
        }
        this._showEnergyToast('能量不足 · 近身可用手刀');
        this.weaponCd = 0.25;
        return false;
      }
      // 蓄力强度只在本发内生效；完美区间可额外放大。
      let chargePower = def.charged ? 0.9 + 1.25 * Math.max(0.12, this.chargeTimer) : 1;
      if (def.charged && def.chargePerfect) {
        const [lo, hi] = def.chargePerfect;
        if (this.chargeTimer >= lo && this.chargeTimer <= hi) {
          chargePower = def.chargePerfectMult || 2.4;
          Ink.FX.text(this.game, '完美释放', this.x, this.y - 54, '#ffe08a', 15, 1.0);
        }
      }
      this.chargePower = chargePower;
      if (cost > 0) this.energy = Math.max(0, this.energy - cost);
      // 近战武器不走弹道：挥出弧形，命中敌人并清除范围内敌方弹幕。
      if (def.melee) {
        this.swingWeapon(def);
        this.weaponSpecial(def);
        this.weaponCd = def.cooldown;
        this.weaponCdMax = def.cooldown;
        this.weaponRecoil = 1;
        this.weaponFlash = 0.085;
        this.chargeTimer = 0;
        if (def.chargeChain) this.chargeChainTimer = 2.2;
        return true;
      }
      const extra = this.extraProjectiles || 0;
      const shots = (def.shots || 1) + extra;
      const spread = def.spread || (extra > 0 ? 0.16 : 0);
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
          damage: def.charged ? (def.damage || 12) * this.chargePower : undefined,
          def
        });
      }
      this.weaponSpecial(def);
      this.weaponCd = this._weaponCooldown();
      this.weaponCdMax = def.cooldown;
      this.weaponRecoil = 1;
      this.weaponFlash = 0.085;
      this.chargeTimer = 0;
      if (def.chargeChain) this.chargeChainTimer = 2.2;
      if ((def.damage || 0) * this.chargePower >= 40) this.game.addShake(3, 0.1);
      this.game.audio.sfx(def.sfx || 'shoot');
      return true;
    }

    swingWeapon(def) {
      const range = def.range || 170;
      // 近战统一为扇形横扫：最小约 109°，避免变成“点状攻击”。
      const arc = Math.max(1.35, def.arc || 1.5);
      const a = this.aimAngle;
      const dmg = (def.damage || 12) * (def.charged ? (this.chargePower || 1.85) : 1) * this.damageMultiplier();
      let hits = 0;
      for (const e of this.game.enemies.slice()) {
        if (e.dead) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d > range + e.radius) continue;
        if (Math.abs(U.angleDiff(U.angleTo(this, e), a)) > arc / 2) continue;
        this.game.damageEnemy(e, dmg, {
          source: 'weapon', sourceKey: def.id, color: def.color,
          angle: a, knockback: def.knockback || 55
        });
        this.onWeaponHit(e, null, { def });
        hits++;
      }
      // 近战挥击也能砸开木箱：扇形范围内的可破坏物一并结算。
      for (const o of this.game.obstacles || []) {
        if (o.broken || !o.destructible) continue;
        if (U.dist(this.x, this.y, o.x, o.y) > range + o.r) continue;
        if (Math.abs(U.angleDiff(U.angleTo(this, o), a)) > arc / 2) continue;
        this.game.damageObstacle(o, dmg);
        hits++;
      }
      // 近战挥击清除弹幕（这是“文房兵器”的核心防御价值）。
      if (def.clearShots !== false) {
        for (const pr of this.game.projectiles.slice()) {
          if (pr.dead || pr.owner !== 'enemy') continue;
          if (U.dist(this.x, this.y, pr.x, pr.y) > range + 26) continue;
          if (Math.abs(U.angleDiff(U.angleTo(this, pr), a)) > arc / 2 + 0.2) continue;
          pr.dead = true;
          Ink.FX.burst(this.game, pr.x, pr.y, def.color || '#e8c170', 4, 70, { size: 2 });
        }
      }
      Ink.FX.slash(this.game, {
        x: this.x, y: this.y, angle: a, range, arc,
        color: def.color || '#e8c170', life: 0.26, width: 2.5
      });
      Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 6, r1: 28, life: 0.2, color: def.color, width: 2 });
      this.game.audio.sfx('slash');
      if (hits > 0) this.game.addShake(1.7, 0.08);
      return hits;
    }

    weaponShot(opts) {
      const def = opts.def || {};
      const crit = Math.random() < (this.critChance + this.relicCrit);
      const angle = this.aimAngle + (opts.angleOffset || 0);
      const px = this.x + Math.cos(angle) * 24;
      const py = this.y + Math.sin(angle) * 24 - 2;
      const self = this;
      // 伤害来自武器本体，而不是角色基础伤害 × 倍率。
      const dmg = (opts.damage || def.damage || 8) *
        (crit ? 1.65 : 1) * this.damageMultiplier();
      if (crit && this.critHeal > 0) this.heal(this.critHeal);
      // 爆裂弹：每第 5 发远程攻击附带爆炸；裂墨的副弹不计数。
      if (this.bombShot && !opts._split) {
        this.bombCount++;
        if (this.bombCount % 5 === 0) opts.explode = Math.max(opts.explode || 0, 66);
      }
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
        pierce: (opts.pierce || 0) + this.bonusPierce,
        life: opts.life || 1.4,
        homing: (opts.homing || 0) + this.bonusHoming,
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

        case 'golden':
          // 黄金台不是输出武器：轻点只放出一点收束金光，核心是 R 吟唱收宠。
          ring(this.x + Math.cos(this.aimAngle) * 40, this.y + Math.sin(this.aimAngle) * 40, 24, '#ffd36b', 1.5);
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
      // 寒域：定期给身边敌人上短减速。
      this.auraTick = Math.max(0, (this.auraTick || 0) - dt);
      if (this.slowAura && this.auraTick <= 0) {
        this.auraTick = 0.5;
        const radius = 150 + 24 * Math.max(0, (this.slowAuraStacks || 1) - 1);
        for (const e of this.game.enemies) {
          if (e.dead || e.spawnTimer > 0) continue;
          if (U.dist(this.x, this.y, e.x, e.y) > radius + e.radius) continue;
          if (e.applySlow) e.applySlow(0.72, 0.7);
        }
      }
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

      this.splitCd = Math.max(0, this.splitCd - dt);
      this.paperShieldCd = Math.max(0, this.paperShieldCd - dt);

      // 环刃：围绕角色旋转的墨刃，每隔 0.45 秒切一次近身敌人。
      if (this.orbit) {
        this.orbitAngle += dt * 2.6;
        this.orbitCd -= dt;
        if (this.orbitCd <= 0) {
          this.orbitCd = 0.45;
          const blades = 2 + Math.max(0, this.orbitStacks - 1);
          const hit = new Set();
          for (let i = 0; i < blades; i++) {
            const a = this.orbitAngle + i * U.TAU / blades;
            const bx = this.x + Math.cos(a) * 54;
            const by = this.y + Math.sin(a) * 54;
            for (const e of this.game.enemies) {
              if (e.dead || hit.has(e)) continue;
              if (U.dist(bx, by, e.x, e.y) > 20 + e.radius) continue;
              hit.add(e);
              this.game.damageEnemy(e, 6 + this.level * 1.2 + (this.weapon ? this.weapon.damage * 0.12 : 0), {
                source: 'passive', sourceKey: 'orbit', color: '#9fe8ff'
              });
              if (e.applySlow) e.applySlow(0.8, 0.5);
              Ink.FX.hit(this.game, bx, by, a, '#9fe8ff', false);
            }
          }
        }
      }

      // 缓时领域：贴身敌人持续变慢。
      if (this.auraSlow) {
        this.auraCd -= dt;
        if (this.auraCd <= 0) {
          this.auraCd = 0.35;
          const radius = 150 + 16 * Math.max(0, this.auraSlowStacks - 1);
          for (const e of this.game.enemies) {
            if (!e.dead && U.dist(this.x, this.y, e.x, e.y) <= radius + e.radius && e.applySlow) {
              e.applySlow(0.75, 0.55);
            }
          }
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
        // 叠加超载会降低触发间隔，最低 4 次命中一次。
        const need = Math.max(4, 8 - (this.overchargeStacks - 1));
        if (this.overchargeHits % need === 0) this.chainLightning(enemy);
      }
      // 饮墨：命中回血；连坐：每数次命中额外伤周围两人；雷殛：定时召连锁雷。
      if (this.hitHeal > 0) {
        this.hitHealAcc += this.hitHeal;
        if (this.hitHealAcc >= 1) { const n = Math.floor(this.hitHealAcc); this.hitHealAcc -= n; this.heal(n); }
      }
      if (this.chain && enemy && !enemy.dead) {
        this.chainHits++;
        const need = Math.max(3, 5 - (this.chainStacks - 1));
        if (this.chainHits % need === 0) {
          let n = 0;
          for (const e of this.game.enemies.slice()) {
            if (n >= 2) break;
            if (e.dead || e === enemy || e.spawnTimer > 0) continue;
            if (U.dist(enemy.x, enemy.y, e.x, e.y) > 190) continue;
            this.game.damageEnemy(e, Math.max(4, this.weapon.damage * 0.42), { source: 'passive', sourceKey: 'chain', color: '#c9a6ff' });
            Ink.FX.beam(this.game, { x: enemy.x, y: enemy.y, angle: U.angleTo(enemy, e), length: Math.min(190, U.dist(enemy.x, enemy.y, e.x, e.y)), warn: 0, active: 0.18, color: '#c9a6ff', width: 2 });
            n++;
          }
        }
      }
      if (this.thunder && enemy && !enemy.dead) {
        this.thunderHits++;
        const need = Math.max(4, 7 - (this.thunderStacks - 1));
        if (this.thunderHits % need === 0) this.chainLightning(enemy);
      }
      // 裂墨：命中后向左右裂出两发弱弹，带独立短冷却防止无限连锁。
      if (this.split && !opts._split && this.splitCd <= 0 && enemy && this.weapon) {
        this.splitCd = 0.32;
        const dmg = Math.max(4, (proj && proj.damage ? proj.damage : this.weapon.damage) * 0.4);
        const base = this.weapon;
        for (const side of [-1, 1]) {
          this.weaponShot({
            def: base, damage: dmg, angleOffset: side * 0.52, speed: 520,
            radius: 5, life: 0.8, _split: true, visual: 'ink', color: '#c9a6ff'
          });
        }
        Ink.FX.text(this.game, '裂', enemy.x, enemy.y - 22, '#c9a6ff', 13, 0.55);
      }
      // 铁砧诗稿：近战命中额外附一层字印（字狱可借此叠层）。
      if (this.relicMeleeInk && enemy.applyInkStack && this.weapon && this.weapon.melee) {
        enemy.applyInkStack();
      }
      if (!enemy.dead && this.char.onBasicHit) this.char.onBasicHit(enemy, proj);
    }

    applyHitPassives(enemy) {
      if (!enemy) return;
      if (this.frostHits && enemy.applySlow) {
        enemy.applySlow(Math.max(0.35, 0.65 - 0.04 * (this.frostStacks - 1)), 1.4 + 0.25 * (this.frostStacks - 1));
      }
      if (this.emberHits && enemy.applyBurn) {
        enemy.applyBurn(2.0, 2.0 + 1.2 * (this.emberStacks - 1));
      }
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
        this.hp = Math.min(this.maxHp, this.hp + 1);
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
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 9);
      this.weaponFlash = Math.max(0, this.weaponFlash - dt);
      this.skillFlash = Math.max(0, this.skillFlash - dt);
      this.swiftTimer = Math.max(0, this.swiftTimer - dt);
      this.updateWeaponHooks(dt);

      // 护盾：脱战 4.5 秒后每秒回复 1 点，直到满值。
      if (this.armorRegenTimer > 0) {
        this.armorRegenTimer -= dt;
      } else if (this.armor < this.maxArmor) {
        this.armor = Math.min(this.maxArmor, this.armor + 1.0 * dt);
      }

      // 战斗中回能：有存活敌人才计数，每 2.5 秒 +1。
      const inCombat = this.game.enemies && this.game.enemies.some((e) => !e.dead && e.spawnTimer <= 0);
      if (inCombat && this.energy < this.maxEnergy) {
        this.energyRegenTimer += dt;
        while (this.energyRegenTimer >= 2.5 && this.energy < this.maxEnergy) {
          this.energyRegenTimer -= 2.5;
          this.energy += 1;
        }
      } else {
        this.energyRegenTimer = 0;
      }

      // 主动技能输入（桌面空格 / 右键；触屏由 game 设置 skillRequest）
      if (this.game.skillRequest) {
        this.game.skillRequest = false;
        this.tryUseSkill();
      }
      const input = this.game.input;
      if (input.wasPressed('Space', 'KeyE')) this.tryUseSkill();
      if (input.wasPressed('KeyG')) this.dropWeapon();
      if (input.wasPressed('KeyQ')) this.switchWeapon();
      const rightNow = input.mouse.right;
      if (rightNow && !this._prevRight) this.tryUseSkill();
      this._prevRight = rightNow;

      // 移动
      const mv = this.game.getMoveVector();
      const charBonus = this.char && this.char.speedBonus ? this.char.speedBonus() : 0;
      const sp = this.speed * (1 + charBonus)
        * (this.speedBoostTimer > 0 ? 1.25 : 1)
        * (this.swiftTimer > 0 ? Math.min(1.55, 1.25 + 0.06 * Math.max(0, this.swiftStacks - 1)) : 1)
        * (this.maskTimer > 0 ? 1.15 : 1)
        * (this.captureSlow || 1)
        * (this.chargeTimer > 0 ? (this.weapon.chargeSlow || 0.58) : 1)
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
      const crit = Math.random() < (this.critChance + this.relicCrit);
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
        pierce: (opts.pierce || 0) + this.bonusPierce,
        life: opts.life || 1.6,
        homing: (opts.homing || 0) + this.bonusHoming,
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
      const stacks = Math.max(1, this.critBurstStacks || 1);
      const radius = 54 + 8 * (stacks - 1);
      Ink.FX.ring(this.game, {
        x: enemy.x, y: enemy.y, r0: 4, r1: radius, life: 0.25,
        color: '#ffb35c', width: 2
      });
      for (const e of this.game.enemies.slice()) {
        if (e.dead || e === enemy || e.spawnTimer > 0) continue;
        if (U.dist(enemy.x, enemy.y, e.x, e.y) > radius + e.radius) continue;
        this.game.damageEnemy(e, this.damage * (0.5 + 0.12 * (stacks - 1)), {
          source: 'passive', sourceKey: 'critburst', color: '#ffb35c'
        });
      }
    }

    melee(opts) {
      const angle = this.aimAngle + (opts.angleOffset || 0);
      const range = opts.range || 80;
      const arc = opts.arc || 1.4;
      const critCount = Math.random() < (this.critChance + this.relicCrit);
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
      const skillCost = Math.max(0, this.skillEnergyCost - (this.relicSkillCost || 0));
      if (skillCost > 0 && this.energy < skillCost) {
        this._showEnergyToast('能量不足 · 技能无法发动');
        return false;
      }
      const ok = this.char.useSkill();
      if (ok) {
        this.energy = Math.max(0, this.energy - skillCost);
        const accent = this.def.accent || PAL.gold;
        this.skillCd = this.skillCdMax * (this.relicCdMult || 1);
        this.skillFlash = 0.55;
        this.game.addShake(3.2, 0.18);
        Ink.FX.ring(this.game, {
          x: this.x, y: this.y - 4, r0: 8, r1: 62, life: 0.18,
          color: '#fff6dc', width: 3
        });
        Ink.FX.ring(this.game, {
          x: this.x, y: this.y - 4, r0: 18, r1: 92, life: 0.5,
          color: accent, width: 2
        });
        Ink.FX.ring(this.game, {
          x: this.x, y: this.y - 4, r0: 30, r1: 74, life: 0.34,
          color: accent, width: 6
        });
        Ink.FX.burst(this.game, this.x, this.y - 3, [accent, '#fff6dc'], 22, 155, {
          size: 3, glow: true, life: 0.55
        });
        Ink.FX.text(this.game, this.def.skillName || '技能', this.x, this.y - 52, accent, 15, 0.9);
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
      // 守门人遗物可以削减减速时间；叠满时几乎免疫。
      const d = duration * (1 - (this.relicSlowResist || 0));
      if (d <= 0.02) return;
      this.slowMult = Math.min(this.slowMult, mult);
      this.slowTimer = Math.max(this.slowTimer, d);
    }

    takeDamage(amount, source, opts = {}) {
      if (this.dead || this.invuln > 0) return;
      // 铜鼓玉璧：只减免敌方弹幕，不减免近战/范围。
      if (opts.ranged && this.relicRangedResist > 0) {
        amount *= (1 - this.relicRangedResist);
      }
      // 纸甲：完全挡下一次伤害，然后进入冷却。
      if (this.paperShield && this.paperShieldCd <= 0) {
        this.paperShieldCd = Math.max(4, 9 - 1.5 * Math.max(0, this.paperShieldStacks - 1));
        this.invuln = 0.45;
        Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 18, r1: 58, life: 0.35, color: '#e8dfc2', width: 4 });
        Ink.FX.text(this.game, '纸甲', this.x, this.y - 34, '#e8dfc2', 14, 0.7);
        this.game.audio.sfx('armor');
        return;
      }
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

      if (this.hp <= 0 && this.reviveCharges > 0) {
        // 涅槃：消耗一层免费复活，半血站起并清空周围敌弹。
        this.reviveCharges--;
        this.hp = Math.max(1, Math.round(this.maxHp * 0.5));
        this.invuln = 2.5;
        this.armorRegenTimer = 0;
        for (const p of this.game.projectiles) {
          if (p.owner === 'enemy' && U.dist(this.x, this.y, p.x, p.y) < 240) p.dead = true;
        }
        Ink.FX.burst(this.game, this.x, this.y, ['#ffb35c', '#e8c170', '#fff6dc'], 38, 240, {
          size: 4, glow: true, lifeMult: 1.4
        });
        Ink.FX.ring(this.game, { x: this.x, y: this.y, r0: 10, r1: 170, life: 0.8, color: '#ffb35c', width: 5 });
        Ink.FX.text(this.game, '涅槃 · 再起', this.x, this.y - 48, '#ffb35c', 18, 1.4);
        this.game.addShake(9, 0.5);
        this.game.audio.sfx('levelup');
        return;
      }
      if (this.hp <= 0 && this.deathWard) {
        // 替页：每局一次，撕掉致命的一页，回到 35% 生命。
        this.deathWard = false;
        this.hp = Math.max(1, Math.round(this.maxHp * 0.35));
        this.invuln = 2.0;
        Ink.FX.burst(this.game, this.x, this.y, ['#fff6dc', '#e8c170', '#ffffff'], 42, 220, {
          size: 4, glow: true, lifeMult: 1.6
        });
        Ink.FX.text(this.game, '替页 · 免死', this.x, this.y - 48, '#ffe6a8', 18, 1.4);
        this.game.addShake(8, 0.45);
        this.game.audio.sfx('levelup');
        return;
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
      if (this.guardian) this.addArmor(4 * Math.max(1, this.guardianStacks));
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
      if (this.energyOnKill > 0) this.addEnergy(this.energyOnKill);
      if (this.maskTimer > 0) this.maskTimer = Math.min(13, this.maskTimer + 1.2);
      if (enemy && this.compassTarget === enemy) this.compassTarget = null;
      if (this.armorOnKill > 0) this.addArmor(this.armorOnKill);
    }

    // ── 绘制 ──────────────────────────────────────────────
    draw(ctx, game) {
      if (this.dead) return;
      this.char.drawWorld(ctx, game);

      const mv = this.game.getMoveVector();
      const walking = Math.abs(mv.x) + Math.abs(mv.y) > 0;
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

      // 蓄力环：按住时从 0 蓄到满，满蓄有一圈金色脉冲。
      if (this.weapon && this.weapon.charged && this.chargeTimer > 0) {
        const k = U.clamp(this.chargeTimer, 0, 1);
        ctx.save();
        ctx.strokeStyle = 'rgba(232,193,112,.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 28, 0, U.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffe6a8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 28, -Math.PI / 2, -Math.PI / 2 + U.TAU * k);
        ctx.stroke();
        if (this.weapon.chargePerfect) {
          const [lo, hi] = this.weapon.chargePerfect;
          ctx.strokeStyle = 'rgba(255,224,138,.75)';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(this.x, this.y - 2, 28,
            -Math.PI / 2 + U.TAU * lo, -Math.PI / 2 + U.TAU * hi);
          ctx.stroke();
          if (k >= lo && k <= hi) {
            ctx.globalAlpha = 0.6 + Math.sin(this.time * 18) * 0.2;
            ctx.strokeStyle = '#fff6dc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y - 2, 34, 0, U.TAU);
            ctx.stroke();
          }
        }
        if (k >= 1) {
          ctx.globalAlpha = 0.45 + Math.sin(this.time * 16) * 0.2;
          ctx.strokeStyle = '#fff6dc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(this.x, this.y - 2, 34, 0, U.TAU);
          ctx.stroke();
        }
        ctx.restore();

        // 角色头顶的蓄力条：长按左键时出现；金线是完美区间。
        const bx = this.x - 24;
        const by = this.y - 56 + bob;
        ctx.save();
        ctx.fillStyle = 'rgba(5,4,10,.82)';
        ctx.fillRect(bx - 2, by - 2, 52, 10);
        ctx.fillStyle = 'rgba(232,193,112,.22)';
        ctx.fillRect(bx, by, 48, 6);
        const grad = ctx.createLinearGradient(bx, 0, bx + 48, 0);
        grad.addColorStop(0, '#8fd6ff');
        grad.addColorStop(1, '#ffe6a8');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, 48 * k, 6);
        if (this.weapon.chargePerfect) {
          const [lo, hi] = this.weapon.chargePerfect;
          ctx.fillStyle = 'rgba(255,246,220,.9)';
          ctx.fillRect(bx + 48 * lo, by - 1, Math.max(1, 48 * (hi - lo)), 8);
        }
        ctx.strokeStyle = 'rgba(232,193,112,.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 0.5, by - 0.5, 49, 7);
        ctx.restore();
      }

      // 英雄轮廓强化：角色专属色的披帛/衣带随行走摆动，静止时轻轻呼气。
      const accent = this.def.accent || this.def.color || PAL.gold;
      const sway = Math.sin(this.time * 7.5) * 2.6 + (walking ? 2.2 : 0);
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(this.x - this.facing * 7, this.y + bob - 7);
      ctx.lineTo(this.x - this.facing * (21 + sway), this.y + bob - 1);
      ctx.lineTo(this.x - this.facing * (18 + sway * 0.6), this.y + bob + 7);
      ctx.lineTo(this.x - this.facing * 8, this.y + bob + 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 移动残影：两层低透明度角色剪影，让英雄移动更有速度感。
      if (walking) {
        for (let i = 2; i >= 1; i--) {
          ctx.save();
          ctx.globalAlpha = 0.06 + i * 0.025;
          Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x - mv.x * 7 * i, this.y + bob - mv.y * 4 * i, 2.2, {
            frame, flip: this.facing < 0, tint: accent
          });
          ctx.restore();
        }
      }

      Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x, this.y + bob, 2.2, {
        frame,
        flip: this.facing < 0,
        alpha: blink ? 0.55 : 1
      });
      if (this.hitFlash > 0) {
        Ink.Art.drawSprite(ctx, 'char:' + this.charId, this.x, this.y + bob, 2.2, {
          frame, flip: this.facing < 0, alpha: 0.5, tint: '#ffffff'
        });
      }

      // 手持武器实体：跟随手部、朝准星旋转，开火时后坐 + 枪口火光
      if (this.weapon && this.weapon.id !== 'fists') {
        // 武器挂在手部：沿瞄准方向伸出手臂，避免整把枪压在角色身体里。
        // 手部略偏身体一侧：即使朝正上/正下瞄准，武器也不会整把糊在脸上。
        const handX = this.x + this.facing * 17 + Math.cos(this.aimAngle) * 6;
        const handY = this.y + bob + 3 + Math.sin(this.aimAngle) * 11;
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

      // 环刃：绕身旋转的青色墨刃。
      if (this.orbit) {
        const blades = 2 + Math.max(0, this.orbitStacks - 1);
        for (let i = 0; i < blades; i++) {
          const a = this.orbitAngle + i * U.TAU / blades;
          const bx = this.x + Math.cos(a) * 54;
          const by = this.y + Math.sin(a) * 54;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = '#9fe8ff';
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(0, -7); ctx.lineTo(3, 0); ctx.lineTo(0, 7); ctx.lineTo(-3, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // 纸甲就绪提示：腰间一层淡纸光。
      if (this.paperShield && this.paperShieldCd <= 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.time * 3) * 0.1;
        ctx.strokeStyle = '#e8dfc2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y + 2, 20, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 技能释放瞬间的通用光爆，强化“按下技能”的反馈
      if (this.skillFlash > 0) {
        const k = 1 - this.skillFlash / 0.55;
        const accent = this.def.accent || PAL.gold;
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.75;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 28 + k * 96, 0, U.TAU);
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.45;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 38 + k * 68, 0, U.TAU);
        ctx.stroke();
        // 旋转符钉：让每个角色的技能都有“开阵”的仪式感。
        for (let i = 0; i < 8; i++) {
          const a = game.time * 2.2 + i * Math.PI / 4;
          const r = 42 + k * 54;
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.fillStyle = '#fff6dc';
          ctx.fillRect(
            this.x + Math.cos(a) * r - 1.5,
            this.y - 2 + Math.sin(a) * r - 1.5, 3, 3
          );
        }
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
