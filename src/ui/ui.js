/**
 * src/ui/ui.js
 * ------------------------------------------------------------
 * 像素风界面：标题、角色选择、HUD、小地图、升级三选一、暂停、结算。
 * 同时负责触屏虚拟摇杆与技能按钮的输入分发。
 *
 * 约定：Game 拥有状态机，UI 只读取 game.state 并调用 game 的公开方法。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;

  const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  const MONO = '"Consolas", "Courier New", monospace';

  const UPGRADE_INFO = {
    damage: {
      name: '墨锋', color: '#ff9b7a',
      desc: '所有伤害 +18%。\n刀笔更重，清怪更快。'
    },
    atkSpeed: {
      name: '疾书', color: '#8fd6ff',
      desc: '攻击间隔 -12%。\n让墨迹连成一线。'
    },
    cooldown: {
      name: '回气', color: '#cbb1ff',
      desc: '技能冷却 -10%。\n最多减免到基础值的 55%。'
    },
    speed: {
      name: '踏影', color: '#8ef0c8',
      desc: '移动速度 +7%。\n走位是活下去的第一课。'
    },
    survival: {
      name: '护心', color: '#ffc2d4',
      desc: '生命上限 +12%，护甲 +2，\n并立刻回复生命。'
    }
  };

  // ── 小工具 ──────────────────────────────────────────────
  function setFont(ctx, size, bold) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
  }

  function text(ctx, str, x, y, opts = {}) {
    setFont(ctx, opts.size || 14, opts.bold);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.shadow !== false) {
      ctx.fillStyle = opts.shadowColor || 'rgba(3,2,8,.9)';
      ctx.fillText(str, x + (opts.shadowX === undefined ? 1 : opts.shadowX), y + (opts.shadowY === undefined ? 2 : opts.shadowY));
    }
    ctx.fillStyle = opts.color || PAL.parchment;
    ctx.fillText(str, x, y);
  }

  function wrapText(ctx, str, maxWidth, size) {
    setFont(ctx, size || 12, false);
    const lines = [];
    for (const paragraph of String(str).split('\n')) {
      let line = '';
      for (const ch of paragraph) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function wrapped(ctx, str, x, y, maxWidth, opts = {}) {
    const size = opts.size || 11;
    const lh = opts.lineHeight || Math.round(size * 1.55);
    const lines = wrapText(ctx, str, maxWidth, size);
    const max = opts.maxLines || lines.length;
    for (let i = 0; i < Math.min(lines.length, max); i++) {
      let line = lines[i];
      if (i === max - 1 && lines.length > max) line = line.slice(0, Math.max(0, line.length - 1)) + '…';
      text(ctx, line, x, y + i * lh, {
        size, color: opts.color || PAL.parchment2, align: opts.align || 'left', bold: opts.bold
      });
    }
    return Math.min(lines.length, max) * lh;
  }

  function panel(ctx, x, y, w, h, opts = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.save();
    // 像素投影
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x + 5, y + 6, w, h);
    // 主体
    ctx.fillStyle = opts.fill || 'rgba(15,12,26,.94)';
    ctx.fillRect(x, y, w, h);
    // 顶部高光
    ctx.fillStyle = opts.top || 'rgba(255,255,255,.035)';
    ctx.fillRect(x + 2, y + 2, w - 4, 2);
    // 双层边框
    ctx.strokeStyle = opts.border || PAL.slate2;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = opts.accent || 'rgba(232,193,112,.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    // 四角铆钉
    ctx.fillStyle = opts.rivet || PAL.gold;
    for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) {
      ctx.fillRect(cx, cy, 3, 3);
    }
    ctx.restore();
  }

  function bar(ctx, x, y, w, h, ratio, color, opts = {}) {
    ratio = U.clamp(ratio, 0, 1);
    ctx.save();
    ctx.fillStyle = opts.bg || 'rgba(4,3,9,.88)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * ratio), h);
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    ctx.fillRect(x, y, Math.round(w * ratio), 1);
    // 像素分段刻度
    if (opts.segments !== false) {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      for (let i = 1; i < 10; i++) {
        if (i * w / 10 < w * ratio) ctx.fillRect(Math.round(x + i * w / 10), y, 1, h);
      }
    }
    ctx.restore();
  }

  function hit(rect, x, y) {
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  function drawCornerMarks(ctx, x, y, w, h, color) {
    ctx.fillStyle = color || PAL.gold;
    const s = 8;
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.fillRect(sx > 0 ? cx : cx - s, sy > 0 ? cy : cy - 3, s, 3);
      ctx.fillRect(sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - s, 3, s);
    }
  }

  class UI {
    constructor(game) {
      this.game = game;
      this.buttons = [];
      this.hovered = null;
      this.time = 0;
      this.selectIndex = 0;
      this.helpOpen = false;
      this.toast = null;
      this.stick = {
        active: false, pointerId: null,
        cx: 112, cy: 492, radius: 58,
        dx: 0, dy: 0, nx: 0, ny: 0
      };
      this.skillCenter = { x: 846, y: 500, r: 44 };
      this.bossIntroShown = -1;
    }

    showToast(message, color = PAL.gold, duration = 1.9) {
      this.toast = { message, color, t: duration, max: duration };
    }

    // ── 输入 ──────────────────────────────────────────────
    update(dt) {
      this.time += dt;
      if (this.toast) {
        this.toast.t -= dt;
        if (this.toast.t <= 0) this.toast = null;
      }
      const input = this.game.input;
      const events = input.drainEvents();
      const state = this.game.state;

      if (this.helpOpen) {
        if (input.wasPressed('Escape', 'Enter', 'Space')) this.helpOpen = false;
        for (const e of events) {
          if (e.type !== 'down') continue;
          const b = this._findButton(e.x, e.y);
          if (b && b.label === '关 闭') {
            this.game.audio.sfx('ui');
            this.helpOpen = false;
            break;
          }
        }
        return;
      }

      for (const e of events) {
        if (e.pointerType === 'touch') this.game.touchMode = true;
        if (e.pointerType === 'mouse' && e.type === 'down') this.game.touchMode = false;

        if (state === 'playing') {
          this._handlePlayingPointer(e);
        } else {
          if (e.type === 'down') {
            const b = this._findButton(e.x, e.y);
            if (b && !b.disabled) {
              this.game.audio.sfx('ui');
              b.onClick();
              this.buttons = [];
              break;
            }
          }
        }
      }

      // 键盘快捷操作
      if (state === 'title') {
        if (input.wasPressed('Enter', 'Space')) {
          this.game.audio.sfx('ui');
          this.game.toSelect();
        }
      } else if (state === 'select') {
        if (input.wasPressed('ArrowLeft', 'KeyA')) {
          this.selectIndex = (this.selectIndex + 4) % 5;
          this.game.audio.sfx('ui');
        }
        if (input.wasPressed('ArrowRight', 'KeyD')) {
          this.selectIndex = (this.selectIndex + 1) % 5;
          this.game.audio.sfx('ui');
        }
        if (input.wasPressed('Enter', 'Space')) {
          const list = Ink.CharacterList;
          if (list[this.selectIndex]) this.game.startRun(list[this.selectIndex].id);
        }
      } else if (state === 'levelup') {
        const choices = this.game.upgradeChoices || [];
        for (let i = 0; i < Math.min(3, choices.length); i++) {
          if (input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
            this.game.chooseUpgrade(choices[i]);
          }
        }
      } else if (state === 'passive') {
        const choices = this.game.passiveChoices || [];
        for (let i = 0; i < Math.min(3, choices.length); i++) {
          if (input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
            this.game.choosePassive(choices[i]);
          }
        }
      } else if (state === 'shop') {
        if (input.wasPressed('Escape', 'KeyQ')) this.game.closeShop();
      } else if (state === 'gameover' || state === 'victory') {
        if (input.wasPressed('Enter')) this.game.restartRun();
      }

      // 触屏摇杆与技能
      if (state === 'playing' && this.game.touchMode) {
        if (!this.stick.active) {
          this.game.touchMove = { x: 0, y: 0 };
        } else {
          this.game.touchMove = { x: this.stick.nx, y: this.stick.ny };
        }
      } else {
        this.game.touchMove = { x: 0, y: 0 };
        this.stick.active = false;
        this.stick.pointerId = null;
        this.stick.nx = this.stick.ny = 0;
        this.stick.dx = this.stick.dy = 0;
      }
    }

    _findButton(x, y) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (b.screen === this.game.state && hit(b, x, y)) return b;
      }
      return null;
    }

    _button(ctx, rect, label, opts = {}) {
      const mouse = this.game.input.mouse;
      const hover = !this.game.touchMode && hit(rect, mouse.x, mouse.y);
      const selected = !!opts.selected;
      const disabled = !!opts.disabled;
      const x = rect.x, y = rect.y, w = rect.w, h = rect.h;

      ctx.save();
      ctx.fillStyle = disabled ? 'rgba(12,10,20,.8)' : selected ? 'rgba(232,193,112,.18)' : hover ? 'rgba(60,50,86,.95)' : 'rgba(28,23,44,.95)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = selected ? PAL.gold : hover ? PAL.gold2 : 'rgba(232,193,112,.5)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (selected) {
        ctx.fillStyle = 'rgba(232,193,112,.10)';
        ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      }
      if (!this.game.touchMode && hover && !disabled) {
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        ctx.fillRect(x + 2, y + 2, w - 4, h / 2);
      }
      const color = disabled ? PAL.muted : selected ? PAL.gold2 : PAL.parchment;
      text(ctx, label, x + w / 2, y + h / 2 + 1, {
        size: opts.size || 15, color, align: 'center', bold: true,
        shadowColor: 'rgba(0,0,0,.8)'
      });
      if (opts.hint) {
        text(ctx, opts.hint, x + w - 8, y + h - 8, {
          size: 9, color: 'rgba(207,192,157,.55)', align: 'right'
        });
      }
      ctx.restore();

      if (!disabled) {
        this.buttons.push({
          x, y, w, h, label, screen: this.game.state,
          onClick: opts.onClick || (() => {})
        });
      }
      return hover;
    }

    // ── 触屏操作 ──────────────────────────────────────────
    _handlePlayingPointer(e) {
      if (e.pointerType === 'mouse') {
        // 桌面端也允许点击右上角暂停按钮（其余鼠标操作交给战斗输入）。
        if (e.type === 'down' && e.x > 690 && e.x < 728 && e.y > 10 && e.y < 48) {
          this.game.togglePause();
        }
        return;
      }
      const s = this.stick;
      const p = this.skillCenter;

      if (e.type === 'down') {
        // 武器卡上的“丢”按钮（优先于摇杆，避免误触移动）。
        const dr = this.weaponDropRect;
        if (dr && e.x >= dr.x && e.x <= dr.x + dr.w && e.y >= dr.y && e.y <= dr.y + dr.h) {
          if (this.game.player) this.game.player.dropWeapon();
          return;
        }
        // 技能按钮（优先）
        if (U.dist(e.x, e.y, p.x, p.y) <= p.r + 16) {
          this.game.skillRequest = true;
          return;
        }
        // 摇杆
        if (U.dist(e.x, e.y, s.cx, s.cy) <= s.radius + 34 && !s.active) {
          s.active = true;
          s.pointerId = e.pointerId;
          this._updateStick(e.x, e.y);
          return;
        }
        // 暂停按钮
        if (e.x > 690 && e.x < 726 && e.y > 10 && e.y < 48) {
          this.game.togglePause();
          return;
        }
      } else if (e.type === 'move') {
        if (s.active && e.pointerId === s.pointerId) this._updateStick(e.x, e.y);
      } else if (e.type === 'up' || e.type === 'cancel') {
        if (s.active && e.pointerId === s.pointerId) {
          s.active = false;
          s.pointerId = null;
          s.dx = s.dy = s.nx = s.ny = 0;
          this.game.touchMove = { x: 0, y: 0 };
        }
      }
    }

    _updateStick(x, y) {
      const s = this.stick;
      let dx = x - s.cx;
      let dy = y - s.cy;
      const d = Math.hypot(dx, dy);
      if (d > s.radius) {
        dx = dx / d * s.radius;
        dy = dy / d * s.radius;
      }
      s.dx = dx;
      s.dy = dy;
      const nd = Math.hypot(dx, dy);
      s.nx = nd / s.radius > 0.18 ? dx / s.radius : 0;
      s.ny = nd / s.radius > 0.18 ? dy / s.radius : 0;
      this.game.touchMove = { x: s.nx, y: s.ny };
    }

    // ── 绘制入口 ──────────────────────────────────────────
    draw(ctx) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      this.buttons = [];
      const state = this.game.state;
      if (state === 'title') this._drawTitle(ctx);
      else if (state === 'select') this._drawSelect(ctx);
      else if (state === 'levelup') {
        this._drawHUD(ctx);
        this._drawLevelUp(ctx);
      } else if (state === 'passive') {
        this._drawHUD(ctx);
        this._drawPassive(ctx);
      } else if (state === 'shop') {
        this._drawHUD(ctx);
        this._drawShop(ctx);
      } else if (state === 'paused') {
        this._drawHUD(ctx);
        this._drawPause(ctx);
      } else if (state === 'gameover') {
        this._drawGameOver(ctx);
      } else if (state === 'victory') {
        this._drawVictory(ctx);
      } else {
        this._drawHUD(ctx);
      }

      if (this.helpOpen) this._drawHelp(ctx);
      this._drawToast(ctx);
      ctx.restore();
    }

    // ── 背景 ──────────────────────────────────────────────
    _drawBackdrop(ctx, tint = '#0b0914') {
      const w = 960, h = 600;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, tint);
      g.addColorStop(0.55, '#0a0812');
      g.addColorStop(1, '#05040a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 隐约棋盘格
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.fillStyle = PAL.gold;
      const size = 60;
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          if (((x / size) + (y / size)) % 2 === 0) ctx.fillRect(x, y, size, size);
        }
      }
      ctx.restore();

      // 漂浮墨点
      ctx.save();
      for (let i = 0; i < 34; i++) {
        const t = this.time * (0.1 + (i % 5) * 0.02) + i * 13.7;
        const x = (i * 191 + Math.sin(t) * 50) % w;
        const y = (i * 97 + t * 12) % h;
        const a = 0.06 + (i % 4) * 0.03;
        ctx.globalAlpha = a;
        ctx.fillStyle = i % 3 === 0 ? PAL.gold : PAL.violet;
        ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 3), 2 + (i % 2));
      }
      ctx.restore();

      // 暗角
      const vg = ctx.createRadialGradient(w / 2, h / 2, 220, w / 2, h / 2, 620);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.62)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    // ── 标题 ──────────────────────────────────────────────
    _drawTitle(ctx) {
      this._drawBackdrop(ctx, '#121022');
      const t = this.time;

      // 背景大字
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = PAL.parchment;
      setFont(ctx, 300, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('树', 480, 312);
      ctx.restore();

      // 棋盘线条装饰
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(170 + i * 78, 110);
        ctx.lineTo(170 + i * 78, 470);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(170, 110 + i * 45);
        ctx.lineTo(794, 110 + i * 45);
        ctx.stroke();
      }
      ctx.restore();

      // 羁绊墨线
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(300, 226);
      ctx.lineTo(660, 226);
      ctx.stroke();
      ctx.restore();

      text(ctx, '庭 有 五 棵 树', 480, 195, {
        size: 62, color: PAL.parchment, align: 'center', bold: true,
        shadowColor: '#000', shadowX: 4, shadowY: 6
      });
      text(ctx, 'COURT OF FIVE TREES', 480, 249, {
        size: 16, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '五树成庭，九主守门。', 480, 294, {
        size: 15, color: PAL.parchment2, align: 'center'
      });

      const pulse = 0.55 + Math.sin(t * 2.4) * 0.18;
      text(ctx, '三层 · 每层五关 · 九庭主 · 二十九兵刃', 480, 330, {
        size: 12, color: U.rgba(PAL.muted, pulse), align: 'center'
      });

      this._button(ctx, { x: 370, y: 372, w: 220, h: 54 }, '踏 入 庭 中', {
        size: 19,
        selected: true,
        onClick: () => this.game.toSelect()
      });
      this._button(ctx, { x: 370, y: 438, w: 220, h: 38 }, '操 作 说 明', {
        size: 13,
        onClick: () => { this.helpOpen = true; }
      });
      this._button(ctx, { x: 800, y: 548, w: 128, h: 30 }, this.game.audio.muted ? '音效：关' : '音效：开', {
        size: 11,
        onClick: () => this.game.toggleMute()
      });

      text(ctx, 'WASD 移动   ·   鼠标瞄准   ·   左键开火   ·   空格/右键技能   ·   G 丢武器', 480, 508, {
        size: 10, color: PAL.muted, align: 'center'
      });
      text(ctx, '触屏：左下摇杆移动，右下按钮技能；被动 / 商店 / 丢弃均可直接点选', 480, 528, {
        size: 10, color: 'rgba(109,99,136,.8)', align: 'center'
      });
      text(ctx, 'MIT License · 零依赖 · 程序化像素美术 / WebAudio 音效', 36, 580, {
        size: 9, color: 'rgba(109,99,136,.7)'
      });
      text(ctx, 'v2.1', 924, 580, { size: 9, color: 'rgba(109,99,136,.7)', align: 'right' });
    }

    // ── 角色选择 ──────────────────────────────────────────
    _drawSelect(ctx) {
      this._drawBackdrop(ctx, '#141126');
      const list = Ink.CharacterList;
      this.selectIndex = U.clamp(this.selectIndex, 0, list.length - 1);

      text(ctx, '选 择 你 的 执 棋 者', 480, 40, {
        size: 27, color: PAL.parchment, align: 'center', bold: true
      });
      text(ctx, '五树成庭，五人入局。被动常驻，主动需冷却。', 480, 70, {
        size: 11, color: PAL.muted, align: 'center'
      });

      const x0 = 36, y0 = 92, cw = 168, ch = 418, gap = 12;
      for (let i = 0; i < list.length; i++) {
        this._drawCharacterCard(ctx, list[i], x0 + i * (cw + gap), y0, cw, ch, i === this.selectIndex, i);
      }

      this._button(ctx, { x: 36, y: 530, w: 150, h: 44 }, '返 回', {
        size: 14,
        onClick: () => this.game.toTitle()
      });
      const def = list[this.selectIndex];
      this._button(ctx, { x: 742, y: 530, w: 182, h: 44 }, '以 ' + def.name + ' 入局', {
        size: 15,
        selected: true,
        onClick: () => this.game.startRun(def.id)
      });
      text(ctx, '← → 选择   ·   Enter 开始', 480, 552, {
        size: 10, color: 'rgba(207,192,157,.55)', align: 'center'
      });
    }

    _drawCharacterCard(ctx, def, x, y, w, h, selected, index) {
      const lift = selected ? -4 : 0;
      y += lift;
      const mouse = this.game.input.mouse;
      const hover = !this.game.touchMode && hit({ x, y, w, h }, mouse.x, mouse.y);
      if (hover && this.game.state === 'select') this.hovered = index;

      panel(ctx, x, y, w, h, {
        fill: selected ? 'rgba(28,25,42,.98)' : hover ? 'rgba(24,20,38,.96)' : 'rgba(16,13,26,.94)',
        border: selected ? PAL.gold : hover ? 'rgba(232,193,112,.7)' : 'rgba(69,58,96,.9)',
        accent: selected ? U.rgba(def.accent, 0.6) : 'rgba(232,193,112,.18)'
      });
      // 顶部角色色带
      ctx.fillStyle = def.color;
      ctx.fillRect(x + 5, y + 5, w - 10, 4);
      if (selected) {
        ctx.fillStyle = U.rgba(def.accent, 0.08);
        ctx.fillRect(x + 5, y + 9, w - 10, h - 14);
      }

      // 头像
      const frame = Math.floor(this.time * 2 + index) % 2;
      Ink.Art.drawPortrait(ctx, def.id, x + w / 2, y + 76, 3.4, frame);
      text(ctx, '0' + (index + 1), x + 12, y + 22, { size: 10, color: PAL.muted, bold: true });
      if (selected) {
        text(ctx, '◆ 已选择', x + w - 10, y + 22, { size: 9, color: PAL.gold, align: 'right' });
      }

      text(ctx, def.name, x + w / 2, y + 126, {
        size: 24, color: def.accent || PAL.parchment, align: 'center', bold: true
      });
      text(ctx, def.title + ' · ' + def.role, x + w / 2, y + 148, {
        size: 10, color: PAL.parchment2, align: 'center'
      });

      // 面板数值
      const stats = [
        { label: '生命', value: def.hp, max: 110, color: '#e06a74' },
        { label: '护甲', value: def.armor, max: 10, color: '#8fd6ff' },
        { label: '移速', value: def.speed, max: 270, color: '#8ef0c8' }
      ];
      for (let i = 0; i < 3; i++) {
        const sy = y + 168 + i * 17;
        const st = stats[i];
        text(ctx, st.label, x + 14, sy, { size: 9, color: PAL.muted });
        bar(ctx, x + 46, sy - 4, 92, 7, st.value / st.max, st.color, { segments: false });
        text(ctx, String(st.value), x + w - 12, sy, { size: 8, color: PAL.parchment2, align: 'right' });
      }

      // 技能说明
      const maxW = w - 26;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 8, y + 220, w - 16, h - 228);
      ctx.clip();

      text(ctx, '被动 · ' + def.passiveName, x + 13, y + 232, {
        size: 11, color: PAL.gold, bold: true
      });
      wrapped(ctx, def.passiveDesc, x + 13, y + 250, maxW, {
        size: 9.5, color: PAL.parchment2, lineHeight: 13, maxLines: 4
      });

      text(ctx, '主动 · ' + def.skillName, x + 13, y + 312, {
        size: 11, color: def.accent || '#ff9bb0', bold: true
      });
      wrapped(ctx, def.skillDesc, x + 13, y + 330, maxW, {
        size: 9.5, color: PAL.parchment2, lineHeight: 13, maxLines: 6
      });

      text(ctx, '冷却 ' + def.cooldown.toFixed(1) + 's', x + 13, y + h - 20, {
        size: 9, color: PAL.muted
      });
      text(ctx, '射程 ' + def.range, x + w - 13, y + h - 20, {
        size: 9, color: PAL.muted, align: 'right'
      });
      ctx.restore();

      // 点击层（不绘制）
      this.buttons.push({
        x, y, w, h, label: def.name, screen: this.game.state,
        onClick: () => { this.selectIndex = index; }
      });
    }

    // ── HUD ───────────────────────────────────────────────
    _drawHUD(ctx) {
      const game = this.game;
      const p = game.player;
      if (!p) return;

      // 生命 / 护甲 / 经验
      panel(ctx, 14, 10, 280, 76, { fill: 'rgba(10,8,18,.9)' });
      ctx.fillStyle = p.def.color;
      ctx.fillRect(18, 14, 4, 68);

      text(ctx, p.def.name, 32, 25, { size: 13, color: p.def.accent || PAL.parchment, bold: true });
      text(ctx, 'Lv.' + p.level, 88, 25, { size: 10, color: PAL.gold });
      text(ctx, String(Math.ceil(p.hp)) + ' / ' + Math.round(p.maxHp), 282, 25, {
        size: 10, color: PAL.parchment, align: 'right'
      });

      bar(ctx, 32, 35, 246, 12, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5f6d' : '#d94f5c');
      bar(ctx, 32, 51, 184, 7, p.maxArmor > 0 ? p.armor / p.maxArmor : 0, '#75cde8', { segments: false });
      text(ctx, '护甲 ' + Math.ceil(p.armor), 222, 55, { size: 8, color: '#9fe8ff' });

      // 经验
      bar(ctx, 32, 65, 246, 4, p.xp / p.xpNext, PAL.gold, { segments: false });
      text(ctx, 'XP', 282, 67, { size: 7, color: PAL.muted, align: 'right' });

      // 影犬状态（仅聪明小狗）
      if (game.dog && p.charId === 'smartdog') {
        const dog = game.dog;
        const mode = dog.alive ? '影犬' : '召回中 ' + Math.ceil(dog.respawnTimer) + 's';
        text(ctx, mode, 32, 81, { size: 8, color: dog.alive ? '#e8a34e' : PAL.muted });
        if (dog.alive) bar(ctx, 66, 78, 120, 5, dog.hp / dog.maxHp, '#e8a34e', { segments: false });
        else bar(ctx, 66, 78, 120, 5, 1 - dog.respawnTimer / dog.respawnTime, '#6d6388', { segments: false });
      }

      // 楼层与房间信息
      const floor = game.floorData;
      if (floor) {
        const room = game.room;
        const stage = room ? (room.stage || (room.type === 'shop' ? '商' : 1)) : 1;
        text(ctx, '第 ' + floor.number + ' 层 · 关卡 ' + stage + ' / 5', 480, 20, {
          size: 13, color: PAL.gold, align: 'center', bold: true
        });
        if (room) {
          const icon = room.type === 'boss' ? '庭主之间' : room.type === 'elite' ? '精英关卡' : room.type === 'shop' ? '行商' : '战斗关卡';
          text(ctx, room.name + '  ·  ' + icon, 480, 39, {
            size: 10, color: PAL.parchment2, align: 'center'
          });
        }
        if (game.boss && !game.boss.dead) {
          this._drawBossBar(ctx, game.boss);
        }
      }

      // 小地图
      this._drawMinimap(ctx);

      // 武器 / 金币
      this._drawWeaponCard(ctx);

      // 暂停按钮（触屏 / 鼠标都可点）
      this._button(ctx, { x: 694, y: 12, w: 34, h: 34 }, 'Ⅱ', {
        size: 13,
        onClick: () => this.game.togglePause()
      });

      // 技能环
      this._drawSkillRing(ctx);

      // 虚拟摇杆
      if (game.touchMode) this._drawJoystick(ctx);

      // 桌面操作提示
      if (!game.touchMode) {
        text(ctx, 'WASD 移动 · 鼠标瞄准 · 左键开火 · 空格/右键技能 · G 丢武器 · ESC 暂停', 480, 588, {
          size: 9, color: 'rgba(207,192,157,.48)', align: 'center'
        });
      } else {
        text(ctx, '拖动左侧摇杆 · 点击右侧技能 · 自动开火 · 面板直接点选', 480, 588, {
          size: 9, color: 'rgba(207,192,157,.42)', align: 'center'
        });
      }

      // 低血量红色警戒
      if (p.hp / p.maxHp < 0.26) {
        const a = 0.12 + Math.sin(this.time * 6) * 0.06;
        ctx.save();
        const g = ctx.createRadialGradient(480, 300, 180, 480, 300, 560);
        g.addColorStop(0, 'rgba(120,0,10,0)');
        g.addColorStop(1, 'rgba(170,10,24,' + a + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 960, 600);
        ctx.restore();
      }

      // Boss 登场字幕
      if (game.boss && game.boss.spawnTimer > 0.35) this._drawBossIntro(ctx, game.boss);
    }

    _drawBossBar(ctx, boss) {
      const w = 360, x = (960 - w) / 2, y = 70;
      text(ctx, boss.name + '  ·  ' + boss.title, 480, 60, {
        size: 10, color: boss.color, align: 'center', bold: true
      });
      bar(ctx, x, y, w, 10, boss.hp / boss.maxHp, boss.color, { segments: true });
      if (boss.phase > 1) {
        text(ctx, '二阶段', x + w + 8, y + 6, { size: 9, color: '#ff9b90', bold: true });
      }
      // 阶段刻度
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(x + w * 0.5, y - 1, 2, 13);
      ctx.restore();
    }

    _drawBossIntro(ctx, boss) {
      const t = boss.spawnTimer;
      const alpha = U.clamp((1.35 - t) * 1.2, 0, 1) * U.clamp(t * 2.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      const g = ctx.createLinearGradient(0, 210, 0, 370);
      g.addColorStop(0, 'rgba(5,4,10,0)');
      g.addColorStop(0.35, 'rgba(5,4,10,.88)');
      g.addColorStop(0.65, 'rgba(5,4,10,.88)');
      g.addColorStop(1, 'rgba(5,4,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 210, 960, 160);
      ctx.globalAlpha = alpha;
      text(ctx, '层 主 登 场', 480, 250, {
        size: 13, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, boss.name, 480, 298, {
        size: 36, color: boss.color, align: 'center', bold: true,
        shadowColor: '#000', shadowY: 3
      });
      text(ctx, boss.title, 480, 330, {
        size: 12, color: PAL.parchment2, align: 'center'
      });
      ctx.restore();
    }

    _drawMinimap(ctx) {
      const floor = this.game.floorData;
      if (!floor) return;
      const px = 742, py = 8, pw = 198, ph = 104;
      panel(ctx, px, py, pw, ph, { fill: 'rgba(9,7,16,.92)' });
      text(ctx, '墨 图', px + 12, py + 14, { size: 9, color: PAL.gold, bold: true });
      const stats = this.game.dungeon.roomStats(floor);
      text(ctx, stats.cleared + '/' + stats.total, px + pw - 12, py + 14, {
        size: 9, color: PAL.parchment2, align: 'right'
      });

      const cellW = 34, cellH = 23;
      const ox = px + 14, oy = py + 26;
      const byId = {};
      for (const r of floor.rooms) byId[r.id] = r;

      const pos = (r) => ({ x: ox + r.mapX * cellW + 10, y: oy + r.mapY * cellH + 7 });

      // 连接线
      ctx.save();
      for (const r of floor.rooms) {
        const a = pos(r);
        for (const id of r.connections) {
          if (id < r.id) continue; // 每条只画一次
          const b = byId[id];
          if (!b) continue;
          const bp = pos(b);
          ctx.strokeStyle = r.cleared && b.cleared ? 'rgba(232,193,112,.45)' : 'rgba(109,99,136,.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bp.x, bp.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 房间块
      for (const r of floor.rooms) {
        const pt = pos(r);
        const isCurrent = this.game.room && this.game.room.id === r.id;
        let fill = 'rgba(48,40,68,.9)';
        let border = 'rgba(109,99,136,.65)';
        if (r.cleared) { fill = 'rgba(116,214,177,.22)'; border = 'rgba(116,214,177,.65)'; }
        if (r.type === 'boss') { fill = 'rgba(217,79,92,.2)'; border = 'rgba(255,125,125,.75)'; }
        if (r.type === 'elite') { fill = 'rgba(232,193,112,.16)'; border = 'rgba(232,193,112,.75)'; }
        if (r.type === 'shop') { fill = 'rgba(255,211,107,.18)'; border = 'rgba(255,211,107,.8)'; }
        if (isCurrent) {
          const pulse = 0.7 + Math.sin(this.time * 5) * 0.3;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = PAL.gold2;
          ctx.lineWidth = 2;
          ctx.strokeRect(pt.x - 8, pt.y - 6, 18, 14);
          ctx.restore();
        }
        ctx.fillStyle = fill;
        ctx.fillRect(pt.x - 6, pt.y - 5, 14, 11);
        ctx.strokeStyle = isCurrent ? PAL.gold2 : border;
        ctx.lineWidth = 1;
        ctx.strokeRect(pt.x - 6.5, pt.y - 5.5, 15, 12);
        if (r.type === 'boss') {
          ctx.fillStyle = '#ff8a86';
          ctx.fillRect(pt.x - 1, pt.y - 2, 3, 3);
        } else if (r.type === 'elite') {
          ctx.fillStyle = PAL.gold;
          ctx.fillRect(pt.x - 1, pt.y - 3, 2, 6);
          ctx.fillRect(pt.x - 3, pt.y - 1, 6, 2);
        } else if (r.type === 'shop') {
          ctx.fillStyle = '#ffd36b';
          ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
          ctx.fillStyle = '#3a2a12';
          ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
        } else if (r.type === 'start') {
          ctx.fillStyle = '#8fd6ff';
          ctx.fillRect(pt.x - 2, pt.y - 2, 5, 5);
        }
      }
      // 图例
      text(ctx, '◆ 当前    ■ 已清    ✕ 层主', px + 12, py + ph - 8, {
        size: 7, color: 'rgba(207,192,157,.55)'
      });
    }

    _drawWeaponCard(ctx) {
      const game = this.game;
      const p = game.player;
      if (!p || !p.weapon) return;
      const w = 236;
      const x = 14;
      const y = game.touchMode ? 348 : 526;
      panel(ctx, x, y, w, 54, { fill: 'rgba(10,8,18,.9)' });
      const wdef = p.weapon;
      Ink.Weapons.drawIcon(ctx, x + 26, y + 26, 1.4, wdef.id, this.time);
      text(ctx, wdef.name, x + 48, y + 14, {
        size: 11, color: wdef.color, bold: true
      });
      text(ctx, '◆ ' + p.coins, x + w - 10, y + 14, {
        size: 10, color: '#ffd36b', align: 'right', bold: true
      });
      const cd = p.weaponCd || 0;
      const maxCd = p._weaponCooldown ? p._weaponCooldown() : 1;
      bar(ctx, x + 48, y + 27, w - 108, 4, 1 - U.clamp(cd / Math.max(0.01, maxCd), 0, 1), wdef.color, { segments: false });
      text(ctx, '威伤 ' + (wdef.damage || 0) + ' · ' + (Ink.Rarity[wdef.rarity] || {}).name, x + 48, y + 43, {
        size: 8, color: 'rgba(207,192,157,.62)'
      });

      // 武器可以主动丢弃；触屏点小按钮，桌面按 G。
      this.weaponDropRect = null;
      if (wdef.id !== 'fists') {
        if (this.game.touchMode) {
          const dropRect = { x: x + w - 42, y: y + 33, w: 30, h: 16 };
          this.weaponDropRect = dropRect;
          this._button(ctx, dropRect, '丢', {
            size: 9,
            onClick: () => p.dropWeapon()
          });
        } else {
          text(ctx, 'G 丢弃', x + w - 10, y + 44, {
            size: 8, color: 'rgba(207,192,157,.42)', align: 'right'
          });
        }
      }
    }

    _drawSkillRing(ctx) {
      const p = this.game.player;
      if (!p) return;
      const c = this.game.touchMode ? this.skillCenter : { x: 860, y: 512, r: 34 };
      const frac = 1 - p.skillRatio();
      const ready = p.skillRatio() <= 0;

      ctx.save();
      // 外圈
      ctx.fillStyle = 'rgba(5,4,10,.75)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r + 6, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,193,112,.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 冷却扇形底
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, U.TAU);
      ctx.fillStyle = 'rgba(20,17,32,.92)';
      ctx.fill();
      // 进度弧
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, -Math.PI / 2, -Math.PI / 2 + U.TAU * frac);
      ctx.strokeStyle = ready ? (p.def.accent || PAL.gold) : 'rgba(232,193,112,.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
      // 内圈
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 7, 0, U.TAU);
      ctx.strokeStyle = ready ? U.rgba(p.def.accent || PAL.gold, 0.45) : 'rgba(109,99,136,.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (ready) {
        ctx.globalAlpha = 0.18 + Math.sin(this.time * 4) * 0.06;
        ctx.fillStyle = p.def.accent || PAL.gold;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r + 2, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 中央字符
      const glyph = { qiyun: '棋', xiaoying: '影', xinyue: '心', ziyu: '狱', smartdog: '犬' }[p.charId] || '技';
      text(ctx, glyph, c.x, c.y - 1, {
        size: ready ? 23 : 19,
        color: ready ? (p.def.accent || PAL.gold) : PAL.muted,
        align: 'center', bold: true, shadowY: 2
      });
      if (!ready) {
        text(ctx, Math.ceil(p.skillCd * 10) / 10 + '', c.x, c.y + 17, {
          size: 10, color: PAL.parchment2, align: 'center'
        });
      } else {
        text(ctx, this.game.touchMode ? '就绪' : '空格', c.x, c.y + 18, {
          size: 8, color: PAL.parchment2, align: 'center'
        });
      }

      // 技能名
      text(ctx, p.def.skillName, c.x, c.y + c.r + 18, {
        size: 9, color: ready ? PAL.parchment2 : 'rgba(207,192,157,.55)', align: 'center'
      });
      ctx.restore();
    }

    _drawJoystick(ctx) {
      const s = this.stick;
      ctx.save();
      ctx.globalAlpha = 0.62;
      // 底座
      ctx.fillStyle = 'rgba(7,6,12,.6)';
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.radius + 16, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,193,112,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.radius, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.radius * 0.55, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // 方向刻痕
      ctx.fillStyle = 'rgba(207,192,157,.4)';
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.fillRect(
          s.cx + Math.cos(a) * (s.radius + 6) - 2,
          s.cy + Math.sin(a) * (s.radius + 6) - 2, 4, 4
        );
      }
      // 摇杆
      ctx.globalAlpha = s.active ? 0.95 : 0.7;
      ctx.fillStyle = s.active ? 'rgba(232,193,112,.28)' : 'rgba(69,58,96,.7)';
      ctx.beginPath();
      ctx.arc(s.cx + s.dx, s.cy + s.dy, 25, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = s.active ? PAL.gold2 : 'rgba(232,193,112,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,231,.22)';
      ctx.fillRect(s.cx + s.dx - 7, s.cy + s.dy - 8, 14, 2);
      ctx.restore();
    }

    // ── 升级三选一 ────────────────────────────────────────
    _drawLevelUp(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.78)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      panel(ctx, 100, 72, 760, 456, { fill: 'rgba(13,11,23,.98)' });
      drawCornerMarks(ctx, 100, 72, 760, 456, PAL.gold);
      text(ctx, '墨 力 涌 现', 480, 110, {
        size: 26, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '选择一项强化 · 数字键 1 / 2 / 3', 480, 140, {
        size: 11, color: PAL.muted, align: 'center'
      });

      const choices = (this.game.upgradeChoices || []).slice(0, 3);
      const cw = 206, gap = 28;
      const x0 = (960 - (choices.length * cw + (choices.length - 1) * gap)) / 2;
      for (let i = 0; i < choices.length; i++) {
        const kind = choices[i];
        const info = UPGRADE_INFO[kind] || UPGRADE_INFO.damage;
        const x = x0 + i * (cw + gap);
        const y = 174;
        const h = 282;
        const mouse = this.game.input.mouse;
        const hover = !this.game.touchMode && hit({ x, y, w: cw, h }, mouse.x, mouse.y);
        const selected = hover;

        panel(ctx, x, y, cw, h, {
          fill: selected ? 'rgba(40,33,58,.98)' : 'rgba(20,17,32,.96)',
          border: selected ? info.color : 'rgba(69,58,96,.95)',
          accent: U.rgba(info.color, 0.4)
        });
        ctx.fillStyle = info.color;
        ctx.fillRect(x + 5, y + 5, cw - 10, 3);

        // 图标底座
        ctx.fillStyle = U.rgba(info.color, 0.1);
        ctx.fillRect(x + cw / 2 - 38, y + 24, 76, 76);
        ctx.strokeStyle = U.rgba(info.color, 0.45);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + cw / 2 - 38.5, y + 24.5, 77, 77);
        Ink.Art.drawUpgradeIcon(ctx, kind, x + cw / 2, y + 62, 2.4, info.color);

        text(ctx, info.name, x + cw / 2, y + 126, {
          size: 23, color: info.color, align: 'center', bold: true
        });
        text(ctx, ['伤害', '攻速', '冷却', '移速', '生存'][
          ['damage', 'atkSpeed', 'cooldown', 'speed', 'survival'].indexOf(kind)
        ] || '强化', x + cw / 2, y + 150, {
          size: 9, color: PAL.muted, align: 'center'
        });

        wrapped(ctx, info.desc, x + 18, y + 170, cw - 36, {
          size: 10, color: PAL.parchment2, lineHeight: 15, align: 'center', maxLines: 3
        });

        const stacks = this.game.player.upgrades[kind] || 0;
        text(ctx, '已叠加 ' + stacks + ' 层', x + cw / 2, y + 228, {
          size: 9, color: PAL.muted, align: 'center'
        });
        this._button(ctx, { x: x + 34, y: y + 244, w: cw - 68, h: 30 }, '选 择', {
          size: 12, selected: true, onClick: () => this.game.chooseUpgrade(kind)
        });

        // 数字角标
        text(ctx, String(i + 1), x + 14, y + 18, {
          size: 10, color: PAL.gold, bold: true
        });
      }

      text(ctx, '升级会暂停战斗，选择后立即继续。', 480, 500, {
        size: 10, color: 'rgba(207,192,157,.5)', align: 'center'
      });
    }

    // ── 机制被动三选一 ────────────────────────────────────
    _drawPassive(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.78)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      panel(ctx, 100, 72, 760, 456, { fill: 'rgba(13,11,23,.98)' });
      drawCornerMarks(ctx, 100, 72, 760, 456, PAL.gold);
      text(ctx, '机 缘 三 选', 480, 110, {
        size: 26, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '每层第 2、4 关后，从三条机制里选一条 · 数字键 1 / 2 / 3', 480, 140, {
        size: 11, color: PAL.muted, align: 'center'
      });

      const choices = (this.game.passiveChoices || []).slice(0, 3);
      const cw = 214, gap = 26;
      const x0 = (960 - (choices.length * cw + (choices.length - 1) * gap)) / 2;
      for (let i = 0; i < choices.length; i++) {
        const def = Ink.Passives[choices[i]];
        if (!def) continue;
        const x = x0 + i * (cw + gap);
        const y = 174;
        const h = 282;
        const mouse = this.game.input.mouse;
        const hover = !this.game.touchMode && hit({ x, y, w: cw, h }, mouse.x, mouse.y);

        panel(ctx, x, y, cw, h, {
          fill: hover ? 'rgba(40,33,58,.98)' : 'rgba(20,17,32,.96)',
          border: hover ? def.color : 'rgba(69,58,96,.95)',
          accent: U.rgba(def.color, 0.4)
        });
        ctx.fillStyle = def.color;
        ctx.fillRect(x + 5, y + 5, cw - 10, 3);

        // 机制符号
        ctx.fillStyle = U.rgba(def.color, 0.1);
        ctx.fillRect(x + cw / 2 - 38, y + 24, 76, 76);
        ctx.strokeStyle = U.rgba(def.color, 0.45);
        ctx.strokeRect(x + cw / 2 - 38.5, y + 24.5, 77, 77);
        text(ctx, def.name.slice(0, 1), x + cw / 2, y + 62, {
          size: 34, color: def.color, align: 'center', bold: true
        });

        text(ctx, def.name, x + cw / 2, y + 126, {
          size: 22, color: def.color, align: 'center', bold: true
        });
        text(ctx, '机 制 · 被 动', x + cw / 2, y + 150, {
          size: 9, color: PAL.muted, align: 'center'
        });
        wrapped(ctx, def.desc, x + cw / 2, y + 172, cw - 40, {
          size: 10, color: PAL.parchment2, lineHeight: 15, align: 'center', maxLines: 4
        });
        this._button(ctx, { x: x + 34, y: y + 244, w: cw - 68, h: 30 }, '选 择', {
          size: 12, selected: true, onClick: () => this.game.choosePassive(def.id)
        });
        text(ctx, String(i + 1), x + 14, y + 18, {
          size: 10, color: PAL.gold, bold: true
        });
      }

      text(ctx, '机制被动可以改变子弹、击杀、拾取与生存方式。', 480, 500, {
        size: 10, color: 'rgba(207,192,157,.5)', align: 'center'
      });
    }

    // ── 行商 ──────────────────────────────────────────────
    _drawShop(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.8)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      const p = this.game.player;
      panel(ctx, 80, 52, 800, 500, { fill: 'rgba(15,12,18,.98)', border: 'rgba(232,193,112,.55)' });
      drawCornerMarks(ctx, 80, 52, 800, 500, PAL.gold);
      text(ctx, '行 商', 480, 92, {
        size: 28, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '金币或生命，都可以换一把趁手的兵刃。', 480, 120, {
        size: 11, color: PAL.muted, align: 'center'
      });
      if (p) {
        text(ctx, '金币 ' + p.coins + '   ·   生命 ' + Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), 850, 92, {
          size: 10, color: '#ffd36b', align: 'right'
        });
      }

      const offers = this.game.shopOffers || [];
      const cw = 230, gap = 18;
      const x0 = (960 - (offers.length * cw + (offers.length - 1) * gap)) / 2;
      for (let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const def = Ink.Weapons.get(offer.id);
        if (!def) continue;
        const x = x0 + i * (cw + gap);
        const y = 144;
        const h = 320;
        const rarity = Ink.Rarity[def.rarity] || Ink.Rarity.common;
        panel(ctx, x, y, cw, h, {
          fill: offer.sold ? 'rgba(14,12,18,.9)' : 'rgba(24,20,29,.97)',
          border: offer.sold ? 'rgba(69,58,96,.6)' : rarity.color,
          accent: U.rgba(def.color, 0.35)
        });
        ctx.fillStyle = def.color;
        ctx.fillRect(x + 5, y + 5, cw - 10, 3);

        Ink.Weapons.drawIcon(ctx, x + cw / 2, y + 66, 2.3, def.id, this.time);
        text(ctx, def.name, x + cw / 2, y + 118, {
          size: 19, color: def.color, align: 'center', bold: true
        });
        text(ctx, rarity.name + ' · 威伤 ' + def.damage, x + cw / 2, y + 142, {
          size: 9, color: rarity.color, align: 'center'
        });
        wrapped(ctx, def.desc, x + cw / 2, y + 166, cw - 40, {
          size: 9, color: PAL.parchment2, lineHeight: 14, align: 'center', maxLines: 3
        });

        if (offer.sold) {
          text(ctx, '已 售 出', x + cw / 2, y + 242, {
            size: 16, color: PAL.muted, align: 'center', bold: true
          });
        } else {
          this._button(ctx, { x: x + 22, y: y + 224, w: cw - 44, h: 32 }, '金币 ' + offer.price, {
            size: 12, disabled: p.coins < offer.price,
            onClick: () => this.game.buyWeapon(i, false)
          });
          const hpCost = p ? Math.ceil(p.maxHp * 0.25) : 0;
          this._button(ctx, { x: x + 22, y: y + 262, w: cw - 44, h: 32 }, '生命 ' + hpCost, {
            size: 12, disabled: p.hp <= hpCost + 1,
            onClick: () => this.game.buyWeapon(i, true)
          });
        }
        text(ctx, '#' + (i + 1), x + 14, y + 18, {
          size: 9, color: rarity.color, bold: true
        });
      }

      text(ctx, this.game.shopNotice || '', 480, 500, {
        size: 10, color: 'rgba(207,192,157,.65)', align: 'center'
      });
      this._button(ctx, { x: 360, y: 514, w: 240, h: 30 }, '离 开 行 商', {
        size: 12, onClick: () => this.game.closeShop()
      });
    }

    // ── 暂停 ──────────────────────────────────────────────
    _drawPause(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.72)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      panel(ctx, 270, 82, 420, 436, { fill: 'rgba(13,11,23,.98)' });
      drawCornerMarks(ctx, 270, 82, 420, 436, PAL.gold);
      text(ctx, '庭 中 暂 歇', 480, 128, {
        size: 25, color: PAL.parchment, align: 'center', bold: true
      });
      text(ctx, '第 ' + this.game.floor + ' 层 · ' + (this.game.room ? this.game.room.name : ''), 480, 158, {
        size: 11, color: PAL.muted, align: 'center'
      });

      this._button(ctx, { x: 340, y: 190, w: 280, h: 44 }, '继 续 对 局', {
        size: 15, selected: true,
        onClick: () => this.game.resume()
      });
      this._button(ctx, { x: 340, y: 246, w: 280, h: 36 }, this.game.audio.muted ? '音效：关' : '音效：开', {
        size: 12,
        onClick: () => this.game.toggleMute()
      });
      this._button(ctx, { x: 340, y: 294, w: 280, h: 36 }, '重 新 开 始', {
        size: 12,
        onClick: () => this.game.restartRun()
      });
      this._button(ctx, { x: 340, y: 342, w: 280, h: 36 }, '返 回 标 题', {
        size: 12,
        onClick: () => this.game.toTitle()
      });

      text(ctx, 'WASD 移动 · 鼠标瞄准 · 左键开火 · G 丢武器', 480, 414, {
        size: 9, color: PAL.muted, align: 'center'
      });
      text(ctx, '空格 / 右键主动技能 · ESC 继续', 480, 434, {
        size: 9, color: PAL.muted, align: 'center'
      });
      text(ctx, '提示：清空关卡 1–4 的敌人，庭主门才会解封。', 480, 478, {
        size: 9, color: 'rgba(232,193,112,.55)', align: 'center'
      });
    }

    // ── 结算 ──────────────────────────────────────────────
    _drawResultBackdrop(ctx, color) {
      this._drawBackdrop(ctx, '#0c0914');
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();
    }

    _drawStats(ctx, x, y, w) {
      const game = this.game;
      const seconds = game.runStats.time || 0;
      const stats = [
        ['抵达层数', '第 ' + game.runStats.floor + ' 层'],
        ['击倒敌人', String(game.runStats.kills)],
        ['清理房间', String(game.runStats.rooms)],
        ['用时', U.time(seconds)]
      ];
      for (let i = 0; i < stats.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = x + col * (w / 2);
        const sy = y + row * 34;
        text(ctx, stats[i][0], sx, sy, { size: 10, color: PAL.muted });
        text(ctx, stats[i][1], sx + w / 2 - 24, sy, {
          size: 13, color: PAL.parchment, align: 'right', bold: true
        });
      }
    }

    _drawGameOver(ctx) {
      this._drawResultBackdrop(ctx, '#6a1420');
      panel(ctx, 170, 82, 620, 430, { fill: 'rgba(13,9,16,.98)', border: 'rgba(217,79,92,.6)' });
      drawCornerMarks(ctx, 170, 82, 620, 430, '#d94f5c');
      text(ctx, '墨 尽', 480, 136, {
        size: 46, color: '#ff7d7d', align: 'center', bold: true,
        shadowColor: '#2a0508', shadowY: 5
      });
      text(ctx, '你的庭院停在了这里。', 480, 182, {
        size: 12, color: PAL.parchment2, align: 'center'
      });
      text(ctx, this.game.player ? this.game.player.def.name : '', 480, 216, {
        size: 15, color: PAL.gold, align: 'center', bold: true
      });
      this._drawStats(ctx, 250, 254, 460);

      this._button(ctx, { x: 250, y: 356, w: 200, h: 44 }, '重 整 旗 鼓', {
        size: 14, selected: true,
        onClick: () => this.game.restartRun()
      });
      this._button(ctx, { x: 470, y: 356, w: 200, h: 44 }, '更 换 角 色', {
        size: 13,
        onClick: () => this.game.toSelect()
      });
      this._button(ctx, { x: 360, y: 414, w: 240, h: 34 }, '返 回 标 题', {
        size: 12,
        onClick: () => this.game.toTitle()
      });
      text(ctx, 'Enter 快速重开', 480, 472, {
        size: 9, color: 'rgba(207,192,157,.5)', align: 'center'
      });
    }

    _drawVictory(ctx) {
      this._drawResultBackdrop(ctx, '#7a5a18');
      panel(ctx, 150, 66, 660, 470, { fill: 'rgba(14,12,10,.98)', border: 'rgba(232,193,112,.65)' });
      drawCornerMarks(ctx, 150, 66, 660, 470, PAL.gold);
      text(ctx, '破 局', 480, 120, {
        size: 48, color: PAL.gold2, align: 'center', bold: true,
        shadowColor: '#2a1b00', shadowY: 5
      });
      text(ctx, '三庭五树，九主尽数落子。', 480, 166, {
        size: 12, color: PAL.parchment2, align: 'center'
      });
      Ink.Art.drawBossIcon(ctx, Ink.FLOOR_COUNT - 1, 480, 210, 2.2,
        this.game.boss && this.game.boss.id);
      text(ctx, this.game.player ? this.game.player.def.name + ' · Lv.' + this.game.player.level : '', 480, 250, {
        size: 14, color: PAL.gold, align: 'center', bold: true
      });
      this._drawStats(ctx, 250, 292, 460);

      this._button(ctx, { x: 250, y: 390, w: 200, h: 44 }, '再 战 一 局', {
        size: 14, selected: true,
        onClick: () => this.game.restartRun()
      });
      this._button(ctx, { x: 470, y: 390, w: 200, h: 44 }, '更 换 角 色', {
        size: 13,
        onClick: () => this.game.toSelect()
      });
      this._button(ctx, { x: 360, y: 446, w: 240, h: 34 }, '返 回 标 题', {
        size: 12,
        onClick: () => this.game.toTitle()
      });
      text(ctx, 'Enter 再来一局', 480, 504, {
        size: 9, color: 'rgba(207,192,157,.5)', align: 'center'
      });
    }

    // ── 帮助 ──────────────────────────────────────────────
    _drawHelp(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.8)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();
      panel(ctx, 96, 58, 768, 484, { fill: 'rgba(13,11,23,.99)' });
      drawCornerMarks(ctx, 96, 58, 768, 484, PAL.gold);
      text(ctx, '操 作 与 规 则', 480, 98, {
        size: 24, color: PAL.gold, align: 'center', bold: true
      });

      const cols = [
        {
          x: 128, title: '桌面端',
          lines: [
            'W A S D / 方向键：移动',
            '鼠标：瞄准方向',
            '鼠标左键 / J：手中武器开火',
            'G：丢下当前武器（可捡回）',
            '空格 / 鼠标右键 / E：主动技能',
            'ESC / P：暂停 · 1 2 3 选择'
          ]
        },
        {
          x: 386, title: '移动端',
          lines: [
            '左下虚拟摇杆：移动',
            '右下技能按钮：释放主动技能',
            '自动锁定最近敌人并开火',
            '被动 / 商店：直接点选',
            '武器卡“丢”钮：丢弃当前武器',
            '点击右上角 Ⅱ 暂停',
            '横屏游玩体验更佳'
          ]
        },
        {
          x: 644, title: '局内循环',
          lines: [
            '每层 5 关 · 第 5 关为庭主',
            '第 2、4 关后：机制被动三选一',
            '精英关旁：行商换武器',
            '庭主掉落专属武器',
            '九位庭主分三层，强度逐层提升',
            '三层通关即为胜利'
          ]
        }
      ];
      for (const c of cols) {
        text(ctx, c.title, c.x, 150, { size: 13, color: PAL.parchment, bold: true });
        ctx.fillStyle = 'rgba(232,193,112,.3)';
        ctx.fillRect(c.x, 164, 190, 1);
        for (let i = 0; i < c.lines.length; i++) {
          text(ctx, c.lines[i], c.x, 190 + i * 26, {
            size: 10.5, color: PAL.parchment2
          });
        }
      }

      text(ctx, '角色定位', 128, 360, { size: 13, color: PAL.parchment, bold: true });
      const roles = [
        '棋云 · 中距控场：留下弈子，引爆清场',
        '小影 · 近战刺客：突进标记，击杀刷新',
        '心阅 · 辅助防御：标记强敌，心域偏转',
        '字狱 · 中远封锁：叠印成狱，收笔爆发',
        '聪明小狗 · 召唤协同：影犬嘲讽，代承伤害'
      ];
      for (let i = 0; i < roles.length; i++) {
        text(ctx, roles[i], 128 + (i % 2) * 380, 386 + Math.floor(i / 2) * 24, {
          size: 10, color: PAL.parchment2
        });
      }

      this._button(ctx, { x: 380, y: 482, w: 200, h: 36 }, '关 闭', {
        size: 13, onClick: () => { this.helpOpen = false; }
      });
    }

    _drawToast(ctx) {
      if (!this.toast) return;
      const t = this.toast;
      const a = U.clamp(t.t / Math.min(0.35, t.max), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      setFont(ctx, 11, true);
      const w = Math.max(180, ctx.measureText(t.message).width + 36);
      const x = (960 - w) / 2;
      const y = this.game.touchMode ? 424 : 540;
      ctx.fillStyle = 'rgba(8,6,14,.88)';
      ctx.fillRect(x, y, w, 26);
      ctx.strokeStyle = U.rgba(t.color, 0.7);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 25);
      text(ctx, t.message, 480, y + 13, {
        size: 11, color: t.color, align: 'center', bold: true
      });
      ctx.restore();
    }
  }

  Ink.UI = UI;
})();
