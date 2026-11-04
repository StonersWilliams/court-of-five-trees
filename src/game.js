/**
 * src/game.js
 * ------------------------------------------------------------
 * 庭有五棵树 · 主状态机与地牢循环。
 *
 * 这个文件把引擎、角色、地牢、UI 串起来：
 *   - 场景切换：title → select → playing → levelup / passive / shop / paused / gameover / victory
 *   - 关卡循环：进入关卡 → 清怪 → 开门 → 关卡 1 / 2 → 关卡 3 层主
 *   - 层主循环：击败层主 → 随机武器掉落 → 传送门 → 下一层
 *
 * 所有可调数值都尽量集中在文件顶部，方便 fork 后快速改手感。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;
  const PAL = Ink.PAL;
  const FX = Ink.FX;

  const UPGRADE_KEYS = ['damage', 'atkSpeed', 'cooldown', 'speed', 'survival'];
  const ROOM_LABELS = {
    start: '入口',
    battle: '战斗',
    elite: '精英',
    boss: '层主',
    shop: '行商'
  };

  // ═══════════════════════════════════════════════════════════
  //  掉落物：经验墨晶 / 生命残片 / 金币 / 武器
  // ═══════════════════════════════════════════════════════════
  class Pickup {
    constructor(game, x, y, value, kind = 'xp', weaponId = null) {
      this.game = game;
      this.x = x;
      this.y = y;
      this.value = value;
      this.kind = kind;
      this.weaponId = weaponId;
      this.vx = U.rand(-120, 120);
      this.vy = U.rand(-150, -40);
      this.life = 32;
      this.maxLife = 32;
      this.radius = kind === 'heart' ? 8 : kind === 'weapon' ? 14 : kind === 'coin' ? 7 : 6;
      this.dead = false;
      this.time = U.rand(0, 6);
    }

    update(dt, game) {
      if (this.dead) return;
      this.time += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }

      const p = game.player;
      if (!p || p.dead) return;
      const d = U.dist(this.x, this.y, p.x, p.y);
      let magnetRadius = 150;
      if (p.hasPassive && p.hasPassive('magnet')) magnetRadius += 80;
      if (d < magnetRadius) {
        // 磁吸：越近吸得越快
        const a = U.angleTo(this, p);
        const pull = 520 + (magnetRadius - d) * 5;
        this.vx += Math.cos(a) * pull * dt;
        this.vy += Math.sin(a) * pull * dt;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const drag = Math.max(0, 1 - 3.4 * dt);
      this.vx *= drag;
      this.vy *= drag;

      const pickR = this.kind === 'weapon' ? 34 : 24;
      if (d < pickR) {
        this.dead = true;
        if (this.kind === 'heart') {
          p.heal(this.value);
          FX.text(game, '+' + Math.round(this.value) + ' 生命', p.x, p.y - 36, '#ff9bb0', 12, 0.7);
        } else if (this.kind === 'coin') {
          p.addCoins(this.value);
          FX.text(game, '+' + this.value + ' 金币', p.x, p.y - 36, '#ffd36b', 12, 0.7);
        } else if (this.kind === 'weapon') {
          const w = Ink.Weapons.get(this.weaponId);
          p.equipWeapon(this.weaponId);
          game.ui.showToast('拾取武器 · ' + (w ? w.name : '未知兵刃'), w ? w.color : PAL.gold, 2.2);
        } else {
          p.gainXp(this.value);
        }
        FX.burst(game, this.x, this.y, this.kind === 'heart' ? '#ff9bb0' : this.kind === 'coin' ? '#ffd36b' : '#8fd6ff', 7, 90, {
          size: 2, glow: true, lifeMult: 0.7
        });
        game.audio.sfx('pickup');
      }
    }

    draw(ctx, game) {
      if (this.dead) return;
      const blink = this.life < 4 && Math.floor(this.life * 8) % 2 === 0;
      const alpha = blink ? 0.35 : 1;
      if (this.kind === 'heart') {
        const bob = Math.sin(this.time * 3) * 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y + bob);
        ctx.fillStyle = 'rgba(255,110,145,.16)';
        ctx.beginPath();
        ctx.arc(0, 0, 12 + Math.sin(this.time * 4) * 2, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = '#ff6f91';
        ctx.fillRect(-4, -3, 3, 3);
        ctx.fillRect(1, -3, 3, 3);
        ctx.fillRect(-5, 0, 10, 4);
        ctx.fillRect(-3, 4, 6, 2);
        ctx.fillRect(-1, 6, 2, 1);
        ctx.fillStyle = '#ffd0dd';
        ctx.fillRect(-3, -2, 2, 2);
        ctx.restore();
      } else if (this.kind === 'coin') {
        const bob = Math.sin(this.time * 4) * 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(255,211,107,.18)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + bob, 11 + Math.sin(this.time * 5) * 2, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd36b';
        ctx.fillRect(this.x - 4, this.y - 4 + bob, 8, 8);
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(this.x - 2, this.y - 2 + bob, 4, 2);
        ctx.restore();
      } else if (this.kind === 'weapon') {
        const bob = Math.sin(this.time * 3) * 3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(232,193,112,.18)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + bob, 18 + Math.sin(this.time * 4) * 3, 0, U.TAU);
        ctx.fill();
        Ink.Weapons.drawIcon(ctx, this.x, this.y + bob, 1.6, this.weaponId, game.time);
        ctx.restore();
      } else {
        Ink.Art.drawXpGem(ctx, this.x, this.y, this.value, game.time);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Game
  // ═══════════════════════════════════════════════════════════
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.input = new Ink.InputManager(canvas);
      this.audio = Ink.audio;
      this.ui = new Ink.UI(this);

      this.time = 0;
      this.running = false;
      this.lastTs = 0;
      this.state = 'title';

      // 触屏模式：默认根据设备能力决定；首次鼠标按下会切回桌面模式。
      this.touchMode = !!this.input.hasTouch;
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;

      // 当前局
      this.lastCharId = 'qiyun';
      this.player = null;
      this.dog = null;
      this.boss = null;
      this.dungeon = null;
      this.floorIndex = 0;
      this.floor = 1;
      this.floorData = null;
      this.room = null;

      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];

      this.transition = null;
      this.portal = null;
      this.doorCooldown = 0;
      this.doorHintCd = 0;

      this.upgradeChoices = [];
      this.pendingLevelUps = 0;
      this.passiveChoices = [];
      this.passivePending = false;
      this.shopOffers = [];
      this.shopNotice = '';
      this.runStats = { floor: 1, kills: 0, rooms: 0, time: 0, bosses: 0 };

      this.shake = 0;
      this.shakeTime = 0;
      this.shakeDur = 0.2;

      this.audio.setScene('title');
      this.input.onFirstGesture = () => this.audio.unlock();
      this.input.onBlur = () => {
        if (this.state === 'playing') this.togglePause();
      };

      // 切到后台自动暂停，回来不会被围殴。
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });
    }

    // ── 主循环 ───────────────────────────────────────────
    start() {
      this.running = true;
      this.lastTs = performance.now();
      const tick = (ts) => {
        if (!this.running) return;
        const dt = U.clamp((ts - this.lastTs) / 1000, 0, 0.05);
        this.lastTs = ts;
        this.update(dt);
        this.draw();
        this.input.endFrame();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ── 输入封装 ─────────────────────────────────────────
    getMoveVector() {
      let x = this.touchMove ? this.touchMove.x : 0;
      let y = this.touchMove ? this.touchMove.y : 0;
      const kb = this.input.moveVector();
      x += kb.x;
      y += kb.y;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    }

    // ── 场景切换 ─────────────────────────────────────────
    toTitle() {
      this.state = 'title';
      this.transition = null;
      this.player = null;
      this.dog = null;
      this.boss = null;
      this.room = null;
      this.floorData = null;
      this.dungeon = null;
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];
      this.portal = null;
      this.upgradeChoices = [];
      this.pendingLevelUps = 0;
      this.passiveChoices = [];
      this.passivePending = false;
      this.shopOffers = [];
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.audio.setScene('title');
      this.input.reset();
      FX.reset();
      this.ui.helpOpen = false;
      this.ui.toast = null;
    }

    toSelect() {
      this.state = 'select';
      this.transition = null;
      this.player = null;
      this.dog = null;
      this.boss = null;
      this.room = null;
      this.floorData = null;
      this.dungeon = null;
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];
      this.portal = null;
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.audio.setScene('title');
      this.input.reset();
      FX.reset();
      this.ui.helpOpen = false;
      this.ui.toast = null;
    }

    startRun(charId) {
      if (!Ink.Characters[charId]) charId = 'qiyun';
      this.lastCharId = charId;
      this.input.reset();
      this.audio.unlock();

      this.state = 'playing';
      this.time = 0;
      this.transition = null;
      this.player = null;
      this.dog = null;
      this.boss = null;
      this.room = null;
      this.portal = null;
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];
      this.shake = 0;
      this.shakeTime = 0;
      this.doorCooldown = 0;
      this.doorHintCd = 0;
      this.upgradeChoices = [];
      this.pendingLevelUps = 0;
      this.passiveChoices = [];
      this.passivePending = false;
      this.shopOffers = [];
      this.shopNotice = '';
      this.runStats = { floor: 1, kills: 0, rooms: 0, time: 0, bosses: 0 };
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.portal = null;
      FX.reset();

      this.dungeon = new Ink.Dungeon();
      this.player = new Ink.Player(this, charId);
      // 聪明小狗在角色 onSpawn 里创建影犬；其他角色保持为空。
      if (charId !== 'smartdog') this.dog = null;

      this.floorIndex = 0;
      this.floor = 1;
      this.ui.helpOpen = false;
      this.ui.toast = null;
      this.enterFloor(0, false);

      this.audio.setScene('play');
    }

    restartRun() {
      this.startRun(this.lastCharId || (this.player && this.player.charId) || 'qiyun');
    }

    togglePause() {
      if (this.transition) return;
      if (this.state === 'playing') {
        this.state = 'paused';
        this.touchMove = { x: 0, y: 0 };
        this.skillRequest = false;
      } else if (this.state === 'paused') {
        this.state = 'playing';
      }
    }

    resume() {
      if (this.state === 'paused') this.state = 'playing';
    }

    toggleMute() {
      const muted = this.audio.toggleMute();
      this.ui.showToast(muted ? '音效已关闭' : '音效已开启', PAL.gold, 1.4);
      return muted;
    }

    onPlayerDeath() {
      if (this.state === 'gameover' || this.state === 'victory') return;
      this.state = 'gameover';
      this.runStats.floor = this.floor;
      this.audio.setScene('silent');
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
    }

    // ── 升级三选一 ────────────────────────────────────────
    onPlayerLevelUp(level) {
      if (this.state === 'gameover' || this.state === 'victory') return;
      this.pendingLevelUps++;
      if (this.state === 'playing') this.openUpgrade();
    }

    openUpgrade() {
      const pool = U.shuffle(UPGRADE_KEYS.slice());
      this.upgradeChoices = pool.slice(0, 3);
      this.state = 'levelup';
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.audio.sfx('levelup');
    }

    chooseUpgrade(kind) {
      if (this.state !== 'levelup') return;
      if (!this.player || !this.upgradeChoices.includes(kind)) return;
      this.player.applyUpgrade(kind);
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      if (this.pendingLevelUps > 0) {
        const pool = U.shuffle(UPGRADE_KEYS.slice());
        this.upgradeChoices = pool.slice(0, 3);
      } else {
        this.upgradeChoices = [];
        this.state = 'playing';
      }
    }

    // ── 机制被动三选一（每层第 2 关后） ─────────────────
    openPassive() {
      if (!this.player) return;
      const pool = U.shuffle(Ink.PassiveList.filter((id) => !this.player.hasPassive(id)));
      this.passiveChoices = pool.slice(0, 3);
      this.state = 'passive';
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.audio.sfx('levelup');
    }

    choosePassive(id) {
      if (this.state !== 'passive') return;
      if (!this.passiveChoices.includes(id)) return;
      this.player.applyPassive(id);
      this.passiveChoices = [];
      this.state = 'playing';
      this.audio.sfx('skillReady');
      this.ui.showToast('获得机制 · ' + (Ink.Passives[id] ? Ink.Passives[id].name : id), PAL.gold, 2.0);
    }

    // ── 行商 ─────────────────────────────────────────────
    openShop() {
      if (!this.floorData) return;
      if (!this.floorData.shopOffers) {
        this.floorData.shopOffers = Ink.Weapons.randomOffers(this.floor, 3).map((id) => ({
          id,
          price: Ink.Weapons.priceFor(id, this.floor),
          sold: false
        }));
      }
      this.shopOffers = this.floorData.shopOffers;
      this.shopNotice = '金币或生命，都可以换一把趁手的兵刃。';
      this.state = 'shop';
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
      this.audio.sfx('ui');
    }

    buyWeapon(index, useHp = false) {
      if (this.state !== 'shop' || !this.player) return;
      const offer = this.shopOffers[index];
      if (!offer || offer.sold) return;
      const p = this.player;
      if (useHp) {
        const hpCost = Math.ceil(p.maxHp * 0.25);
        if (p.hp <= hpCost + 1) {
          this.shopNotice = '生命不足，行商摇头拒绝。';
          this.audio.sfx('uiBack');
          return;
        }
        p.hp -= hpCost;
        offer.sold = true;
        p.equipWeapon(offer.id);
        this.shopNotice = '以 ' + hpCost + ' 点生命换来武器。';
      } else {
        if (p.coins < offer.price) {
          this.shopNotice = '金币不足。去地牢里再敲几块墨晶。';
          this.audio.sfx('uiBack');
          return;
        }
        p.addCoins(-offer.price);
        offer.sold = true;
        p.equipWeapon(offer.id);
        this.shopNotice = '交易达成。兵刃已入手。';
      }
      this.audio.sfx('pickup');
    }

    closeShop() {
      if (this.state !== 'shop') return;
      this.state = 'playing';
      this.audio.sfx('uiBack');
    }

    // ── 地牢 / 房间 ──────────────────────────────────────
    enterFloor(index, healOnEnter = true) {
      const fd = this.dungeon && this.dungeon.floors[index];
      if (!fd) return;

      this.floorIndex = index;
      this.floor = fd.number;
      this.floorData = fd;
      this.dungeon.refresh(fd);

      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];
      this.boss = null;
      this.portal = null;
      FX.reset();

      const room = this.dungeon.getRoom(fd, fd.startRoomId);
      this.room = room;
      room.visited = true;
      room.entered = true;
      this.dungeon.refresh(fd);
      this.loadObstacles(room);

      const p = this.player;
      p.x = Ink.ARENA.x + Ink.ARENA.w / 2;
      p.y = Ink.ARENA.y + Ink.ARENA.h / 2 + 30;
      p.aimAngle = -Math.PI / 2;
      p.invuln = Math.max(p.invuln, 1.1);

      if (this.dog && this.dog.alive) {
        this.dog.x = p.x - 44;
        this.dog.y = p.y + 30;
        this.dog.mode = 'follow';
      }

      this.spawnRoom(room);
      p.onRoomEnter();
      if (healOnEnter) {
        p.heal(p.maxHp * 0.2);
        p.addArmor(2);
      }

      this.doorCooldown = 1.2;
      this.doorHintCd = 0;
      this.skillRequest = false;
      this.touchMove = { x: 0, y: 0 };
      this.runStats.floor = this.floor;
      this.audio.setScene('play');
      this.ui.showToast('第 ' + fd.number + ' 层 · 关卡 1 / 3', fd.theme.accent || PAL.gold, 2.2);
    }

    enterRoom(targetId, viaSide = null) {
      const target = this.dungeon && this.dungeon.getRoom(this.floorData, targetId);
      if (!target) return;
      const wasVisited = !!target.visited;

      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.obstacles = [];
      this.afterTimers = [];
      this.boss = null;
      this.portal = null;
      FX.reset();

      this.room = target;
      target.visited = true;
      target.entered = true;
      this.loadObstacles(target);

      // 从哪边进来，就贴在对面门的内侧。
      const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[viaSide];
      const side = opposite || 'bottom';
      const door = Ink.DOOR_POINTS[side];
      const p = this.player;
      const A = Ink.ARENA;
      const inset = 92;
      if (side === 'left') {
        p.x = A.x + inset;
        p.y = door.y;
      } else if (side === 'right') {
        p.x = A.x + A.w - inset;
        p.y = door.y;
      } else if (side === 'top') {
        p.x = door.x;
        p.y = A.y + inset;
      } else {
        p.x = door.x;
        p.y = A.y + A.h - inset;
      }
      p.aimAngle = U.angleTo(p, { x: 480, y: 334 });
      p.invuln = Math.max(p.invuln, 0.9);

      if (this.dog && this.dog.alive) {
        this.dog.x = p.x - 36;
        this.dog.y = p.y + 24;
        this.dog.mode = 'follow';
      }

      this.spawnRoom(target);
      p.onRoomEnter();

      this.doorCooldown = 1.2;
      this.doorHintCd = 0;
      this.skillRequest = false;
      this.touchMove = { x: 0, y: 0 };
      this.audio.setScene(target.type === 'boss' && !target.cleared ? 'boss' : 'play');

      if (target.type === 'shop') {
        this.openShop();
        return;
      }

      if (!wasVisited && target.type !== 'start') {
        const color = target.type === 'boss' ? '#ff8a8a' : target.type === 'elite' ? PAL.gold : PAL.parchment;
        this.ui.showToast(target.name + ' · ' + (ROOM_LABELS[target.type] || '房间'), color, 1.5);
      }
    }

    loadObstacles(room) {
      this.obstacles = (room && room.obstacles) ? room.obstacles : [];
    }

    /** 圆形实体与树/柱/箱的推开，避免穿模。 */
    resolveObstacles(entity) {
      if (!entity || entity.dead || !this.obstacles.length) return;
      for (const o of this.obstacles) {
        if (o.broken) continue;
        const dx = entity.x - o.x;
        const dy = entity.y - o.y;
        const min = (entity.radius || 12) + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          entity.x = o.x + dx / d * min;
          entity.y = o.y + dy / d * min;
        }
      }
      const A = Ink.ARENA;
      const pad = (entity.radius || 12) + 4;
      entity.x = U.clamp(entity.x, A.x + pad, A.x + A.w - pad);
      entity.y = U.clamp(entity.y, A.y + pad, A.y + A.h - pad);
      if (entity._clampToArena) entity._clampToArena();
    }

    /** 投射物撞上障碍；返回 true 表示这次投射物已消耗。 */
    projectileHitObstacle(pr) {
      if (!pr || !this.obstacles.length) return false;
      for (const o of this.obstacles) {
        if (o.broken) continue;
        if (U.dist(pr.x, pr.y, o.x, o.y) > o.r + pr.radius) continue;

        const canBreak = o.destructible && pr.owner === 'player';
        if (canBreak) {
          o.hp -= Math.max(1, pr.damage || 1);
          FX.burst(this, pr.x, pr.y, o.hp <= 0 ? '#ffd36b' : '#c9a276', 6, 90, {
            size: 2, glow: o.hp <= 0
          });
          if (o.hp <= 0) {
            o.broken = true;
            FX.explosion(this, o.x, o.y, 26, '#d9b184');
            this.dropCoin(o.x, o.y, U.randInt(2, 5));
            this.audio.sfx('kill');
          } else {
            this.audio.sfx('hit');
          }
        } else {
          FX.burst(this, pr.x, pr.y, '#d7c39a', 4, 60, { size: 2 });
          this.audio.sfx('hit');
        }
        pr.dead = true;
        return true;
      }
      return false;
    }

    spawnRoom(room) {
      if (room.enemiesSpawned) return;
      room.enemiesSpawned = true;
      room.clearTimer = 0;
      if (room.cleared || room.type === 'shop') return;

      if (room.type === 'boss') {
        this.boss = Ink.spawnBoss(this, this.floorData.bossId, 480, 270);
        this.audio.setScene('boss');
        return;
      }

      const plan = room.spawnPlan || [];
      for (let i = 0; i < plan.length; i++) {
        const s = plan[i];
        Ink.spawnEnemy(this, s.type, s.x, s.y, {
          elite: s.elite,
          floor: this.floor,
          spawnTimer: 0.42 + i * 0.06
        });
      }
      this.pushSpawnsFromPlayer();
    }

    /** 房间生成的敌人若贴着入口，向房间内侧挪开，避免一进门就被围殴。 */
    pushSpawnsFromPlayer() {
      const p = this.player;
      if (!p) return;
      const A = Ink.ARENA;
      for (const e of this.enemies) {
        if (e.dead || e.boss) continue;
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d >= 210) continue;
        let a = U.angleTo(p, e);
        if (d < 1) a = U.rand(0, U.TAU);
        e.x = U.clamp(p.x + Math.cos(a) * 220, A.x + 40, A.x + A.w - 40);
        e.y = U.clamp(p.y + Math.sin(a) * 220, A.y + 40, A.y + A.h - 40);
      }
    }

    startTransition(fn, duration = 0.55) {
      if (this.transition) return false;
      this.transition = {
        t: 0,
        duration,
        half: duration / 2,
        switched: false,
        fn
      };
      this.skillRequest = false;
      this.touchMove = { x: 0, y: 0 };
      if (this.ui.stick) {
        this.ui.stick.active = false;
        this.ui.stick.pointerId = null;
        this.ui.stick.nx = this.ui.stick.ny = 0;
        this.ui.stick.dx = this.ui.stick.dy = 0;
      }
      return true;
    }

    updateTransition(dt) {
      const tr = this.transition;
      if (!tr) return;
      tr.t += dt;
      if (!tr.switched && tr.t >= tr.half) {
        tr.switched = true;
        if (typeof tr.fn === 'function') tr.fn();
      }
      if (tr.t >= tr.duration) this.transition = null;
    }

    // ── 主更新 ───────────────────────────────────────────
    update(dt) {
      this.time += dt;
      this.ui.update(dt);

      // 暂停 / 恢复快捷键（升级三选一与过场中不响应）
      if ((this.state === 'playing' || this.state === 'paused') &&
          this.input.wasPressed('Escape', 'KeyP')) {
        this.togglePause();
      }

      if (this.transition) {
        this.skillRequest = false;
        this.touchMove = { x: 0, y: 0 };
        this.updateTransition(dt);
        this.updateShake(dt);
        return;
      }

      if (this.state !== 'playing') {
        this.updateShake(dt);
        return;
      }

      if (this.passivePending) {
        this.passivePending = false;
        this.openPassive();
        return;
      }

      this.runStats.time += dt;
      this.updateShake(dt);
      this.doorCooldown = Math.max(0, this.doorCooldown - dt);
      this.doorHintCd = Math.max(0, this.doorHintCd - dt);

      // 延迟回调（心阅重新标记等）
      if (this.afterTimers.length) {
        for (const t of this.afterTimers) {
          t.t -= dt;
          if (t.t <= 0 && !t.done) {
            t.done = true;
            t.fn();
          }
        }
        this.afterTimers = this.afterTimers.filter(t => !t.done);
      }

      const p = this.player;
      if (!p) return;
      p.update(dt);
      this.resolveObstacles(p);
      if (this.state !== 'playing') return;

      if (this.dog) {
        this.dog.update(dt);
        this.resolveObstacles(this.dog);
        if (this.state !== 'playing') return;
      }

      for (const e of this.enemies) {
        if (!e.dead) {
          e.update(dt);
          this.resolveObstacles(e);
        }
      }
      this.separateEnemies();
      if (this.state !== 'playing') return;

      for (const pr of this.projectiles) {
        if (!pr.dead) pr.update(dt);
      }

      for (const pk of this.pickups) {
        if (!pk.dead) pk.update(dt, this);
      }

      for (const fx of this.effects) {
        if (!fx.dead) fx.update(dt, this);
      }

      for (const particle of FX.particles) {
        if (!particle.dead) particle.update(dt);
      }

      this.checkRoomClear(dt);
      this.checkDoors();
      this.checkPortal(dt);

      // 清理
      this.enemies = this.enemies.filter(e => !e.dead);
      this.projectiles = this.projectiles.filter(e => !e.dead);
      this.pickups = this.pickups.filter(e => !e.dead);
      this.effects = this.effects.filter(e => !e.dead);
      FX.particles = FX.particles.filter(e => !e.dead);
    }

    updateShake(dt) {
      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        if (this.shakeTime <= 0) {
          this.shakeTime = 0;
          this.shake = 0;
        }
      }
    }

    addShake(amount, duration = 0.2) {
      this.shake = Math.max(this.shake, Math.min(14, amount));
      this.shakeTime = Math.max(this.shakeTime, duration);
      this.shakeDur = Math.max(this.shakeDur, duration);
    }

    /** 让游戏逻辑可以延迟执行（暂停 / 升级时自然冻结）。 */
    after(seconds, fn) {
      this.afterTimers.push({ t: seconds, fn, done: false });
    }

    separateEnemies() {
      const list = this.enemies;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead) continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.dead) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.radius + b.radius) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.001 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = (min - d) * 0.5;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            if (a._clampToArena) a._clampToArena();
            if (b._clampToArena) b._clampToArena();
          }
        }
      }
    }

    checkRoomClear(dt) {
      const room = this.room;
      if (!room || room.cleared || room.type === 'boss' || !room.enemiesSpawned) return;
      let alive = false;
      for (const e of this.enemies) {
        if (!e.dead) { alive = true; break; }
      }
      if (alive) {
        room.clearTimer = 0;
        return;
      }
      room.clearTimer = (room.clearTimer || 0) + dt;
      if (room.clearTimer < 0.38) return;

      room.cleared = true;
      this.dungeon.markCleared(this.floorData, room);
      this.runStats.rooms++;
      this.audio.sfx('door');
      this.player.invuln = Math.max(this.player.invuln, 0.5);
      FX.ring(this, {
        x: 480, y: 334, r0: 20, r1: 220, life: 0.7,
        color: '#8ef0c8', width: 2
      });
      this.ui.showToast('关卡 ' + (room.stage || 1) + ' 已清 · 门扉开启', '#8ef0c8', 1.6);

      // 每层第 2 关结束：从机制被动里三选一。
      if (room.stage === 2 && !this.floorData.passiveOffered) {
        this.floorData.passiveOffered = true;
        this.passivePending = true;
      }
    }

    checkDoors() {
      const room = this.room;
      const p = this.player;
      if (!room || !p || this.doorCooldown > 0 || p.dead) return;
      const mv = this.getMoveVector();
      for (const d of room.doors) {
        const pt = Ink.DOOR_POINTS[d.side];
        if (!pt) continue;
        if (U.dist(p.x, p.y, pt.x, pt.y) > 38) continue;

        let outward = false;
        if (d.side === 'left') outward = mv.x < -0.28;
        else if (d.side === 'right') outward = mv.x > 0.28;
        else if (d.side === 'top') outward = mv.y < -0.28;
        else if (d.side === 'bottom') outward = mv.y > 0.28;
        if (!outward) continue;

        if (!d.open) {
          if (this.doorHintCd <= 0) {
            this.doorHintCd = 2.0;
            const target = this.dungeon.getRoom(this.floorData, d.targetId);
            const bossLocked = target && target.type === 'boss';
            this.ui.showToast(
              bossLocked ? '层主门封印 · 先清空主路' : '门被墨锁住了 · 清光敌人',
              '#ff9b7a', 1.4
            );
            this.audio.sfx('uiBack');
          }
          continue;
        }

        this.doorCooldown = 1.0;
        this.startTransition(() => this.enterRoom(d.targetId, d.side), 0.55);
        return;
      }
    }

    checkPortal(dt) {
      const portal = this.portal;
      if (!portal || !portal.active) return;
      portal.time += dt;
      if (portal.delay > 0) {
        portal.delay -= dt;
        return;
      }
      const p = this.player;
      if (!p || p.dead) return;
      if (U.dist(p.x, p.y, portal.x, portal.y) < 44) {
        portal.active = false;
        this.startTransition(() => {
          if (this.floorIndex >= Ink.FLOOR_COUNT - 1) this.showVictory();
          else this.enterFloor(this.floorIndex + 1, true);
        }, 0.8);
      }
    }

    // ── 战斗结算 ─────────────────────────────────────────
    damageEnemy(enemy, amount, opts = {}) {
      if (!enemy || enemy.dead) return 0;
      let final = amount;
      if (this.player) final = this.player.char.modifyDamageDealt(enemy, final);
      enemy.takeDamage(final, opts);
      return final;
    }

    damagePlayer(amount, source) {
      const p = this.player;
      if (!p || p.dead || p.invuln > 0) return;

      // 心阅：心域完全偏转一次
      if (p.char.tryDeflect(source)) return;

      // 心阅：被动减伤
      amount = p.char.beforeDamage(amount, source);

      // 聪明小狗：影犬先代承一部分
      if (this.dog && this.dog.alive && amount > 0) {
        const absorbed = this.dog.absorbDamage(amount);
        if (absorbed > 0) amount -= absorbed;
      }
      if (amount <= 0) return;
      p.takeDamage(amount, source);
    }

    onEnemyKilled(enemy, opts = {}) {
      this.runStats.kills++;
      if (this.player && this.player.char) this.player.char.onKill(enemy);
      if (opts.boss) {
        this.dropCoin(enemy.x, enemy.y, 24);
      } else if (Math.random() < 0.72) {
        this.dropCoin(enemy.x, enemy.y, U.randInt(1, 2));
      }
      if (enemy.elite || opts.boss) {
        if (Math.random() < (opts.boss ? 1 : 0.35)) {
          this.dropHeart(enemy.x, enemy.y, opts.boss ? 14 : 8);
        }
      }
    }

    onDogBroken() {
      if (this.player && this.player.char.onDogBroken) this.player.char.onDogBroken();
      this.ui.showToast('影犬被击破 · 护甲回响', '#cbb1ff', 1.6);
    }

    onBossDefeated(boss) {
      if (!this.room) return;
      this.room.cleared = true;
      this.room.clearTimer = 0;
      this.dungeon.markCleared(this.floorData, this.room);
      this.runStats.bosses++;
      this.runStats.rooms++;

      // 层主倒下时，残余召唤物一并墨化。
      for (const e of this.enemies.slice()) {
        if (e !== boss && !e.dead) e.die({});
      }

      const last = this.floorIndex >= Ink.FLOOR_COUNT - 1;

      // 层主遗物：随机武器直接入手，避免玩家急着进传送门而错过。
      const weaponId = Ink.Weapons.randomForFloor(this.floor);
      const weapon = Ink.Weapons.get(weaponId);
      if (weapon && this.player) {
        this.player.equipWeapon(weaponId);
        this.ui.showToast('层主遗物 · 获得「' + weapon.name + '」', weapon.color, 3.0);
      }

      this.portal = {
        x: 480,
        y: 334,
        active: true,
        delay: 1.5,
        time: 0,
        label: last ? '归途' : '下一层'
      };
      this.audio.setScene('play');
      this.audio.sfx('portal');
      this.addShake(7, 0.5);
      FX.explosion(this, 480, 334, 90, PAL.gold);
      FX.ring(this, { x: 480, y: 334, r0: 10, r1: 160, life: 0.8, color: PAL.gold, width: 3 });
    }

    dropXp(x, y, value) {
      if (value <= 0) return;
      const n = value >= 18 ? 3 : value >= 7 ? 2 : 1;
      let left = value;
      for (let i = 0; i < n; i++) {
        const v = i === n - 1 ? left : value / n;
        left -= v;
        const pk = new Pickup(this, x + U.rand(-10, 10), y + U.rand(-8, 8), v, 'xp');
        this.pickups.push(pk);
      }
    }

    dropHeart(x, y, value = 8) {
      this.pickups.push(new Pickup(this, x + U.rand(-8, 8), y + U.rand(-8, 8), value, 'heart'));
    }

    dropCoin(x, y, value = 1) {
      if (value <= 0) return;
      const n = value >= 8 ? 4 : value >= 4 ? 3 : 2;
      let left = value;
      for (let i = 0; i < n; i++) {
        const v = i === n - 1 ? left : Math.max(1, Math.floor(value / n));
        left -= v;
        if (v <= 0) continue;
        this.pickups.push(new Pickup(this, x + U.rand(-12, 12), y + U.rand(-10, 10), v, 'coin'));
      }
    }

    // ── 绘制 ─────────────────────────────────────────────
    draw() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, 960, 600);

      if (this.state === 'title' || this.state === 'select') {
        this.ui.draw(ctx);
        if (this.transition) this.drawTransition(ctx);
        return;
      }

      if (this.room && this.floorData) {
        ctx.save();
        if (this.shakeTime > 0 && this.shake > 0) {
          const k = this.shakeTime / Math.max(0.001, this.shakeDur);
          ctx.translate(
            U.rand(-1, 1) * this.shake * k,
            U.rand(-1, 1) * this.shake * k
          );
        }
        this.drawWorld(ctx);
        ctx.restore();
      }

      this.ui.draw(ctx);
      if (this.transition) this.drawTransition(ctx);
    }

    drawWorld(ctx) {
      const room = this.room;
      const theme = this.floorData.theme;

      // 背景（含地板、墙、符文、门口地面提示）
      const bg = Ink.Art.buildRoomBackground(room, this.floorIndex);
      if (bg) ctx.drawImage(bg, 0, 0);

      // 门与火把
      for (const d of room.doors) {
        Ink.Art.drawDoor(ctx, d.side, d.open, this.time, theme);
      }
      if (room.torches) {
        for (const t of room.torches) Ink.Art.drawTorch(ctx, t, this.time, theme);
      }

      // 地面层：传送门 / 领域 / 掉落物
      this.drawPortal(ctx);
      for (const fx of this.effects) {
        if (!fx.dead && fx instanceof Ink.Field) fx.draw(ctx, this);
      }
      for (const pk of this.pickups) {
        if (!pk.dead) pk.draw(ctx, this);
      }

      // 实体按 y 排序，制造前后遮挡
      const ents = [];
      for (const o of this.obstacles) {
        if (o.broken) continue;
        ents.push({
          y: o.y, radius: o.r,
          draw: (c) => Ink.Art.drawObstacle(c, o, this.time, theme)
        });
      }
      if (this.player && !this.player.dead) ents.push(this.player);
      if (this.dog) ents.push(this.dog);
      for (const e of this.enemies) if (!e.dead) ents.push(e);
      ents.sort((a, b) => (a.y - b.y) || ((a.radius || 0) - (b.radius || 0)));
      for (const ent of ents) ent.draw(ctx, this);

      // 投射物
      for (const pr of this.projectiles) {
        if (!pr.dead) pr.draw(ctx, this);
      }

      // 粒子与其余特效（斩击、文字、光束、鬼影等）
      for (const particle of FX.particles) {
        if (!particle.dead) particle.draw(ctx);
      }
      for (const fx of this.effects) {
        if (fx.dead || fx instanceof Ink.Field) continue;
        fx.draw(ctx, this);
      }

      this.drawReticle(ctx);
    }

    drawPortal(ctx) {
      const portal = this.portal;
      if (!portal) return;
      const t = portal.time;
      const active = portal.active;
      const color = this.floorIndex >= Ink.FLOOR_COUNT - 1 ? PAL.gold : PAL.violet;
      const pulse = 0.7 + Math.sin(t * 3) * 0.15;
      const r = 40 + Math.sin(t * 2.5) * 3;

      ctx.save();
      ctx.translate(portal.x, portal.y);
      ctx.globalAlpha = active ? 0.9 : 0.45;

      // 外圈墨环
      ctx.strokeStyle = U.rgba(color, 0.55);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(0, 0, r + 8, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // 内圈光晕
      const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
      grd.addColorStop(0, U.rgba(color, 0.5 * pulse));
      grd.addColorStop(0.5, U.rgba(color, 0.22));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.fill();

      // 旋转符文
      ctx.rotate(t * 0.7);
      ctx.strokeStyle = U.rgba(PAL.parchment, 0.65);
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5), 2.5, 0, U.TAU);
        ctx.stroke();
      }
      ctx.rotate(-t * 0.7);

      // 中心墨滴
      ctx.fillStyle = U.rgba(PAL.ink, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 2, 13, 7, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = U.rgba(color, 0.8);
      ctx.fillRect(-2, -2, 4, 4);

      ctx.restore();

      // 文字标签
      ctx.save();
      ctx.globalAlpha = active ? 0.95 : 0.5;
      ctx.fillStyle = color;
      ctx.font = 'bold 13px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(portal.label || '下层', portal.x, portal.y - 58);
      ctx.restore();
    }

    drawReticle(ctx) {
      if (this.state !== 'playing' || this.touchMode) return;
      const m = this.input.mouse;
      if (!m.inside) return;
      const color = this.player ? this.player.def.accent : PAL.gold;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, U.TAU);
      ctx.moveTo(-10, 0); ctx.lineTo(-5, 0);
      ctx.moveTo(5, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, -5);
      ctx.moveTo(0, 5); ctx.lineTo(0, 10);
      ctx.stroke();
      ctx.restore();
    }

    drawTransition(ctx) {
      const tr = this.transition;
      if (!tr) return;
      const a = tr.t < tr.half
        ? tr.t / Math.max(0.001, tr.half)
        : (tr.duration - tr.t) / Math.max(0.001, tr.half);
      ctx.save();
      ctx.globalAlpha = U.clamp(a, 0, 1);
      ctx.fillStyle = '#040308';
      ctx.fillRect(0, 0, 960, 600);
      ctx.restore();
    }

    showVictory() {
      if (this.state === 'victory') return;
      this.state = 'victory';
      this.runStats.floor = Ink.FLOOR_COUNT;
      this.audio.setScene('title');
      this.audio.sfx('victory');
      this.touchMove = { x: 0, y: 0 };
      this.skillRequest = false;
    }
  }

  Ink.Game = Game;
})();
