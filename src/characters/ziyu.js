/**
 * src/characters/ziyu.js
 * 字狱 —— 中远距离封锁
 *
 * 被动「墨痕字印」：普通攻击为敌人叠加字印（最多 5 层）。
 *   - 每层使字狱对其造成的伤害 +8%；
 *   - 叠满时短暂减速。
 * 主动「落笔成狱」：在指定位置书写“狱”字，生成文字牢笼。
 *   - 范围内普通敌人被禁锢并持续受伤；
 *   - Boss 不被完全困住，改为大幅减速；
 *   - 精英的禁锢时间减半；
 *   - 字印层数会延长牢笼持续时间并提升伤害；
 *   - 牢笼结束时触发“收笔”范围爆发。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  // 把“狱”字渲染到 40x40 的小画布，再整数放大，得到像素化的书法字
  let glyphCache = null;
  function getGlyph() {
    if (glyphCache) return glyphCache;
    const cv = document.createElement('canvas');
    cv.width = 40; cv.height = 40;
    const c = cv.getContext('2d');
    c.fillStyle = '#000000';
    c.fillRect(0, 0, 40, 40);
    c.fillStyle = '#ffffff';
    c.font = 'bold 36px "KaiTi", "STKaiti", "SimSun", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('狱', 20, 22);
    // 阈值化，去掉抗锯齿灰边，保留纯像素
    const img = c.getImageData(0, 0, 40, 40);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i];
      const on = v > 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 255 : 0;
      img.data[i + 3] = on ? 255 : 0;
    }
    c.putImageData(img, 0, 0);
    glyphCache = cv;
    return cv;
  }

  /**
   * 文字牢笼：独立的效果对象，加入 game.effects。
   * 需要实现 update(dt, game) / draw(ctx, game) / dead。
   */
  class InkCage {
    constructor(game, o) {
      this.x = o.x;
      this.y = o.y;
      this.radius = o.radius || 108;
      this.maxStacks = o.maxStacks || 0;
      this.life = o.life || 3.2;
      this.maxLife = this.life;
      this.baseDamage = o.baseDamage || 8;
      this.color = o.color || '#ff7a6b';
      this.accent = o.accent || PAL.gold;
      this.source = o.source || null;
      this.tickTimer = 0;
      this.elapsed = 0;
      this.dead = false;
      this.flash = 0;
    }

    update(dt, game) {
      if (this.dead) return;
      this.life -= dt;
      this.elapsed += dt;
      this.flash = Math.max(0, this.flash - dt);

      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.tickTimer = 0.4;
        for (const e of game.enemies) {
          if (e.dead || e.spawnTimer > 0) continue;
          if (U.dist(this.x, this.y, e.x, e.y) > this.radius + e.radius) continue;
          const stacks = e.inkStacks || 0;
          // 精英只在牢笼前半段被禁锢；Boss 只减速
          if (e.isBoss) {
            e.applySlow(0.4, 0.6);
          } else if (e.elite) {
            if (this.elapsed < this.maxLife * 0.5) {
              e.trappedTimer = Math.max(e.trappedTimer, 0.28);
            } else {
              e.applySlow(0.5, 0.5);
            }
          } else {
            e.trappedTimer = Math.max(e.trappedTimer, 0.28);
          }
          const dmg = this.baseDamage * (1 + 0.12 * stacks);
          game.damageEnemy(e, dmg, {
            color: '#ffb0a0', crit: false, source: 'cage'
          });
        }
      }

      if (this.life <= 0) {
        this.dead = true;
        this.burst(game);
      }
    }

    burst(game) {
      // 收笔：牢笼消失时的一次范围爆发
      const dmg = 26 + this.maxStacks * 8;
      Ink.FX.explosion(game, this.x, this.y, this.radius + 18, PAL.gold);
      Ink.FX.ring(game, {
        x: this.x, y: this.y, r0: 20, r1: this.radius + 40,
        life: 0.5, color: '#ffe6a8', width: 5
      });
      Ink.FX.text(game, '收笔', this.x, this.y - 56, '#ffe6a8', 18, 0.9);
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (U.dist(this.x, this.y, e.x, e.y) < this.radius + 26 + e.radius) {
          game.damageEnemy(e, dmg * (1 + 0.1 * (e.inkStacks || 0)), {
            color: '#ffd36b', crit: true, knockback: 90, angle: U.angleTo(this, e)
          });
        }
      }
      game.audio.sfx('explosion');
      game.addShake(6, 0.3);
    }

    draw(ctx, game) {
      const t = this.life / this.maxLife;
      const alpha = U.clamp(t * 4, 0, 1);
      const r = this.radius;
      ctx.save();
      ctx.globalAlpha = alpha;

      // 地面临时墨圈
      ctx.fillStyle = 'rgba(30,10,18,.28)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = U.rgba('#ff7a6b', 0.55 + Math.sin(game.time * 6) * 0.2);
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -game.time * 22;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // 八条墨柱
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU + game.time * 0.16;
        const px = this.x + Math.cos(a) * r;
        const py = this.y + Math.sin(a) * r;
        ctx.fillStyle = i % 2 ? '#7a2830' : '#a83a3a';
        ctx.fillRect(Math.round(px) - 2, Math.round(py) - 24, 4, 30);
        ctx.fillStyle = '#ffb0a0';
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 24, 1, 22);
      }

      // 像素书法“狱”
      const glyph = getGlyph();
      const size = Math.round(r * 1.15);
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (0.35 + Math.sin(game.time * 3) * 0.06);
      ctx.drawImage(glyph, this.x - size / 2, this.y - size / 2 - 6, size, size);
      ctx.globalCompositeOperation = 'source-over';

      // 字印越多，环上的朱砂点越多
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 5; i++) {
        const filled = i < this.maxStacks;
        ctx.fillStyle = filled ? '#e05a55' : 'rgba(120,90,100,.35)';
        ctx.fillRect(this.x - 15 + i * 7, this.y + r + 8, 5, 5);
      }
      ctx.restore();
    }
  }

  class Ziyu extends Ink.CharacterBase {
    basicAttack() {
      this.player.fireBasic({
        visual: 'ink',
        color: PAL.ziyu,
        speed: 610,
        radius: 5,
        damageMult: 1,
        trail: true
      });
      this.game.audio.sfx('shootInk');
      return true;
    }

    onBasicHit(enemy) {
      if (!enemy || enemy.dead) return;
      const stacks = enemy.applyInkStack();
      Ink.FX.burst(this.game, enemy.x, enemy.y, '#e05a55', 4, 55, { size: 2, lifeMult: 0.6 });
      if (stacks === 5) {
        Ink.FX.text(this.game, '字印·满', enemy.x, enemy.y - 38, '#ff9b90', 12, 0.7);
        this.game.audio.sfx('crit');
      }
    }

    useSkill() {
      const p = this.player;
      const g = this.game;
      const aim = p.getAimPoint();
      const A = Ink.ARENA;

      // 限制施法距离，避免全图乱放
      let dx = aim.x - p.x;
      let dy = aim.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxDist = 440;
      if (d > maxDist) {
        dx = dx / d * maxDist;
        dy = dy / d * maxDist;
      }
      const x = U.clamp(p.x + dx, A.x + 60, A.x + A.w - 60);
      const y = U.clamp(p.y + dy, A.y + 60, A.y + A.h - 60);

      // 计算范围内最高字印层数：决定持续时间
      let maxStacks = 0;
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (U.dist(x, y, e.x, e.y) < 120 + e.radius) {
          maxStacks = Math.max(maxStacks, e.inkStacks || 0);
        }
      }

      const baseDamage = 7 + p.level * 1.15 + p.upgrades.damage * 1.2;
      const cage = new InkCage(g, {
        x, y,
        radius: 108,
        maxStacks,
        life: 3.2 + maxStacks * 0.4,
        baseDamage,
        source: p
      });
      g.effects.push(cage);

      Ink.FX.ring(g, { x, y, r0: 6, r1: 120, life: 0.4, color: '#ff7a6b', width: 3 });
      Ink.FX.burst(g, x, y, ['#e05a55', '#e8c170', '#fff6e7'], 18, 100, {
        size: 3, gravity: 60, lifeMult: 1.2
      });
      Ink.FX.text(g, '落笔成狱' + (maxStacks > 0 ? ' · 印' + maxStacks : ''), x, y - 70, '#ffb0a0', 16, 1.1);
      g.audio.sfx('cage');
      g.addShake(4, 0.2);
      return true;
    }

    modifyDamageDealt(enemy, amount) {
      const stacks = enemy.inkStacks || 0;
      return stacks > 0 ? amount * (1 + 0.08 * stacks) : amount;
    }

    drawWorld(ctx, game) {
      // 脚下淡淡的墨痕，作为角色识别
      const p = this.player;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = PAL.ziyu;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 15, 16, 5, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  Ink.InkCage = InkCage;

  Ink.registerCharacter({
    id: 'ziyu',
    name: '字狱',
    title: '狱书人',
    role: '中远 · 封锁',
    color: PAL.ziyu,
    accent: '#e05a55',
    hp: 16,
    armor: 3,
    speed: 200,
    damage: 8,
    atkInterval: 0.55,
    range: 610,
    cooldown: 11,
    skillName: '落笔成狱',
    skillDesc: '在指定位置生成“狱”字牢笼，持续伤害并禁锢敌人；Boss 改为大幅减速，精英禁锢减半。',
    passiveName: '墨痕字印',
    passiveDesc: '普攻叠加字印，每层使字狱对其伤害 +8%，叠满短暂减速。',
    quote: '一笔成狱，字字皆刑。',
    create(player, game) { return new Ziyu(player, game); }
  });
})();
