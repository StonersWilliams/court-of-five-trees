/**
 * src/characters/qiyun.js
 * 棋云 —— 中距离控场
 *
 * 被动「弈子」：每次施放主动技能，会在原地留下一枚弈子（最多 6 枚）。
 * 主动「棋局·引爆」：引爆场上全部弈子，造成范围伤害并减速；
 *                   引爆后会在脚下再落下一枚新的弈子。
 *
 * 玩法：先攒子，再把敌人引进棋位，一次引爆清场。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  class Qiyun extends Ink.CharacterBase {
    constructor(player, game) {
      super(player, game);
      this.pieces = [];
      this.chessHits = 0;
    }

    onRoomEnter() {
      // 换房间时旧棋局作废，避免跨房间残留
      this.pieces.length = 0;
      this.chessHits = 0;
    }

    onBasicHit(enemy) {
      // 棋势：普攻命中也积累落子，避免主动只能炸一枚
      if (!enemy || enemy.dead) return;
      this.chessHits++;
      if (this.chessHits < 5) return;
      this.chessHits = 0;
      if (this.pieces.length >= 6) return;
      this.pieces.push({
        x: enemy.x, y: enemy.y, life: 26, maxLife: 26, phase: Math.random() * 6
      });
      Ink.FX.ring(this.game, {
        x: enemy.x, y: enemy.y, r0: 26, r1: 6, life: 0.35, color: PAL.gold, width: 2
      });
      Ink.FX.text(this.game, '棋势·落子', enemy.x, enemy.y - 34, '#ffe6a8', 11, 0.65);
    }

    basicAttack() {
      const p = this.player;
      p.fireBasic({
        visual: 'chess',
        color: PAL.qiyun,
        speed: 570,
        radius: 5,
        damageMult: 1,
        knockback: 30,
        trail: true
      });
      this.game.audio.sfx('shoot');
      return true;
    }

    useSkill() {
      const p = this.player;
      const g = this.game;
      const dmg = 24 + p.level * 2.8 + p.upgrades.damage * 2.2;

      // 引爆已有弈子
      let count = 0;
      for (const piece of this.pieces) {
        if (piece.life <= 0) continue;
        count++;
        Ink.FX.explosion(g, piece.x, piece.y, 92, PAL.gold);
        Ink.FX.ring(g, { x: piece.x, y: piece.y, r0: 10, r1: 104, life: 0.42, color: PAL.gold, width: 4 });
        for (const e of g.enemies) {
          if (e.dead) continue;
          if (U.dist(piece.x, piece.y, e.x, e.y) < 96 + e.radius) {
            g.damageEnemy(e, dmg, {
              color: '#ffe6a8', crit: false,
              knockback: 80, angle: U.angleTo(piece, e)
            });
            e.applySlow(0.5, 2.0);
          }
        }
      }

      this.pieces.length = 0;
      // 被动：技能结束后留下一枚新弈子
      this.pieces.push({
        x: p.x, y: p.y, life: 26, maxLife: 26, phase: Math.random() * 6
      });
      if (this.pieces.length > 6) this.pieces.shift();

      if (count > 0) {
        g.audio.sfx('explosion');
        g.addShake(5 + count * 1.5, 0.3);
        Ink.FX.text(g, '棋局·引爆 ×' + count, p.x, p.y - 46, '#ffe6a8', 15, 1.0);
      } else {
        g.audio.sfx('skill');
        Ink.FX.text(g, '落子', p.x, p.y - 42, '#ffe6a8', 14, 0.8);
      }
      Ink.FX.ring(g, { x: p.x, y: p.y, r0: 30, r1: 6, life: 0.35, color: PAL.gold, width: 2 });
      return true;
    }

    update(dt) {
      for (let i = this.pieces.length - 1; i >= 0; i--) {
        const piece = this.pieces[i];
        piece.life -= dt;
        if (piece.life <= 0) this.pieces.splice(i, 1);
      }
    }

    drawWorld(ctx, game) {
      for (const piece of this.pieces) {
        const t = game.time + piece.phase;
        const fade = U.clamp(piece.life / 2, 0, 1);
        const pulse = 0.5 + Math.sin(t * 3.5) * 0.2;
        ctx.save();
        ctx.globalAlpha = fade;
        // 地面棋格
        ctx.translate(piece.x, piece.y + 12);
        ctx.fillStyle = 'rgba(10,8,16,.55)';
        ctx.fillRect(-13, -5, 26, 10);
        ctx.strokeStyle = U.rgba(PAL.gold, pulse);
        ctx.lineWidth = 1;
        ctx.strokeRect(-13.5, -5.5, 27, 11);
        // 棋子
        ctx.translate(0, -13);
        ctx.fillStyle = 'rgba(5,4,10,.8)';
        ctx.beginPath();
        ctx.ellipse(0, 13, 10, 4, 0, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(-7, -6, 14, 4);
        ctx.fillStyle = '#f7df9c';
        ctx.fillRect(-5, -10, 10, 4);
        ctx.fillStyle = PAL.qiyun;
        ctx.fillRect(-3, -14, 6, 4);
        ctx.fillStyle = '#241a10';
        ctx.fillRect(-1, -9, 2, 2);
        // 灵气
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.12;
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(0, -4, 24 + Math.sin(t * 4) * 4, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  Ink.registerCharacter({
    id: 'qiyun',
    name: '棋云',
    title: '庭中棋士',
    role: '中距离 · 控场',
    color: PAL.qiyun,
    accent: PAL.gold,
    hp: 92,
    armor: 4,
    speed: 205,
    damage: 9,
    atkInterval: 0.46,
    range: 560,
    cooldown: 7.5,
    skillName: '棋局·引爆',
    skillDesc: '引爆全部弈子，造成范围伤害并减速 50%。施放后原地留下一枚新弈子。',
    passiveName: '弈子',
    passiveDesc: '施放技能后原地留下弈子；普攻每命中 5 次额外落一子（最多 6 枚）。',
    quote: '落子无悔，悔也无用。',
    create(player, game) { return new Qiyun(player, game); }
  });
})();
