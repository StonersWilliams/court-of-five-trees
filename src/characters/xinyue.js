/**
 * src/characters/xinyue.js
 * 心阅 —— 辅助防御
 *
 * 被动「洞察」：自动标记房间内生命上限最高的敌人；该敌人第一次伤害
 *               心阅时减免 60%。
 * 主动「心域」：展开持续 3.4 秒的心域，完全偏转下一次伤害；
 *               若心域结束时没有触发，则回复 8 点护甲。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class Xinyue extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.marked = null;
      this.firstReductionUsed = false;
      this.domainTimer = 0;
      this.domainMax = 2.5;
      this.domainUsed = false;
      this.domainCharges = 3;
      this.domainRadius = 84;
      this.domainReflected = 0;
    }

    onSpawn() {
      this.pickMark();
    }

    onRoomEnter() {
      this.firstReductionUsed = false;
      this.pickMark();
    }

    pickMark() {
      let best = null;
      for (const e of this.game.enemies) {
        if (e.dead) continue;
        if (!best || e.maxHp > best.maxHp) best = e;
      }
      if (this.marked && this.marked !== best) this.marked._xinyueMark = false;
      this.marked = best;
      this.firstReductionUsed = false;
      if (best) {
        best._xinyueMark = true;
        Ink.FX.ring(this.game, { x: best.x, y: best.y, r0: 70, r1: 20, life: 0.5, color: '#ff9bb0', width: 2 });
      }
    }

    update(dt) {
      if (!this.marked || this.marked.dead) this.pickMark();

      if (this.domainTimer > 0) {
        this.domainTimer -= dt;
        if (this.domainTimer <= 0) {
          this.domainTimer = 0;
          if (this.domainReflected === 0) {
            this.player.addArmor(8);
            Ink.FX.text(this.game, '心域·余温 +8 护盾', this.player.x, this.player.y - 44, '#ffc2d4', 12, 0.9);
            this.game.audio.sfx('armor');
          }
        }
      }
    }

    basicAttack() {
      const p = this.player;
      const target = this.marked && !this.marked.dead ? this.marked : null;
      p.fireBasic({
        visual: 'heart',
        color: '#ff9bb0',
        speed: 430,
        radius: 6,
        damageMult: 0.95,
        homing: !!target,
        homingTarget: target,
        homingDelay: 0.08,
        trail: true,
        glow: true
      });
      this.game.audio.sfx('shoot');
      return true;
    }

    useSkill() {
      if (this.domainTimer > 0) return false;
      this.domainTimer = this.domainMax;
      this.domainUsed = false;
      this.domainCharges = 3;
      this.domainReflected = 0;
      const p = this.player;
      Ink.FX.ring(this.game, {
        x: p.x, y: p.y, r0: 8, r1: 96, life: 0.5, color: '#ff9bb0', width: 3
      });
      Ink.FX.burst(this.game, p.x, p.y, ['#ff9bb0', '#fff6e7'], 16, 90, {
        size: 3, glow: true, lifeMult: 1.2
      });
      Ink.FX.text(this.game, '心域', p.x, p.y - 44, '#ffd0dd', 15, 0.9);
      this.game.audio.sfx('skill');
      return true;
    }

    beforeDamage(amount, source) {
      if (source && source === this.marked && !this.firstReductionUsed) {
        this.firstReductionUsed = true;
        Ink.FX.ring(this.game, {
          x: this.player.x, y: this.player.y, r0: 8, r1: 52, life: 0.35, color: '#ff9bb0', width: 3
        });
        Ink.FX.text(this.game, '心阅·减伤 60%', this.player.x, this.player.y - 42, '#ffc2d4', 13, 0.8);
        this.game.audio.sfx('armor');
        return amount * 0.4;
      }
      return amount;
    }

    speedBonus() {
      return this.domainTimer > 0 ? 0.10 : 0;
    }

    tryDeflect(source, amount) {
      if (this.domainTimer > 0 && this.domainCharges > 0) {
        this.domainCharges--;
        this.domainUsed = true;
        this.domainReflected++;
        const p = this.player;
        // 反弹来源：优先直接攻击者，弹幕则回溯发射者。
        let attacker = source;
        if (attacker && attacker.source && attacker.source !== attacker) attacker = attacker.source;
        if (attacker && attacker.takeDamage && !attacker.isPlayer && !attacker.dead) {
          attacker.takeDamage(Math.max(1, Math.round(amount * 1.5)), { source: 'xinyue', color: '#ff9bb0' });
          attacker.vulnTimer = 3;
          attacker.vulnMult = 1.15;
        }
        Ink.FX.ring(this.game, {
          x: p.x, y: p.y, r0: 70, r1: 12, life: 0.45, color: '#ffd0dd', width: 4
        });
        Ink.FX.burst(this.game, p.x, p.y, ['#ff9bb0', '#fff6e7', '#ffd36b'], 22, 140, {
          size: 4, glow: true
        });
        Ink.FX.text(this.game, '心域·偏转', p.x, p.y - 46, '#ffe6f0', 15, 1.0);
        this.game.audio.sfx('armor');
        this.game.addShake(3, 0.16);
        if (this.domainCharges <= 0) this.domainTimer = 0;
        return true;
      }
      return false;
    }

    onKill(enemy) {
      if (enemy === this.marked) {
        this.player.addArmor(2);
        this.marked = null;
        // 稍后重新标记，避免在遍历 enemies 时改数组
        this.game.after(0.25, () => this.pickMark());
      }
    }

    drawWorld(ctx, game) {
      const p = this.player;
      // 心域
      if (this.domainTimer > 0) {
        const t = this.domainTimer / this.domainMax;
        const r = this.domainRadius + Math.sin(game.time * 4) * 4;
        ctx.save();
        ctx.globalAlpha = 0.3 + t * 0.25;
        ctx.strokeStyle = '#ff9bb0';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -game.time * 26;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, U.TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha *= 0.18;
        ctx.fillStyle = '#ff9bb0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, U.TAU);
        ctx.fill();
        // 四枚心形护符
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffd0dd';
        for (let i = 0; i < 4; i++) {
          const a = game.time * 1.2 + i * Math.PI / 2;
          const x = p.x + Math.cos(a) * r;
          const y = p.y + Math.sin(a) * r;
          ctx.fillRect(x - 2, y - 1, 4, 3);
          ctx.fillRect(x - 1, y - 2, 2, 2);
        }
        ctx.restore();
      }

      // 被动标记
      const m = this.marked;
      if (m && !m.dead) {
        const pulse = 0.7 + Math.sin(game.time * 5) * 0.2;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff9bb0';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = game.time * 20;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 15, 0, U.TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        // 小箭头
        ctx.fillStyle = '#ffc2d4';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - m.radius - 34);
        ctx.lineTo(m.x - 4, m.y - m.radius - 26);
        ctx.lineTo(m.x + 4, m.y - m.radius - 26);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  Ink.registerCharacter({
    id: 'xinyue',
    name: '心阅',
    title: '观心者',
    role: '辅助 · 防御',
    color: PAL.xinyue,
    accent: '#ff9bb0',
    hp: 20,
    armor: 8,
    speed: 195,
    damage: 7,
    atkInterval: 0.5,
    range: 540,
    cooldown: 9.5,
    skillName: '心域',
    skillDesc: '展开 3.4 秒心域，偏转下一次伤害；未触发则回复 8 点护甲。',
    passiveName: '洞察',
    passiveDesc: '标记房间内生命上限最高的敌人，其第一次伤害减免 60%。',
    quote: '别急着动手，我先听听你的心。',
    create(player, game) { return new Xinyue(player, game); }
  });
})();
