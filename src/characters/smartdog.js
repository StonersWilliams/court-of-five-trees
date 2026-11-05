/**
 * src/characters/smartdog.js
 * 御狶 —— 召唤协同
 *
 * 被动「影犬」：自带一只自动攻击的影犬，会替主人分担 34% 伤害；
 *               影犬被击破时回复 6 点护甲，并缩短 3 秒召唤时间。
 * 主动「影犬·冲锋」：命令影犬冲向最近的敌人，落地嘲讽周围敌人 3.4 秒；
 *                     若影犬处于被击破状态，会立即以 50% 生命复活。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class SmartDog extends Ink.CharacterBase {
    onSpawn() {
      if (!this.game.dog) {
        this.game.dog = new Ink.ShadowDog(this.game, this.player);
      }
    }

    onRoomEnter() {
      // 换房间时影犬跟着主人，不重新召唤
      const dog = this.game.dog;
      if (dog && dog.alive) {
        dog.x = this.player.x - 40;
        dog.y = this.player.y + 20;
      }
    }

    update(dt) {
      if (!this.game.dog) {
        this.game.dog = new Ink.ShadowDog(this.game, this.player);
      }
    }

    basicAttack() {
      const p = this.player;
      p.fireBasic({
        visual: 'bone',
        color: PAL.smartdog,
        speed: 540,
        radius: 5,
        damageMult: 0.85,
        knockback: 55,
        trail: true
      });
      this.game.audio.sfx('bark');
      return true;
    }

    useSkill() {
      const pack = this.game.commandDogPack ? this.game.commandDogPack() : null;
      if (!pack || !pack.any) return false;
      Ink.FX.text(this.game, pack.revived ? '影犬·归位 ×' + pack.count : '影犬·冲锋 ×' + pack.count,
        this.player.x, this.player.y - 44, '#ffe6a8', 14, 0.8);
      return true;
    }

    onDogBroken() {
      const p = this.player;
      const dog = this.game.dog;
      p.addArmor(6);
      if (dog) dog.reduceRespawn(3);
      Ink.FX.text(this.game, '影犬·破 → 护甲 +6', p.x, p.y - 48, '#ffd36b', 13, 1.1);
      this.game.audio.sfx('armor');
    }

    drawWorld(ctx, game) {
      const dog = game.dog;
      if (!dog || !dog.alive) return;
      const p = this.player;
      const a = U.angleTo(dog, p);
      const d = U.dist(dog.x, dog.y, p.x, p.y);
      if (d > 42 && d < 280) {
        ctx.save();
        ctx.globalAlpha = 0.12 + Math.sin(game.time * 4) * 0.03;
        ctx.strokeStyle = '#b48cff';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -game.time * 14;
        ctx.beginPath();
        ctx.moveTo(dog.x, dog.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      // 冲锋指令的虚线标记
      if (dog.mode === 'charge' && dog.chargeTarget) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ffe6a8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(dog.x, dog.y);
        ctx.lineTo(dog.chargeTarget.x, dog.chargeTarget.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  Ink.registerCharacter({
    id: 'smartdog',
    name: '御狶',
    title: '庭前驯兽师',
    role: '召唤 · 协同',
    color: PAL.smartdog,
    accent: '#b48cff',
    hp: 96,
    armor: 5,
    speed: 210,
    damage: 7,
    atkInterval: 0.5,
    range: 540,
    cooldown: 8.5,
    skillName: '影犬·冲锋',
    skillDesc: '命令整群影犬冲锋，分散扑咬并嘲讽周围敌人 3.4 秒；被击破的影犬立即以 50% 生命复活。',
    passiveName: '影犬群',
    passiveDesc: '影犬自动攻击并分担 34% 伤害；每层多一只，最多 8 只；脱战后缓慢回血，被击破时回复 6 护甲并缩短召唤时间。',
    quote: '别怕，它们不咬人——只咬不听话的。',
    create(player, game) { return new SmartDog(player, game); }
  });
})();
