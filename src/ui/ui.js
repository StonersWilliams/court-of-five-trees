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
      this.clearBanner = null;
      this.stick = {
        active: false, pointerId: null,
        cx: 112, cy: 492, radius: 58,
        dx: 0, dy: 0, nx: 0, ny: 0
      };
      this.skillCenter = { x: 846, y: 500, r: 44 };
      this.bossIntroShown = -1;
      // 主界面左下角的图鉴：独立覆盖层，不改写 game.state。
      this.codexOpen = false;
      this.codexTab = 'enemy';
      this.codexIndex = 0;
      this.codexScroll = 0;
      // 武器图鉴：与敌怪图鉴并列的独立覆盖层。
      this.weaponCodexOpen = false;
      this.weaponCodexIndex = 0;
      this.weaponCodexPage = 0;
      this.tutorialOpen = false;
      this.tutorialPage = 0;
    }

    showToast(message, color = PAL.gold, duration = 1.9) {
      this.toast = { message, color, t: duration, max: duration };
    }

    showClearBanner(title, sub = '', color = PAL.gold) {
      this.clearBanner = { title, sub, color, t: 2.4, max: 2.4 };
    }

    // ── 输入 ──────────────────────────────────────────────
    update(dt) {
      this.time += dt;
      if (this.toast) {
        this.toast.t -= dt;
        if (this.toast.t <= 0) this.toast = null;
      }
      if (this.clearBanner) {
        this.clearBanner.t -= dt;
        if (this.clearBanner.t <= 0) this.clearBanner = null;
      }
      const input = this.game.input;
      const events = input.drainEvents();
      const state = this.game.state;

      if (this.tutorialOpen) {
        this._updateTutorial(input, events);
        return;
      }
      if (this.codexOpen) {
        this._updateCodex(input, events);
        return;
      }
      if (this.weaponCodexOpen) {
        this._updateWeaponCodex(input, events);
        return;
      }

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
      if (state === 'intro') {
        if (input.wasPressed('Escape')) this.game.skipIntro();
        else if (input.wasPressed('Enter', 'Space')) this.game.advanceIntro();
      } else if (state === 'ending') {
        if (this.game.endingResult) {
          if (input.wasPressed('Enter')) this.game.restartRun();
        } else {
          const keys = ['KeyW', 'KeyB', 'KeyF', 'KeyS'];
          const ids = ['white', 'brush', 'fire', 'seat'];
          for (let i = 0; i < 4; i++) {
            if (input.wasPressed(keys[i], 'Digit' + (i + 1), 'Numpad' + (i + 1))) {
              this.game.chooseEnding(ids[i]);
            }
          }
        }
      } else if (state === 'title') {
        if (input.wasPressed('Enter', 'Space')) {
          this.game.audio.sfx('ui');
          this.game.toSelect();
        } else if (input.wasPressed('KeyC')) {
          this.openCodex('enemy');
        } else if (input.wasPressed('KeyB')) {
          this.openWeaponCodex();
        }
      } else if (state === 'select') {
        const n = Math.max(1, Ink.CharacterList.length);
        if (input.wasPressed('ArrowLeft', 'KeyA')) {
          this.selectIndex = (this.selectIndex + n - 1) % n;
          this.game.audio.sfx('ui');
        }
        if (input.wasPressed('ArrowRight', 'KeyD')) {
          this.selectIndex = (this.selectIndex + 1) % n;
          this.game.audio.sfx('ui');
        }
        if (input.wasPressed('ArrowUp', 'KeyW')) {
          this.selectIndex = (this.selectIndex + n - 1) % n;
          this.game.audio.sfx('ui');
        }
        if (input.wasPressed('ArrowDown', 'KeyS')) {
          this.selectIndex = (this.selectIndex + 1) % n;
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
      } else if (state === 'prep') {
        const choices = this.game.prepChoices || [];
        for (let i = 0; i < Math.min(3, choices.length); i++) {
          if (input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
            this.game.choosePrep(choices[i].id);
          }
        }
      } else if (state === 'event') {
        const choices = this.game.eventChoices || [];
        for (let i = 0; i < Math.min(3, choices.length); i++) {
          if (input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
            this.game.chooseEvent(i);
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

    // ── 图鉴 ──────────────────────────────────────────────
    // 图鉴是标题页上的覆盖层：不改变 game.state，避免误触开始游戏。
    openCodex(tab = 'enemy') {
      this.codexOpen = true;
      this.codexTab = tab;
      this.codexIndex = 0;
      this.game.audio.sfx('ui');
    }

    _updateCodex(input, events) {
      for (const e of events) {
        if (e.pointerType === 'touch') this.game.touchMode = true;
        if (e.pointerType === 'mouse' && e.type === 'down') this.game.touchMode = false;
        if (e.type !== 'down') continue;
        // 只接受图鉴自己的按钮，防止点穿到标题页“踏入庭中”。
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (b.codex && hit(b, e.x, e.y)) {
            this.game.audio.sfx('ui');
            b.onClick();
            this.buttons = this.buttons.filter((x) => x.codex);
            break;
          }
        }
      }

      if (input.wasPressed('Escape', 'KeyQ')) {
        this.codexOpen = false;
        this.game.audio.sfx('uiBack');
        return;
      }
      if (input.wasPressed('ArrowLeft', 'ArrowRight', 'Tab')) {
        this.codexTab = this.codexTab === 'enemy' ? 'boss' : 'enemy';
        this.codexIndex = 0;
        this.game.audio.sfx('ui');
      }
      const list = Ink.Codex.list(this.codexTab);
      if (input.wasPressed('ArrowUp', 'KeyW')) {
        this.codexIndex = (this.codexIndex - 1 + list.length) % list.length;
        this.game.audio.sfx('ui');
      }
      if (input.wasPressed('ArrowDown', 'KeyS')) {
        this.codexIndex = (this.codexIndex + 1) % list.length;
        this.game.audio.sfx('ui');
      }
    }

    _drawCodex(ctx) {
      const tab = this.codexTab;
      const list = Ink.Codex.list(tab);
      this.codexIndex = U.clamp(this.codexIndex, 0, list.length - 1);
      const def = list[this.codexIndex];
      const isBoss = tab === 'boss';

      // 整屏压暗，保留标题的余韵。
      ctx.fillStyle = 'rgba(4,3,9,.82)';
      ctx.fillRect(0, 0, 960, 600);

      panel(ctx, 40, 40, 880, 520, {
        fill: 'rgba(12,10,21,.98)',
        border: 'rgba(232,193,112,.65)',
        accent: 'rgba(232,193,112,.25)'
      });

      text(ctx, '庭 中 图 鉴', 70, 68, {
        size: 25, color: PAL.parchment, bold: true
      });
      text(ctx, 'BESTIARY OF THE FIVE TREES', 236, 70, {
        size: 10, color: PAL.gold, bold: true
      });
      text(ctx, '记录庭中会动的东西，以及它们为何动手。', 70, 88, {
        size: 10, color: PAL.muted
      });

      this._button(ctx, { x: 70, y: 104, w: 112, h: 30 }, '小 怪', {
        size: 12, selected: tab === 'enemy', codex: true,
        onClick: () => { this.codexTab = 'enemy'; this.codexIndex = 0; }
      });
      this._button(ctx, { x: 190, y: 104, w: 112, h: 30 }, '庭 主', {
        size: 12, selected: tab === 'boss', codex: true,
        onClick: () => { this.codexTab = 'boss'; this.codexIndex = 0; }
      });
      text(ctx, isBoss ? '十三位守门人 · 基础数值与层数成长' : '九种游荡者 · 基础数值与攻击方式', 760, 118, {
        size: 9, color: PAL.muted, align: 'right'
      });

      // 左侧名录
      panel(ctx, 56, 148, 248, 368, {
        fill: 'rgba(17,14,28,.96)',
        border: 'rgba(69,58,96,.7)',
        accent: 'rgba(232,193,112,.14)'
      });
      const rowH = 26;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const ry = 154 + i * (rowH + 2);
        const sel = i === this.codexIndex;
        const mouse = this.game.input.mouse;
        const hover = !this.game.touchMode && hit({ x: 62, y: ry, w: 236, h: rowH }, mouse.x, mouse.y);
        ctx.fillStyle = sel ? 'rgba(232,193,112,.14)' : hover ? 'rgba(80,66,108,.5)' : 'rgba(8,6,15,.4)';
        ctx.fillRect(62, ry, 236, rowH);
        if (sel) {
          ctx.fillStyle = PAL.gold;
          ctx.fillRect(62, ry, 3, rowH);
        }
        const spriteKey = isBoss ? 'boss:' + e.id : 'enemy:' + e.id;
        Ink.Art.drawSprite(ctx, spriteKey, 84, ry + 13, isBoss ? 0.92 : 1.12, {
          frame: Math.floor(this.time * 2 + i) % 2
        });
        text(ctx, '0' + (i + 1), 103, ry + 10, { size: 7, color: PAL.muted });
        text(ctx, e.name, 116, ry + 13, {
          size: e.name.length > 5 ? 9.2 : 11, color: sel ? PAL.gold2 : PAL.parchment, bold: sel
        });
        text(ctx, isBoss ? '第 ' + e.floor + ' 庭' : 'HP ' + e.hp, 288, ry + 13, {
          size: 8, color: sel ? PAL.gold : PAL.muted, align: 'right'
        });
        this.buttons.push({
          x: 62, y: ry, w: 236, h: rowH, label: e.name,
          screen: this.game.state, codex: true,
          onClick: () => { this.codexIndex = i; }
        });
      }

      // 右侧条目
      panel(ctx, 316, 148, 588, 368, {
        fill: 'rgba(17,14,28,.96)',
        border: U.rgba(def.color, .7),
        accent: U.rgba(def.color, .25)
      });
      ctx.fillStyle = U.rgba(def.color, .08);
      ctx.fillRect(330, 162, 164, 152);
      // 大图：庭主用 24×24 立绘，小怪用 16×16 精灵。
      Ink.Art.drawSprite(ctx, isBoss ? 'boss:' + def.id : 'enemy:' + def.id, 412, 242, isBoss ? 4.6 : 5.2, {
        frame: Math.floor(this.time * 2) % 2,
        glow: def.color
      });
      text(ctx, '0' + (this.codexIndex + 1), 330, 170, { size: 9, color: U.rgba(def.color, .8) });
      text(ctx, def.en, 330, 302, { size: 8, color: U.rgba(def.color, .72), align: 'center' });

      text(ctx, def.name, 514, 172, {
        size: 25, color: def.color, bold: true
      });
      text(ctx, def.title, 516, 196, {
        size: 11, color: PAL.parchment2
      });
      text(ctx, isBoss ? '第 ' + def.floor + ' 庭 · 庭主' : '游荡者 · 小怪', 516, 214, {
        size: 9, color: PAL.gold
      });

      // 数值行
      const stats = isBoss
        ? [['生命', def.hp], ['攻击', def.damage], ['移速', def.speed], ['经验', def.xp]]
        : [['生命', def.hp], ['攻击', def.damage], ['移速', def.speed], ['经验', def.xp]];
      let sx = 516;
      for (const [label, value] of stats) {
        text(ctx, label, sx, 238, { size: 8, color: PAL.muted });
        text(ctx, String(value), sx, 252, { size: 12, color: PAL.parchment, bold: true });
        sx += 66;
      }
      text(ctx, isBoss
        ? '层数成长：生命 +62%/层 · 伤害 +32%/层 · 二阶段 60%'
        : '层数成长：生命 +44%/层 · 伤害 +15%/层',
        516, 272, { size: 8.5, color: U.rgba(def.color, .8) });

      // 背景
      text(ctx, '背 景', 330, 326, { size: 10, color: PAL.gold, bold: true });
      wrapped(ctx, def.desc, 330, 344, 544, {
        size: 9.5, lineHeight: 15, maxLines: 4, color: PAL.parchment2
      });

      // 招式
      const skillY = 414;
      text(ctx, '招 式', 330, skillY, { size: 10, color: PAL.gold, bold: true });
      for (let i = 0; i < 3; i++) {
        const sk = def.skills[i];
        if (!sk) continue;
        const y = skillY + 18 + i * 28;
        text(ctx, '· ' + sk.name, 330, y, {
          size: 9, color: def.color, bold: true
        });
        wrapped(ctx, sk.desc, 414, y, 454, {
          size: 8.5, lineHeight: 12, maxLines: 1, color: PAL.muted
        });
      }

      this._button(ctx, { x: 760, y: 526, w: 136, h: 26 }, '关 闭 图 鉴', {
        size: 10, codex: true,
        onClick: () => { this.codexOpen = false; this.game.audio.sfx('uiBack'); }
      });
      text(ctx, '↑↓ 选择 · ←→ / Tab 切换 · Esc 关闭', 70, 540, {
        size: 9, color: 'rgba(109,99,136,.8)'
      });
    }

    // ── 兵器图鉴 ──────────────────────────────────────────
    openWeaponCodex() {
      this.weaponCodexOpen = true;
      this.weaponCodexIndex = 0;
      this.weaponCodexPage = 0;
      this.game.audio.sfx('ui');
    }

    _weaponCodexList() {
      const ids = [];
      for (const id of Ink.WeaponList) ids.push(id);
      for (const id of Object.values(Ink.Weapons.STARTING || {})) ids.push(id);
      for (const id of Object.values(Ink.BossWeapons || {})) ids.push(id);
      return Array.from(new Set(ids)).map((id) => Ink.Weapons.get(id)).filter(Boolean);
    }

    _updateWeaponCodex(input, events) {
      for (const e of events) {
        if (e.pointerType === 'touch') this.game.touchMode = true;
        if (e.type !== 'down') continue;
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (hit(b, e.x, e.y)) {
            this.game.audio.sfx('ui');
            b.onClick();
            return;
          }
        }
      }
      const list = this._weaponCodexList();
      const pages = Math.max(1, Math.ceil(list.length / 9));
      if (input.wasPressed('Escape', 'KeyQ')) {
        this.weaponCodexOpen = false;
        this.game.audio.sfx('uiBack');
        return;
      }
      if (input.wasPressed('ArrowLeft')) {
        this.weaponCodexPage = (this.weaponCodexPage + pages - 1) % pages;
        this.weaponCodexIndex = this.weaponCodexPage * 9;
      }
      if (input.wasPressed('ArrowRight')) {
        this.weaponCodexPage = (this.weaponCodexPage + 1) % pages;
        this.weaponCodexIndex = this.weaponCodexPage * 9;
      }
      if (input.wasPressed('ArrowDown')) this.weaponCodexIndex = Math.min(list.length - 1, this.weaponCodexIndex + 1);
      if (input.wasPressed('ArrowUp')) this.weaponCodexIndex = Math.max(0, this.weaponCodexIndex - 1);
    }

    _drawWeaponCodex(ctx) {
      const list = this._weaponCodexList();
      const pages = Math.max(1, Math.ceil(list.length / 9));
      this.weaponCodexPage = U.clamp(this.weaponCodexPage, 0, pages - 1);
      this.weaponCodexIndex = U.clamp(this.weaponCodexIndex, 0, list.length - 1);
      const def = list[this.weaponCodexIndex];
      this.buttons = [];

      ctx.fillStyle = 'rgba(4,3,9,.86)';
      ctx.fillRect(0, 0, 960, 600);
      panel(ctx, 36, 32, 888, 536, {
        fill: 'rgba(12,10,21,.98)', border: 'rgba(232,193,112,.65)', accent: 'rgba(232,193,112,.25)'
      });
      text(ctx, '兵 刃 图 鉴', 64, 60, { size: 24, color: PAL.parchment, bold: true });
      text(ctx, 'WEAPON CODEX', 230, 62, { size: 10, color: PAL.gold, bold: true });
      text(ctx, '五十四柄兵刃 · 刀笔剑戟，各有各的脾气。', 64, 80, { size: 9, color: PAL.muted });

      const pageList = list.slice(this.weaponCodexPage * 9, this.weaponCodexPage * 9 + 9);
      for (let i = 0; i < pageList.length; i++) {
        const d = pageList[i];
        const idx = this.weaponCodexPage * 9 + i;
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 62 + col * 168;
        const y = 104 + row * 126;
        const sel = idx === this.weaponCodexIndex;
        const rarity = Ink.Rarity[d.rarity] || Ink.Rarity.common;
        panel(ctx, x, y, 154, 116, {
          fill: sel ? 'rgba(62,49,31,.96)' : 'rgba(27,23,41,.98)',
          border: sel ? PAL.gold : 'rgba(109,99,136,.8)',
          accent: U.rgba(d.color, .45)
        });
        Ink.Weapons.drawIcon(ctx, x + 77, y + 34, 1.55, d.id, this.time);
        text(ctx, d.name, x + 77, y + 70, {
          size: d.name.length > 6 ? 9 : 11, color: PAL.parchment, align: 'center', bold: true
        });
        text(ctx, '威伤 ' + d.damage, x + 77, y + 88, {
          size: 8.5, color: rarity.color, align: 'center'
        });
        text(ctx, rarity.name, x + 77, y + 101, {
          size: 8, color: PAL.muted, align: 'center'
        });
        this.buttons.push({ x, y, w: 154, h: 116, onClick: () => { this.weaponCodexIndex = idx; } });
      }

      // 右侧详情
      if (def) {
        const rarity = Ink.Rarity[def.rarity] || Ink.Rarity.common;
        panel(ctx, 580, 104, 316, 354, {
          fill: 'rgba(17,14,28,.96)', border: U.rgba(def.color, .7), accent: U.rgba(def.color, .2)
        });
        Ink.Weapons.drawIcon(ctx, 738, 166, 2.7, def.id, this.time);
        text(ctx, def.name, 738, 220, { size: 21, color: PAL.parchment, align: 'center', bold: true });
        text(ctx, rarity.name + ' · 威伤 ' + def.damage + ' · 冷却 ' + def.cooldown.toFixed(2) + 's',
          738, 242, { size: 9, color: rarity.color, align: 'center' });
        wrapped(ctx, def.desc, 602, 270, 272, {
          size: 9, color: PAL.parchment2, lineHeight: 14, maxLines: 5
        });
        const tags = [];
        if (def.melee) tags.push('近战');
        if (def.charged) tags.push('蓄力');
        if (def.clearShots) tags.push('清弹');
        if (def.pierce) tags.push('穿透 ' + def.pierce);
        if (def.homing) tags.push('追踪');
        if (def.bounce) tags.push('弹射');
        text(ctx, tags.join(' · ') || '远程', 738, 370, {
          size: 9, color: def.color, align: 'center'
        });
      }

      this._button(ctx, { x: 588, y: 476, w: 80, h: 28 }, '‹ 上页', {
        size: 10, onClick: () => {
          this.weaponCodexPage = (this.weaponCodexPage + pages - 1) % pages;
          this.weaponCodexIndex = this.weaponCodexPage * 9;
        }
      });
      text(ctx, (this.weaponCodexPage + 1) + ' / ' + pages, 738, 490, {
        size: 9, color: PAL.muted, align: 'center'
      });
      this._button(ctx, { x: 808, y: 476, w: 80, h: 28 }, '下页 ›', {
        size: 10, onClick: () => {
          this.weaponCodexPage = (this.weaponCodexPage + 1) % pages;
          this.weaponCodexIndex = this.weaponCodexPage * 9;
        }
      });
      this._button(ctx, { x: 760, y: 522, w: 136, h: 28 }, '关 闭 图 鉴', {
        size: 10, onClick: () => { this.weaponCodexOpen = false; this.game.audio.sfx('uiBack'); }
      });
      text(ctx, '↑↓ 选择 · ←→ 翻页 · Esc 关闭', 62, 542, {
        size: 9, color: 'rgba(109,99,136,.8)'
      });
    }

    // ── 新手导引 ──────────────────────────────────────────
    _tutorialPages() {
      return [
        {
          title: '一 · 入庭',
          body: 'WASD / 左侧摇杆移动，鼠标 / 右侧摇杆瞄准。\n左键或触屏攻击键开火；空格 / 右键 / 技能键施放主动技能。\nQ 切换武器，G 丢弃当前武器。'
        },
        {
          title: '二 · 生命、护盾与能量',
          body: '生命上限 20，受击 1–15 点，归零即失败；脱战 4.5 秒后护盾每秒回复 1 点。\n能量驱动武器，不足时可用手刀；技能不耗能量。\n击杀与能量球都会补充能量。'
        },
        {
          title: '三 · 蓄力',
          body: '长按左键蓄力，角色头顶出现蓄力条，松开释放。\n蓝条代表蓄力，金色区间是完美区间，在区间内释放伤害最高。\n部分武器满蓄自动释放；蓄力期间移速下降。'
        },
        {
          title: '四 · 关卡与机缘',
          body: '清空房间后门才会打开；部分房间分两波。\n每层第 2、4、6 关后，以及击败庭主后，可以三选一机制被动。\n被动可重复叠加，左侧「机缘」栏随时查看。'
        },
        {
          title: '五 · 行商与黄金台',
          body: '行商房间里：学长卖攻击兵刃，学姐卖唤兽法棒、复习资料与能量瓶。\n装备黄金台后，场上只剩一种怪物时可按 R 吟唱收服；宠物会独立作战，房间清空后复活。\n最多携带两把武器，书箧被动可增加槽位。'
        }
      ];
    }

    _updateTutorial(input, events) {
      const pages = this._tutorialPages();
      for (const e of events) {
        if (e.type !== 'down') continue;
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (hit(b, e.x, e.y)) {
            this.game.audio.sfx('ui');
            b.onClick();
            return;
          }
        }
      }
      if (input.wasPressed('Escape')) {
        this.tutorialOpen = false;
        this.game.audio.sfx('uiBack');
        return;
      }
      if (input.wasPressed('ArrowLeft')) this.tutorialPage = Math.max(0, this.tutorialPage - 1);
      if (input.wasPressed('ArrowRight')) this.tutorialPage = Math.min(pages.length - 1, this.tutorialPage + 1);
      if (input.wasPressed('Enter', 'Space')) {
        if (this.tutorialPage >= pages.length - 1) {
          this.tutorialOpen = false;
          this.game.startTutorial();
        } else {
          this.tutorialPage++;
        }
      }
    }

    _drawTutorial(ctx) {
      const pages = this._tutorialPages();
      const page = pages[U.clamp(this.tutorialPage, 0, pages.length - 1)];
      this.buttons = [];
      ctx.fillStyle = 'rgba(4,3,9,.84)';
      ctx.fillRect(0, 0, 960, 600);
      panel(ctx, 150, 78, 660, 440, {
        fill: 'rgba(14,11,23,.99)', border: 'rgba(143,214,255,.6)', accent: 'rgba(143,214,255,.18)'
      });
      drawCornerMarks(ctx, 150, 78, 660, 440, '#8fd6ff');
      text(ctx, '新 手 导 引', 480, 120, { size: 26, color: PAL.parchment, align: 'center', bold: true });
      text(ctx, page.title, 480, 160, { size: 15, color: '#8fd6ff', align: 'center', bold: true });
      wrapped(ctx, page.body, 480, 192, 570, {
        size: 11, color: PAL.parchment2, lineHeight: 23, align: 'center', maxLines: 9
      });
      for (let i = 0; i < pages.length; i++) {
        ctx.fillStyle = i === this.tutorialPage ? PAL.gold : 'rgba(109,99,136,.5)';
        ctx.fillRect(480 - pages.length * 8 + i * 16, 454, 10, 4);
      }
      this._button(ctx, { x: 190, y: 474, w: 100, h: 30 }, '‹ 上页', {
        size: 10, onClick: () => { this.tutorialPage = Math.max(0, this.tutorialPage - 1); }
      });
      this._button(ctx, { x: 670, y: 474, w: 100, h: 30 }, '下页 ›', {
        size: 10, onClick: () => { this.tutorialPage = Math.min(pages.length - 1, this.tutorialPage + 1); }
      });
      const last = this.tutorialPage >= pages.length - 1;
      this._button(ctx, { x: 380, y: 474, w: 200, h: 30 }, last ? '进 入 试 炼' : '继 续 了 解', {
        size: 11, selected: true,
        onClick: () => {
          if (last) { this.tutorialOpen = false; this.game.startTutorial(); }
          else this.tutorialPage++;
        }
      });
      this._button(ctx, { x: 694, y: 88, w: 78, h: 22 }, '关 闭', {
        size: 9, onClick: () => { this.tutorialOpen = false; this.game.audio.sfx('uiBack'); }
      });
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
          x, y, w, h, label, screen: this.game.state, codex: !!opts.codex,
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
        // 黄金台：触屏收服键。
        const cr = this.captureRect;
        if (cr && e.x >= cr.x && e.x <= cr.x + cr.w && e.y >= cr.y && e.y <= cr.y + cr.h) {
          this.game.tryCapturePet();
          return;
        }
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
      if (state === 'intro') this._drawIntro(ctx);
      else if (state === 'ending') this._drawEnding(ctx);
      else if (state === 'title') {
        this._drawTitle(ctx);
        if (this.codexOpen) this._drawCodex(ctx);
        if (this.weaponCodexOpen) this._drawWeaponCodex(ctx);
        if (this.tutorialOpen) this._drawTutorial(ctx);
      } else if (state === 'select') this._drawSelect(ctx);      else if (state === 'levelup') {
        this._drawHUD(ctx);
        this._drawLevelUp(ctx);
      } else if (state === 'passive') {
        this._drawHUD(ctx);
        this._drawPassive(ctx);
      } else if (state === 'shop') {
        this._drawHUD(ctx);
        this._drawShop(ctx);
      } else if (state === 'prep') {
        this._drawHUD(ctx);
        this._drawPrep(ctx);
      } else if (state === 'event') {
        this._drawHUD(ctx);
        this._drawEvent(ctx);
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

      if (this.clearBanner && state === 'playing') this._drawClearBanner(ctx);
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

    // ── 七幕序章 ──────────────────────────────────────────
    _drawIntro(ctx) {
      const acts = [
        { t: '第一幕 · 奇树', s: '庭中有奇树，绿叶发华滋。镜湖的水面，倒映着一块石头。石上十六个字：精勤求学，敦笃励志，果毅力行，忠恕任事。' },
        { t: '第二幕 · 黄桷', s: '旁边一株黄桷树，树下一声旧铃。这里是西南交通大学。1896 年从山海关铁路官学堂起家，矿镐、水准仪、铁轨，刻在校徽上。' },
        { t: '第三幕 · 文脉', s: '中文系就长在这所工科学校的骨缝里——小而精，出特色，做藏彝走廊的语言，做巴蜀方言的千年考据，做“文工交融”的摆渡人。' },
        { t: '第四幕 · 交通', s: '校歌里唱：“灌输文化尚交通。”这里的“交通”，是天地交而万物通。可如今，九庭轮值，三道外客，河道被层层纸页截断。竢实扬华，自强不息。' },
        { t: '第五幕 · 旧物', s: '庭中那棵奇树还在。石桌上摆着一局没下完的棋，砚台边搁着一支没蘸墨的笔，批卷的刀笔压在旧稿上，方言调查笔记旁搁着一双听音的耳朵，黄桷树下挂着一声没停的铃。' },
        { t: '第六幕 · 三客', s: '九庭轮值，三层不空。外庭三客，客随主便。第四层三选一，第五层，创世者等你翻页。' },
        { t: '第七幕 · 稿纸', s: '树影里的小兽抬起头。稿纸在你手里。' }
      ];
      const idx = Math.min(6, this.game.introIndex || 0);
      const act = acts[idx];
      const elapsed = this.game.introTimer || 0;
      this._drawBackdrop(ctx, '#0d0b16');

      // 水墨圆环 + 树影
      ctx.save();
      ctx.translate(480, 250);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.07 + i * 0.03;
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 150 + i * 36 + Math.sin(this.time * 0.7 + i) * 4, 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();

      text(ctx, act.t, 480, 180, {
        size: 28, color: PAL.gold, align: 'center', bold: true
      });
      const shown = act.s.slice(0, Math.floor(elapsed * 13));
      wrapped(ctx, shown, 480, 230, 560, {
        size: 14, color: PAL.parchment, lineHeight: 24, align: 'center', maxLines: 4
      });
      text(ctx, (idx + 1) + ' / 7', 480, 352, {
        size: 11, color: PAL.muted, align: 'center'
      });
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i <= idx ? PAL.gold : 'rgba(232,193,112,.2)';
        ctx.fillRect(432 + i * 18, 370, 10, 2);
      }
      this._button(ctx, { x: 340, y: 430, w: 280, h: 40 }, '继 续', {
        size: 15, selected: true, onClick: () => this.game.advanceIntro()
      });
      this._button(ctx, { x: 400, y: 490, w: 160, h: 30 }, '跳 过 序 章', {
        size: 11, onClick: () => this.game.skipIntro()
      });
      text(ctx, '空格 继续 · Esc 跳过', 480, 552, {
        size: 10, color: 'rgba(207,192,157,.45)', align: 'center'
      });
    }

    // ── 终局 ──────────────────────────────────────────────
    _drawEnding(ctx) {
      this._drawBackdrop(ctx, '#0c0a12');
      const result = this.game.endingResult;
      const s = this.game.runStats || {};
      if (!result) {
        text(ctx, '最 后 一 页', 480, 82, {
          size: 32, color: PAL.gold, align: 'center', bold: true
        });
        text(ctx, '白墨、朱笔、火，或那把一直空着的椅子。', 480, 116, {
          size: 11, color: PAL.muted, align: 'center'
        });
        text(ctx, '残稿 ' + (s.fragments || 0) + ' / 5   ·   庭主真名 ' + (s.trueNames || 0) + ' / 5   ·   庭主印 ' + (s.seals || 0) + ' / 3', 480, 142, {
          size: 10, color: PAL.gold2, align: 'center'
        });
        const choices = this.game.endingChoices || [];
        const cw = 166, gap = 18;
        const x0 = (960 - (choices.length * cw + (choices.length - 1) * gap)) / 2;
        for (let i = 0; i < choices.length; i++) {
          const c = choices[i];
          const x = x0 + i * (cw + gap);
          const y = 190, h = 220;
          const hover = !this.game.touchMode && hit({ x, y, w: cw, h }, this.game.input.mouse.x, this.game.input.mouse.y);
          panel(ctx, x, y, cw, h, {
            fill: hover ? 'rgba(40,34,48,.98)' : 'rgba(18,15,24,.96)',
            border: hover ? PAL.gold : 'rgba(90,76,110,.9)'
          });
          text(ctx, c.label, x + cw / 2, y + 52, {
            size: 24, color: PAL.parchment, align: 'center', bold: true
          });
          wrapped(ctx, c.desc, x + cw / 2, y + 86, cw - 26, {
            size: 10, color: PAL.muted, lineHeight: 16, align: 'center', maxLines: 3
          });
          this._button(ctx, { x: x + 22, y: y + 170, w: cw - 44, h: 28 }, '落 笔', {
            size: 11, selected: true, onClick: () => this.game.chooseEnding(c.id)
          });
        }
        text(ctx, '条件不足时，你会退回第一层。', 480, 468, {
          size: 10, color: 'rgba(207,192,157,.45)', align: 'center'
        });
        return;
      }

      text(ctx, result.name, 480, 160, {
        size: 48, color: PAL.gold, align: 'center', bold: true
      });
      wrapped(ctx, result.text, 480, 230, 560, {
        size: 14, color: PAL.parchment, lineHeight: 25, align: 'center', maxLines: 4
      });
      text(ctx, '第 ' + (s.floor || 1) + ' 层   ·   击倒 ' + (s.kills || 0) + '   ·   清净 ' + (s.rooms || 0) + ' 页   ·   ' + U.time(s.time || 0), 480, 350, {
        size: 10, color: PAL.muted, align: 'center'
      });
      this._button(ctx, { x: 250, y: 420, w: 200, h: 40 }, '再 入 庭', {
        size: 14, selected: true, onClick: () => this.game.restartRun()
      });
      this._button(ctx, { x: 470, y: 420, w: 200, h: 40 }, '更 换 角 色', {
        size: 14, onClick: () => this.game.toSelect()
      });
      this._button(ctx, { x: 380, y: 480, w: 200, h: 32 }, '返 回 标 题', {
        size: 11, onClick: () => this.game.toTitle()
      });
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

      text(ctx, '庭 中 有 奇 树', 480, 195, {
        size: 62, color: PAL.parchment, align: 'center', bold: true,
        shadowColor: '#000', shadowX: 4, shadowY: 6
      });
      text(ctx, 'COURT OF WONDROUS TREES', 480, 249, {
        size: 16, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '奇树成庭，众主守门。', 480, 294, {
        size: 15, color: PAL.parchment2, align: 'center'
      });

      const pulse = 0.55 + Math.sin(t * 2.4) * 0.18;
      text(ctx, '五层 · 每层七关 · 十三守门人 · 五十四兵刃', 480, 330, {
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
      // 主界面左下角：小怪 / 庭主图鉴入口。
      this._button(ctx, { x: 28, y: 532, w: 130, h: 30 }, '敌 怪 图 鉴', {
        size: 10,
        onClick: () => this.openCodex('enemy')
      });
      this._button(ctx, { x: 166, y: 532, w: 130, h: 30 }, '兵 刃 图 鉴', {
        size: 10,
        onClick: () => this.openWeaponCodex()
      });
      this._button(ctx, { x: 304, y: 532, w: 130, h: 30 }, '新 手 导 引', {
        size: 10,
        onClick: () => { this.tutorialOpen = true; this.tutorialPage = 0; this.game.audio.sfx('ui'); }
      });

      text(ctx, 'WASD 移动   ·   鼠标瞄准   ·   左键开火   ·   空格/右键技能   ·   G 丢武器', 480, 508, {
        size: 10, color: PAL.muted, align: 'center'
      });
      text(ctx, '触屏：左下摇杆移动，右下按钮技能；被动 / 商店 / 兵刃 / 丢武器均可直接点选', 480, 578, {
        size: 9, color: 'rgba(109,99,136,.8)', align: 'center'
      });
      text(ctx, 'MIT License · 零依赖 · 程序化像素美术 / WebAudio 音效', 36, 594, {
        size: 8, color: 'rgba(109,99,136,.7)'
      });
      text(ctx, 'v5.0.0', 924, 580, { size: 9, color: 'rgba(109,99,136,.7)', align: 'right' });
    }

    // ── 角色选择 ──────────────────────────────────────────
    _drawSelect(ctx) {
      this._drawBackdrop(ctx, '#141126');
      const list = Ink.CharacterList;
      this.selectIndex = U.clamp(this.selectIndex, 0, list.length - 1);

      text(ctx, '选 择 你 的 同 行 者', 480, 38, {
        size: 26, color: PAL.parchment, align: 'center', bold: true
      });
      text(ctx, '奇树成庭，八人入局。被动常驻，主动需冷却。', 480, 66, {
        size: 11, color: PAL.muted, align: 'center'
      });

      // 左侧角色列表：八人也能一屏放下，选中后右侧显示完整面板。
      const lx = 30, ly = 88, lw = 250, rowH = 46, rowGap = 4;
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const ry = ly + i * (rowH + rowGap);
        const sel = i === this.selectIndex;
        panel(ctx, lx, ry, lw, rowH, {
          fill: sel ? 'rgba(35,30,48,.98)' : 'rgba(15,12,25,.9)',
          border: sel ? PAL.gold : 'rgba(69,58,96,.8)',
          accent: sel ? U.rgba(d.accent, .5) : 'rgba(232,193,112,.12)'
        });
        ctx.fillStyle = d.color;
        ctx.fillRect(lx + 5, ry + 5, 4, rowH - 10);
        Ink.Art.drawPortrait(ctx, d.id, lx + 30, ry + 23, 1.15, Math.floor(this.time * 2 + i) % 2);
        text(ctx, d.name, lx + 52, ry + 20, {
          size: 14, color: sel ? d.accent || PAL.gold : PAL.parchment, bold: true
        });
        text(ctx, d.role, lx + 52, ry + 35, { size: 9, color: PAL.muted });
        text(ctx, '0' + (i + 1), lx + lw - 12, ry + 18, { size: 9, color: PAL.gold, align: 'right' });

        this.buttons.push({
          x: lx, y: ry, w: lw, h: rowH, label: d.name, screen: this.game.state,
          onClick: () => { this.selectIndex = i; }
        });
      }

      const def = list[this.selectIndex];
      const dx = 300, dy = 88, dw = 630, dh = 438;
      panel(ctx, dx, dy, dw, dh, {
        fill: 'rgba(18,15,28,.96)',
        border: U.rgba(def.accent, .7),
        accent: def.color
      });
      // 大立绘
      ctx.fillStyle = U.rgba(def.color, .08);
      ctx.fillRect(dx + 18, dy + 18, 172, 190);
      Ink.Art.drawPortrait(ctx, def.id, dx + 104, dy + 116, 4.4, Math.floor(this.time * 2) % 2);
      text(ctx, def.name, dx + 210, dy + 54, {
        size: 34, color: def.accent || PAL.parchment, bold: true
      });
      text(ctx, def.title + ' · ' + def.role, dx + 212, dy + 78, {
        size: 12, color: PAL.parchment2
      });
      text(ctx, '初始兵刃 · ' + (Ink.Weapons.get(Ink.Weapons.STARTING[def.id]) || {}).name, dx + 212, dy + 100, {
        size: 10, color: PAL.gold
      });

      const stats = [
        { label: '生命', value: def.hp, max: 20, color: '#e06a74' },
        { label: '护盾', value: def.armor, max: 10, color: '#8fd6ff' },
        { label: '移速', value: def.speed, max: 270, color: '#8ef0c8' }
      ];
      for (let i = 0; i < 3; i++) {
        const sy = dy + 126 + i * 19;
        text(ctx, stats[i].label, dx + 212, sy, { size: 9, color: PAL.muted });
        bar(ctx, dx + 252, sy - 4, 120, 7, stats[i].value / stats[i].max, stats[i].color, { segments: false });
        text(ctx, String(stats[i].value), dx + 384, sy, { size: 8, color: PAL.parchment2 });
      }

      ctx.fillStyle = 'rgba(232,193,112,.14)';
      ctx.fillRect(dx + 210, dy + 196, dw - 232, 1);
      text(ctx, '被动 · ' + def.passiveName, dx + 212, dy + 222, {
        size: 12, color: PAL.gold, bold: true
      });
      wrapped(ctx, def.passiveDesc, dx + 212, dy + 240, dw - 240, {
        size: 10, color: PAL.parchment2, lineHeight: 15, maxLines: 4
      });
      text(ctx, '主动 · ' + def.skillName, dx + 212, dy + 310, {
        size: 12, color: def.accent || '#ff9bb0', bold: true
      });
      wrapped(ctx, def.skillDesc, dx + 212, dy + 328, dw - 240, {
        size: 10, color: PAL.parchment2, lineHeight: 15, maxLines: 5
      });
      text(ctx, '冷却 ' + def.cooldown.toFixed(1) + 's   ·   射程 ' + def.range, dx + 212, dy + dh - 22, {
        size: 9, color: PAL.muted
      });

      this._button(ctx, { x: 36, y: 540, w: 150, h: 40 }, '返 回', {
        size: 14,
        onClick: () => this.game.toTitle()
      });
      this._button(ctx, { x: 740, y: 540, w: 184, h: 40 }, '以 ' + def.name + ' 入局', {
        size: 15,
        selected: true,
        onClick: () => this.game.startRun(def.id)
      });
      text(ctx, '↑ ↓ 选择   ·   Enter 开始', 480, 562, {
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
      Ink.Art.drawPortrait(ctx, def.id, x + w / 2, y + 76, 2.2, frame);
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
        { label: '生命', value: def.hp, max: 20, color: '#e06a74' },
        { label: '护盾', value: def.armor, max: 10, color: '#8fd6ff' },
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

      // 生命 / 护盾 / 能量 / 经验：20 点生命模型下全部数字化显示。
      panel(ctx, 14, 10, 280, 86, { fill: 'rgba(10,8,18,.9)' });
      ctx.fillStyle = p.def.color;
      ctx.fillRect(18, 14, 4, 78);

      text(ctx, p.def.name, 32, 25, { size: 13, color: p.def.accent || PAL.parchment, bold: true });
      text(ctx, 'Lv.' + p.level, 88, 25, { size: 10, color: PAL.gold });
      text(ctx, Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), 282, 25, {
        size: 10, color: PAL.parchment, align: 'right'
      });

      bar(ctx, 32, 34, 246, 11, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5f6d' : '#d94f5c');
      bar(ctx, 32, 47, 184, 6, p.maxArmor > 0 ? p.armor / p.maxArmor : 0, '#75cde8', { segments: false });
      text(ctx, '护盾 ' + Math.ceil(p.armor), 222, 52, { size: 8, color: '#9fe8ff' });
      bar(ctx, 32, 57, 184, 6, p.maxEnergy > 0 ? p.energy / p.maxEnergy : 0, '#8fd6ff', { segments: false });
      text(ctx, '能量 ' + Math.ceil(p.energy), 222, 62, { size: 8, color: '#8fd6ff' });

      // 经验
      bar(ctx, 32, 69, 246, 4, p.xp / p.xpNext, PAL.gold, { segments: false });
      text(ctx, 'XP', 282, 71, { size: 7, color: PAL.muted, align: 'right' });

      // 影犬状态（仅御狶）
      if (game.dog && p.charId === 'smartdog') {
        const dog = game.dog;
        const mode = dog.alive ? '影犬' : '召回 ' + Math.ceil(dog.respawnTimer) + 's';
        text(ctx, mode, 32, 83, { size: 8, color: dog.alive ? '#e8a34e' : PAL.muted });
        if (dog.alive) bar(ctx, 70, 80, 112, 4, dog.hp / dog.maxHp, '#e8a34e', { segments: false });
        else bar(ctx, 70, 80, 112, 4, 1 - dog.respawnTimer / dog.respawnTime, '#6d6388', { segments: false });
      }

      // 楼层与房间信息
      const floor = game.floorData;
      if (floor) {
        const room = game.room;
        const stage = room ? (room.stage || (room.type === 'shop' ? '商' : 1)) : 1;
        const stageLabel = floor.index >= Ink.FLOOR_COUNT - 1 ? '终局' : '关卡 ' + stage + ' / 7';
        text(ctx, '第 ' + floor.number + ' 层 · ' + stageLabel, 480, 20, {
          size: 13, color: PAL.gold, align: 'center', bold: true
        });
        if (room) {
          const icon = room.type === 'boss' ? '庭主之间' : room.type === 'elite' ? '精英关卡' : room.type === 'shop' ? '行商' : room.type === 'event' ? '随机事件' : room.type === 'prep' ? '' : '战斗关卡';
          const line = icon ? room.name + '  ·  ' + icon : room.name;
          text(ctx, line, 480, 39, {
            size: 10, color: PAL.parchment2, align: 'center'
          });
        }
        if (game.boss && !game.boss.dead) {
          this._drawBossBar(ctx, game.boss);
        }
        if (game.tutorialMode) {
          text(ctx, '新手试炼 · 木桩不会反击 · 按 ESC 暂停后可退出', 480, 54, {
            size: 9, color: '#8fd6ff', align: 'center'
          });
        }
      }

      // 小地图
      this._drawMinimap(ctx);

      // 武器 / 金币
      this._drawWeaponCard(ctx);

      // 已获得的机制被动（左侧检视栏）
      this._drawPassiveRail(ctx);

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

      // 黄金台：可收服 / 吟唱进度。
      this.captureRect = null;
      if (game.touchMode && p.hasWeapon('golden_altar')) {
        const cr = { x: 744, y: 552, w: 56, h: 24 };
        this.captureRect = cr;
        panel(ctx, cr.x, cr.y, cr.w, cr.h, { fill: 'rgba(8,6,15,.9)', border: 'rgba(255,211,107,.55)' });
        text(ctx, '收 服', cr.x + cr.w / 2, cr.y + 16, {
          size: 9, color: game.captureAvailable && game.captureAvailable() ? '#ffd36b' : PAL.muted,
          align: 'center', bold: true
        });
      }
      if (game.captureTimer > 0) {
        panel(ctx, 340, 474, 280, 34, { fill: 'rgba(8,6,15,.94)', border: 'rgba(255,211,107,.7)' });
        text(ctx, '黄金台 · 吟唱收服', 480, 486, { size: 10, color: '#ffd36b', align: 'center', bold: true });
        bar(ctx, 360, 494, 240, 6, 1 - game.captureTimer / 1.2, '#ffd36b', { segments: false });
      } else if (game.captureAvailable && game.captureAvailable()) {
        panel(ctx, 360, 474, 240, 28, { fill: 'rgba(8,6,15,.9)', border: 'rgba(255,211,107,.55)' });
        text(ctx, 'R · 黄金台收服', 480, 489, { size: 10, color: '#ffd36b', align: 'center', bold: true });
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

    _drawPassiveRail(ctx) {
      const p = this.game.player;
      if (!p) return;
      const relicCount = Object.keys(p.relics || {}).length;
      if ((!p.passives || p.passives.length === 0) && relicCount === 0) return;
      // 按获得顺序去重，双列展示，尽量把所有机缘放在左侧可检视。
      const ids = [];
      for (const id of p.passives) if (!ids.includes(id)) ids.push(id);
      const shown = ids;
      const rows = Math.ceil(shown.length / 2);
      const h = 26 + rows * 16;
      const x = 14, y = 100, w = 226, colW = 108;
      panel(ctx, x, y, w, h, { fill: 'rgba(8,6,14,.82)' });
      text(ctx, '机 缘 · 遗物 ' + relicCount, x + 9, y + 14, { size: 9, color: PAL.gold, bold: true });
      text(ctx, String(p.passives.length) + ' 层', x + w - 9, y + 14, {
        size: 8, color: PAL.muted, align: 'right'
      });
      for (let i = 0; i < shown.length; i++) {
        const id = shown[i];
        const def = Ink.Passives[id];
        if (!def) continue;
        const col = i % 2;
        const ry = y + 26 + Math.floor(i / 2) * 16;
        const cx = x + 9 + col * colW;
        ctx.fillStyle = def.color || PAL.gold;
        ctx.fillRect(cx, ry + 2, 4, 8);
        text(ctx, def.name, cx + 8, ry + 9, { size: 8, color: PAL.parchment2 });
        text(ctx, '×' + (p.passiveStacks[id] || 1), cx + colW - 10, ry + 9, {
          size: 8, color: PAL.gold, align: 'right'
        });
      }
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

      const cellW = 21, cellH = 20;
      const ox = px + 12, oy = py + 27;
      const byId = {};
      for (const r of floor.rooms) byId[r.id] = r;

      const pos = (r) => ({ x: ox + r.mapX * cellW + 10, y: oy + r.mapY * cellH + 7 });

      // 连接线：双端都未探索的通道被迷雾遮住；只探到一端的画成虚线。
      ctx.save();
      for (const r of floor.rooms) {
        const a = pos(r);
        for (const id of r.connections) {
          if (id < r.id) continue; // 每条只画一次
          const b = byId[id];
          if (!b) continue;
          if (!r.visited && !b.visited) continue;
          const bp = pos(b);
          const known = r.visited && b.visited;
          ctx.strokeStyle = known
            ? (r.cleared && b.cleared ? 'rgba(232,193,112,.45)' : 'rgba(109,99,136,.5)')
            : 'rgba(143,214,255,.22)';
          ctx.lineWidth = known ? 2 : 1;
          if (!known) ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bp.x, bp.y);
          ctx.stroke();
          ctx.setLineDash([]);
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
        if (!r.visited) {
          // 未探索房间只保留轮廓与问号，类型不剧透。
          fill = 'rgba(18,15,29,.92)';
          border = 'rgba(87,79,108,.55)';
        } else {
          if (r.type === 'boss') { fill = 'rgba(217,79,92,.2)'; border = 'rgba(255,125,125,.75)'; }
          if (r.type === 'elite') { fill = 'rgba(232,193,112,.16)'; border = 'rgba(232,193,112,.75)'; }
          if (r.type === 'shop') { fill = 'rgba(255,211,107,.18)'; border = 'rgba(255,211,107,.8)'; }
          if (r.type === 'event') { fill = 'rgba(143,214,255,.16)'; border = 'rgba(143,214,255,.75)'; }
        }
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
        if (!r.visited) {
          ctx.fillStyle = 'rgba(180,170,200,.55)';
          ctx.font = '8px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', pt.x + 1, pt.y);
        } else if (r.type === 'boss') {
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

      // 学姐工具与黄金台提示。
      const toolLine = '法棒×' + (p.tools.wand || 0) + '  资料×' + (p.tools.review || 0) +
        (p.hasWeapon('golden_altar') ? '   R 收服' : '');
      if (toolLine.trim()) {
        text(ctx, toolLine, x + 2, y - 30, { size: 8, color: 'rgba(207,192,157,.62)' });
      }

      // 双武器槽：武器卡上方一排小格，Q / 点按切换。
      if ((p.maxWeaponSlots || 2) > 1) {
        for (let i = 0; i < p.maxWeaponSlots; i++) {
          const id = p.weaponSlots[i];
          const active = i === p.weaponSlot;
          const sw = (w - 6 * (p.maxWeaponSlots - 1)) / p.maxWeaponSlots;
          const sx = x + i * (sw + 6);
          ctx.fillStyle = active ? 'rgba(232,193,112,.20)' : 'rgba(8,6,15,.86)';
          ctx.fillRect(sx, y - 20, sw, 17);
          ctx.strokeStyle = active ? PAL.gold : 'rgba(109,99,136,.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, y - 19.5, sw - 1, 16);
          let label = (i + 1) + ' 空';
          if (id && id !== 'fists') {
            const d = Ink.Weapons.get(id);
            label = (i + 1) + ' ' + (d ? d.name : id);
          }
          text(ctx, label, sx + sw / 2, y - 11, {
            size: 7.5, color: active ? PAL.gold2 : PAL.muted, align: 'center', bold: active
          });
        }
      }
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
      const cost = p.weaponEnergyCost ? p.weaponEnergyCost(wdef) : 0;
      const shortage = cost > 0 && p.energy < cost;
      text(ctx, '威伤 ' + (wdef.damage || 0) + ' · ' + (Ink.Rarity[wdef.rarity] || {}).name +
        ' · ' + (cost > 0 ? '耗能 ' + cost : '无耗能') + (wdef.charged ? ' · 蓄力' : ''), x + 48, y + 43, {
        size: 8, color: shortage ? '#ff7d7d' : (wdef.charged ? '#ffe6a8' : 'rgba(207,192,157,.62)')
      });

      // 武器可以主动丢弃 / 切换；触屏点小按钮，桌面按 G / Q。
      this.weaponDropRect = null;
      if ((p.maxWeaponSlots || 2) > 1) {
        if (this.game.touchMode) {
          this._button(ctx, { x: x + w - 42, y: y + 15, w: 30, h: 14 }, '换', {
            size: 8, onClick: () => p.switchWeapon()
          });
        } else {
          text(ctx, 'Q 换兵', x + w - 10, y + 32, {
            size: 8, color: 'rgba(207,192,157,.42)', align: 'right'
          });
        }
      }
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

      // 技能名 / 能量消耗
      const skillCost = p.skillEnergyCost || 0;
      const energyReady = skillCost <= 0 || p.energy >= skillCost;
      text(ctx, p.def.skillName, c.x, c.y + c.r + 18, {
        size: 9, color: ready ? PAL.parchment2 : 'rgba(207,192,157,.55)', align: 'center'
      });
      text(ctx, skillCost > 0 ? ('耗能 ' + skillCost + (energyReady ? '' : ' · 不足')) : '无耗能 · 冷却', c.x, c.y + c.r + 30, {
        size: 8, color: energyReady ? '#8fd6ff' : '#ff7d7d', align: 'center'
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
      text(ctx, '每通过 5 关获得一次机缘 · 击败庭主额外获得一次 · 可重复叠层 · 数字键 1 / 2 / 3', 480, 140, {
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
        wrapped(ctx, def.desc, x + cw / 2, y + 170, cw - 40, {
          size: 10, color: PAL.parchment2, lineHeight: 14, align: 'center', maxLines: 3
        });
        const owned = this.game.player ? this.game.player.passiveStack(def.id) : 0;
        text(ctx, owned ? '已叠加 ' + owned + ' 层 · 再选 +1' : '尚未拥有 · 可叠加', x + cw / 2, y + 232, {
          size: 9, color: owned ? def.color : PAL.muted, align: 'center'
        });
        this._button(ctx, { x: x + 34, y: y + 246, w: cw - 68, h: 28 }, '选 择', {
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

    // ── 随机事件 ──────────────────────────────────────────
    _drawPrep(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.72)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();
      panel(ctx, 120, 92, 720, 410, { fill: 'rgba(14,12,22,.98)', border: 'rgba(232,193,112,.55)' });
      drawCornerMarks(ctx, 120, 92, 720, 410, PAL.gold);
      text(ctx, '入 庭 准 备', 480, 132, { size: 27, color: PAL.gold, align: 'center', bold: true });
      wrapped(ctx, this.game.prepNotice || '先整备，再推门。', 480, 164, 590, {
        size: 11, color: PAL.parchment2, lineHeight: 18, align: 'center', maxLines: 2
      });
      const choices = (this.game.prepChoices || []).slice(0, 3);
      const cw = 206, gap = 24;
      const x0 = (960 - (choices.length * cw + (choices.length - 1) * gap)) / 2;
      for (let i = 0; i < choices.length; i++) {
        const c = choices[i];
        const x = x0 + i * (cw + gap), y = 220, h = 196;
        panel(ctx, x, y, cw, h, { fill: 'rgba(22,19,34,.96)', border: 'rgba(232,193,112,.45)' });
        text(ctx, '0' + (i + 1), x + 12, y + 14, { size: 10, color: PAL.muted, bold: true });
        text(ctx, c.name, x + cw / 2, y + 54, { size: 17, color: PAL.gold2, align: 'center', bold: true });
        wrapped(ctx, c.desc, x + cw / 2, y + 88, cw - 34, {
          size: 10.5, color: PAL.parchment2, lineHeight: 16, align: 'center', maxLines: 3
        });
        this._button(ctx, { x: x + 26, y: y + h - 44, w: cw - 52, h: 28 }, '整 备', {
          size: 12, selected: true, onClick: () => this.game.choosePrep(c.id)
        });
      }
      text(ctx, '准备房不刷怪；选择后进入第 1 关。', 480, 458, {
        size: 10, color: 'rgba(207,192,157,.55)', align: 'center'
      });
    }

    _drawEvent(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.8)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      const room = this.game.room;
      panel(ctx, 110, 70, 740, 460, { fill: 'rgba(14,12,22,.98)', border: 'rgba(143,214,255,.55)' });
      drawCornerMarks(ctx, 110, 70, 740, 460, '#8fd6ff');
      text(ctx, (room && room.name) || '奇 遇', 480, 108, {
        size: 26, color: '#cbe8ff', align: 'center', bold: true
      });
      wrapped(ctx, this.game.eventNotice || '庭中忽然多出一条没有编号的路。', 480, 138, 600, {
        size: 11, color: PAL.muted, lineHeight: 17, align: 'center', maxLines: 2
      });

      const choices = (this.game.eventChoices || []).slice(0, 3);
      const cw = 210, gap = 25;
      const x0 = (960 - (choices.length * cw + (choices.length - 1) * gap)) / 2;
      for (let i = 0; i < choices.length; i++) {
        const c = choices[i];
        const x = x0 + i * (cw + gap);
        const y = 200, h = 236;
        const mouse = this.game.input.mouse;
        const hover = !this.game.touchMode && hit({ x, y, w: cw, h }, mouse.x, mouse.y);
        panel(ctx, x, y, cw, h, {
          fill: hover ? 'rgba(40,42,62,.98)' : 'rgba(20,20,32,.96)',
          border: hover ? '#8fd6ff' : 'rgba(70,80,110,.95)'
        });
        text(ctx, String(i + 1), x + 12, y + 14, { size: 10, color: PAL.gold, bold: true });
        text(ctx, c.label, x + cw / 2, y + 58, {
          size: 18, color: '#e7f5ff', align: 'center', bold: true
        });
        wrapped(ctx, c.desc, x + cw / 2, y + 92, cw - 36, {
          size: 11, color: PAL.parchment2, lineHeight: 17, align: 'center', maxLines: 4
        });
        this._button(ctx, { x: x + 28, y: y + h - 48, w: cw - 56, h: 30 }, '选 择', {
          size: 12, selected: true, onClick: () => this.game.chooseEvent(i)
        });
      }

      text(ctx, '事件不会重复；选择后门扉开启。', 480, 492, {
        size: 10, color: 'rgba(207,192,157,.55)', align: 'center'
      });
    }

    // ── 行商 ──────────────────────────────────────────────
    _drawShop(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,3,9,.82)';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();

      const p = this.game.player;
      const tab = this.game.shopTab || 'weapon';
      panel(ctx, 70, 42, 820, 516, { fill: 'rgba(15,12,18,.98)', border: 'rgba(232,193,112,.55)' });
      drawCornerMarks(ctx, 70, 42, 820, 516, PAL.gold);
      text(ctx, '庭 中 行 商', 480, 78, {
        size: 26, color: PAL.gold, align: 'center', bold: true
      });
      text(ctx, '学长的兵刃铺 · 学姐的杂货摊', 480, 104, {
        size: 10, color: PAL.muted, align: 'center'
      });
      if (p) {
        text(ctx, '金币 ' + p.coins + '   ·   生命 ' + Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), 852, 80, {
          size: 10, color: '#ffd36b', align: 'right'
        });
      }

      this._button(ctx, { x: 150, y: 116, w: 250, h: 34 }, '学 长 · 攻 击 兵 刃', {
        size: 12, selected: tab === 'weapon',
        onClick: () => { this.game.shopTab = 'weapon'; this.game.audio.sfx('ui'); }
      });
      this._button(ctx, { x: 560, y: 116, w: 250, h: 34 }, '学 姐 · 增 益 工 具', {
        size: 12, selected: tab === 'tool',
        onClick: () => { this.game.shopTab = 'tool'; this.game.audio.sfx('ui'); }
      });

      if (tab === 'weapon') {
        const offers = this.game.shopOffers || [];
        const cw = 226, gap = 18;
        const x0 = (960 - (offers.length * cw + (offers.length - 1) * gap)) / 2;
        for (let i = 0; i < offers.length; i++) {
          const offer = offers[i];
          const def = Ink.Weapons.get(offer.id);
          if (!def) continue;
          const x = x0 + i * (cw + gap);
          const y = 168;
          const h = 312;
          const rarity = Ink.Rarity[def.rarity] || Ink.Rarity.common;
          panel(ctx, x, y, cw, h, {
            fill: offer.sold ? 'rgba(14,12,18,.9)' : 'rgba(24,20,29,.97)',
            border: offer.sold ? 'rgba(69,58,96,.6)' : rarity.color,
            accent: U.rgba(def.color, 0.35)
          });
          ctx.fillStyle = def.color;
          ctx.fillRect(x + 5, y + 5, cw - 10, 3);
          Ink.Weapons.drawIcon(ctx, x + cw / 2, y + 62, 2.15, def.id, this.time);
          text(ctx, def.name, x + cw / 2, y + 110, {
            size: 18, color: def.color, align: 'center', bold: true
          });
          text(ctx, rarity.name + ' · 威伤 ' + def.damage, x + cw / 2, y + 133, {
            size: 9, color: rarity.color, align: 'center'
          });
          wrapped(ctx, def.desc, x + cw / 2, y + 154, cw - 36, {
            size: 8.5, color: PAL.parchment2, lineHeight: 13, align: 'center', maxLines: 3
          });
          if (offer.sold) {
            text(ctx, '已 售 出', x + cw / 2, y + 242, {
              size: 15, color: PAL.muted, align: 'center', bold: true
            });
          } else {
            this._button(ctx, { x: x + 20, y: y + 224, w: cw - 40, h: 30 }, '金币 ' + offer.price, {
              size: 11, disabled: p.coins < offer.price,
              onClick: () => this.game.buyWeapon(i, false)
            });
            const hpCost = p ? Math.ceil(p.maxHp * 0.25) : 0;
            this._button(ctx, { x: x + 20, y: y + 260, w: cw - 40, h: 30 }, '生命 ' + hpCost, {
              size: 11, disabled: p.hp <= hpCost + 1,
              onClick: () => this.game.buyWeapon(i, true)
            });
          }
          text(ctx, '#' + (i + 1), x + 14, y + 18, {
            size: 9, color: rarity.color, bold: true
          });
        }
      } else {
        const offers = this.game.shopTools || [];
        const cw = 232, gap = 20;
        const x0 = (960 - (offers.length * cw + (offers.length - 1) * gap)) / 2;
        for (let i = 0; i < offers.length; i++) {
          const offer = offers[i];
          const x = x0 + i * (cw + gap);
          const y = 184;
          const h = 264;
          panel(ctx, x, y, cw, h, {
            fill: offer.sold ? 'rgba(14,12,18,.9)' : 'rgba(24,20,29,.97)',
            border: offer.sold ? 'rgba(69,58,96,.6)' : offer.color,
            accent: U.rgba(offer.color, 0.35)
          });
          ctx.fillStyle = offer.color;
          ctx.fillRect(x + 5, y + 5, cw - 10, 3);
          this._button(ctx, { x: x + cw / 2 - 26, y: y + 34, w: 52, h: 52 }, offer.id === 'review_notes' ? '档' : offer.id === 'summon_wand' ? '兽' : '能', {
            size: 22, disabled: true
          });
          text(ctx, offer.name, x + cw / 2, y + 112, {
            size: 17, color: offer.color, align: 'center', bold: true
          });
          wrapped(ctx, offer.desc, x + cw / 2, y + 134, cw - 34, {
            size: 9, color: PAL.parchment2, lineHeight: 14, align: 'center', maxLines: 3
          });
          if (offer.sold) {
            text(ctx, '已 售 出', x + cw / 2, y + 210, {
              size: 15, color: PAL.muted, align: 'center', bold: true
            });
          } else {
            this._button(ctx, { x: x + 24, y: y + 208, w: cw - 48, h: 32 }, '金币 ' + offer.price, {
              size: 12, disabled: p.coins < offer.price,
              onClick: () => this.game.buyTool(i)
            });
          }
          if (offer.id === 'review_notes') {
            text(ctx, '按 T 存档 · 已有 ' + (p.tools.review || 0), x + cw / 2, y + 246, {
              size: 8, color: PAL.muted, align: 'center'
            });
          } else if (offer.id === 'summon_wand') {
            text(ctx, '按 F 召唤 · 已有 ' + (p.tools.wand || 0), x + cw / 2, y + 246, {
              size: 8, color: PAL.muted, align: 'center'
            });
          }
        }
      }

      text(ctx, this.game.shopNotice || '', 480, 498, {
        size: 10, color: 'rgba(207,192,157,.65)', align: 'center'
      });
      this._button(ctx, { x: 360, y: 512, w: 240, h: 30 }, '离 开 摊 位', {
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
      text(ctx, '提示：清空关卡 1–6 的敌人并处理事件，庭主门才会解封。', 480, 478, {
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
      text(ctx, '一庭奇树，十三主尽数落子。', 480, 166, {
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
            '每层 7 关 · 第 7 关为庭主',
            '第 2、4 关后：机制被动三选一',
            '精英关旁：行商换武器',
            '庭主掉落专属武器',
            '五层十三位守门人，强度逐层提升',
            '五层通关即为胜利'
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
        '御狶 · 召唤协同：影犬嘲讽，代承伤害'
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

    _drawClearBanner(ctx) {
      const b = this.clearBanner;
      if (!b) return;
      const fadeIn = U.clamp((b.max - b.t) / 0.18, 0, 1);
      const fadeOut = U.clamp(b.t / 0.45, 0, 1);
      const a = Math.min(fadeIn, fadeOut);
      const slide = (1 - fadeIn) * -16;
      ctx.save();
      ctx.globalAlpha = a;
      const w = 360, h = 66, x = (960 - w) / 2, y = 108 + slide;
      ctx.fillStyle = 'rgba(8,6,14,.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = U.rgba(b.color, 0.9);
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = U.rgba(b.color, 0.20);
      ctx.fillRect(x + 2, y + 2, w - 4, 3);
      ctx.fillStyle = b.color;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillRect(x + w - 3, y - 3, 6, 6);
      ctx.fillRect(x - 3, y + h - 3, 6, 6);
      ctx.fillRect(x + w - 3, y + h - 3, 6, 6);
      setFont(ctx, 20, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = b.color;
      ctx.fillText(b.title, 480, y + 24);
      setFont(ctx, 10);
      ctx.fillStyle = PAL.parchment2;
      ctx.fillText(b.sub, 480, y + 48);
      ctx.restore();
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
