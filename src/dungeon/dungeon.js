/**
 * src/dungeon/dungeon.js
 * ------------------------------------------------------------
 * 程序化地牢：九层，每层七关 + 行商 / 随机事件。
 *
 * 布局（每层）：
 *   1 普通 → 2 普通 → 3 精英 → 4 普通 → 5 事件 → 6 普通 → 7 庭主
 *                         └──────────────→ 行商（商店支线）
 *
 * 规则：
 *   - 第 2、4、6 关清完各给一次机制被动三选一；
 *   - 第 5 关是随机事件房，处理完事件才会开门；
 *   - 第 7 关固定庭主；Boss 房踏入即封门，只能走胜利传送门；
 *   - 九层依次对应九位庭主，强度随层数继续上升；
 *   - 房间生成障碍物（树/柱/木箱/石头），Boss 房固定五棵庭树。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  const FLOOR_COUNT = 5;

  // 前三层九庭主轮值，第四层外庭三客，第五层固定创世者。
  const BOSS_POOLS = [
    ['truffle', 'sunstar', 'ninesun'],
    ['peach', 'oga', 'june'],
    ['tower', 'bigmon', 'edo'],
    ['buzz', 'liu', 'yuenu'],
    ['creator']
  ];

  const FLOOR_NAMES = [
    { name: '入门庭', sub: '墨与火' },
    { name: '中庭', sub: '封与雨' },
    { name: '深庭', sub: '锁与声' },
    { name: '外庭', sub: '客与技' },
    { name: '目录之外', sub: '创世者' }
  ];

  // 每层的地图骨架。节点坐标只影响小地图与通道走向；关卡顺序仍固定。
  const LAYOUTS = [
    {
      id: 'spine', name: '直脊',
      prep: [0, 1], stage1: [1, 1], stage2: [2, 1], stage3: [3, 1], stage4: [4, 1],
      event: [5, 1], stage6: [6, 1], boss: [7, 1], shop: [3, 0], sideA: [2, 0], sideB: [4, 2]
    },
    {
      id: 'serpent', name: '回蛇',
      prep: [0, 1], stage1: [1, 1], stage2: [2, 1], stage3: [2, 0], stage4: [3, 0],
      event: [4, 1], stage6: [5, 2], boss: [6, 2], shop: [3, 1], sideA: [1, 0], sideB: [4, 2]
    },
    {
      id: 'fork', name: '双岔',
      prep: [0, 1], stage1: [1, 1], stage2: [2, 1], stage3: [3, 0], stage4: [3, 2],
      event: [4, 1], stage6: [5, 1], boss: [6, 1], shop: [2, 0], sideA: [1, 0], sideB: [5, 2]
    },
    {
      id: 'spiral', name: '盘阶',
      prep: [0, 1], stage1: [1, 1], stage2: [2, 0], stage3: [3, 0], stage4: [4, 0],
      event: [4, 1], stage6: [5, 2], boss: [6, 2], shop: [3, 1], sideA: [1, 0], sideB: [5, 1]
    }
  ];

  const ENEMY_POOLS = [
    ['slime', 'skull', 'spider'],
    ['skull', 'spider', 'moth', 'guard'],
    ['guard', 'gargoyle', 'tome', 'rat'],
    ['gargoyle', 'tome', 'moth', 'bell'],
    ['tome', 'gargoyle', 'spider', 'bell'],
    ['guard', 'tome', 'moth', 'rat'],
    ['gargoyle', 'guard', 'bell', 'spider'],
    ['tome', 'gargoyle', 'guard', 'bell', 'moth'],
    ['all']
  ];

  const ROOM_NAMES = [
    [
      ['苔痕前庭', '石灯小径', '菌毯回廊', '落针坪'],
      ['盘根中庭', '青苔祭台', '断碑廊', '树影深处']
    ],
    [
      ['霜枝前庭', '冻土回廊', '断钟小径', '白雾阶'],
      ['冰裂纹庭', '霜钟祭台', '风穴', '雪压枝头']
    ],
    [
      ['赤花前庭', '缠根廊', '落瓣小径', '花蜜窖'],
      ['荆棘中庭', '花傀祭台', '腐花深处', '赤柱环']
    ]
  ];

  const SHOP_NAMES = ['木匣行商', '纸灯货郎', '无主摊位'];
  const BOSS_ROOM_FALLBACK = ['五树庭'];
  const EVENT_NAMES = {
    inkwell: '夹页书房',
    rain: '雨中回廊',
    chair: '未编号的教室',
    manuscript: '废稿堆',
    tea: '庭外茶摊',
    bell: '无风钟楼',
    practice: '旧帖研习室'
  };
  const EVENT_POOL = ['inkwell', 'rain', 'chair', 'manuscript', 'tea', 'bell', 'practice'];

  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    const next = function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    next.int = (a, b) => a + Math.floor(next() * (b - a + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  }

  function sideBetween(a, b) {
    const dx = b.mapX - a.mapX;
    const dy = b.mapY - a.mapY;
    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy > 0) return 'bottom';
    return 'top';
  }

  class Dungeon {
    constructor(seed = Date.now()) {
      this.seed = seed >>> 0;
      this.rng = makeRng(this.seed);
      this.floors = [];
      // 每层的节点排布从四套骨架里轮换，避免九层地图全是一条直线。
      this.layoutOrder = U.shuffle([0, 1, 2, 3]);
      for (let i = 0; i < FLOOR_COUNT; i++) {
        this.floors.push(this.generateFloor(i));
      }
      // 终局「第十席」需要五份残稿：先为每层随机非残稿事件，
      // 再随机抽五层改成「废稿堆」，确保总数恰好为 5。
      const nonManuscript = EVENT_POOL.filter((id) => id !== 'manuscript');
      for (const floor of this.floors) {
        const ev = floor.rooms.find((r) => r.type === 'event');
        if (!ev) continue;
        ev.eventId = U.pick(nonManuscript);
        ev.name = EVENT_NAMES[ev.eventId];
      }
      // 五层里留两个“废稿堆”事件；其余残稿从庭主掉落与跨局收藏补足。
      const manuscriptFloors = U.shuffle(this.floors.map((_, i) => i)).slice(0, 2);
      for (const i of manuscriptFloors) {
        const floor = this.floors[i];
        const ev = floor.rooms.find((r) => r.type === 'event');
        if (!ev) continue;
        ev.eventId = 'manuscript';
        ev.name = EVENT_NAMES.manuscript;
      }
    }

    generateFloor(floorIndex) {
      const rng = this.rng;
      const floorNumber = floorIndex + 1;
      const theme = Ink.Art.THEMES[floorIndex % Ink.Art.THEMES.length];
      const bossId = rng.pick(BOSS_POOLS[floorIndex]);
      const bossConf = (Ink.Bosses && Ink.Bosses[bossId]) || null;
      // 第五层没有走廊：推开门就是巨书战场。
      if (floorIndex === FLOOR_COUNT - 1) {
        return this._generateFinalFloor(floorIndex, floorNumber, theme, bossId, bossConf);
      }
      const shopY = rng.chance(0.5) ? 0 : 2;

      const rooms = [];
      // 第二庭起，普通关卡有概率变成精英房，让每层跑图不是完全固定。
      const encounter = () => (floorIndex >= 1 && rng.chance(0.16) ? 'elite' : 'battle');

      // 每层入口先进入“准备房”：不刷怪，先整备再推门。
      const prep = this._makeRoom(floorIndex, rooms.length, 'prep', 0, 1, 0, rng);
      prep.name = '入庭准备';
      prep.cleared = true;
      prep.visited = true;
      prep.prepared = false;
      rooms.push(prep);

      const stage1 = this._makeRoom(floorIndex, rooms.length, encounter(), 1, 1, 1, rng);
      rooms.push(stage1);
      const stage2 = this._makeRoom(floorIndex, rooms.length, encounter(), 2, 1, 2, rng);
      rooms.push(stage2);
      const stage3 = this._makeRoom(floorIndex, rooms.length, 'elite', 3, 1, 3, rng);
      rooms.push(stage3);
      const stage4 = this._makeRoom(floorIndex, rooms.length, encounter(), 4, 1, 4, rng);
      rooms.push(stage4);
      const eventRoom = this._makeRoom(floorIndex, rooms.length, 'event', 5, 1, 5, rng);
      eventRoom.eventId = rng.pick(EVENT_POOL);
      eventRoom.name = EVENT_NAMES[eventRoom.eventId];
      eventRoom.eventElite = rng.chance(0.58);
      eventRoom.eventOpened = false;
      rooms.push(eventRoom);
      const stage6 = this._makeRoom(floorIndex, rooms.length, encounter(), 6, 1, 6, rng);
      rooms.push(stage6);
      const bossRoom = this._makeRoom(floorIndex, rooms.length, 'boss', 7, 1, 7, rng);
      bossRoom.name = (bossConf && bossConf.roomName) || rng.pick(BOSS_ROOM_FALLBACK);
      rooms.push(bossRoom);
      const shop = this._makeRoom(floorIndex, rooms.length, 'shop', 3, shopY, 0, rng);
      shop.name = rng.pick(SHOP_NAMES);
      rooms.push(shop);

      // 两条可选侧庭：一条从第 2 关上楼，一条从第 4 关下楼。
      // 它们不在主线 spine 上，不清也能打庭主，但会提供额外精英/补给。
      const sideA = this._makeRoom(floorIndex, rooms.length, rng.chance(0.55) ? 'elite' : 'battle', 2, 0, 0, rng);
      sideA.name = '侧庭 · ' + rng.pick(['上层回廊', '悬木夹道', '无灯偏厅']);
      sideA.branch = true;
      rooms.push(sideA);
      const sideB = this._makeRoom(floorIndex, rooms.length, rng.chance(0.6) ? 'elite' : 'battle', 4, 2, 0, rng);
      sideB.name = '侧庭 · ' + rng.pick(['下层石室', '落雨偏院', '旧井暗道']);
      sideB.branch = true;
      rooms.push(sideB);

      // 套用本层骨架坐标：四套轮换，九层不会全是一条直脊。
      const layout = LAYOUTS[this.layoutOrder[floorIndex % this.layoutOrder.length]];
      const anchors = { prep, stage1, stage2, stage3, stage4, event: eventRoom, stage6, boss: bossRoom, shop, sideA, sideB };
      for (const key of Object.keys(anchors)) {
        const pos = layout[key];
        if (!pos) continue;
        anchors[key].mapX = pos[0];
        anchors[key].mapY = pos[1];
      }
      // 后四层镜像，末层再上下翻转，九层不会出现完全相同的地图骨架。
      const cycle = Math.floor(floorIndex / LAYOUTS.length);
      if (cycle % 2 === 1) {
        for (const key of Object.keys(anchors)) anchors[key].mapX = 7 - anchors[key].mapX;
      }
      if (floorIndex === FLOOR_COUNT - 1) {
        for (const key of Object.keys(anchors)) anchors[key].mapY = 2 - anchors[key].mapY;
      }

      stage1.visited = false;
      stage1.cleared = false;
      eventRoom.cleared = false;
      shop.cleared = true;
      shop.visited = false;

      this._connect(prep, stage1);
      this._connect(stage1, stage2);
      this._connect(stage2, stage3);
      this._connect(stage3, stage4);
      this._connect(stage4, eventRoom);
      this._connect(eventRoom, stage6);
      this._connect(stage6, bossRoom);
      this._connect(stage3, shop);
      this._connect(stage2, sideA);
      this._connect(stage4, sideB);

      const floor = {
        index: floorIndex,
        number: floorNumber,
        theme,
        themeIndex: floorIndex % Ink.Art.THEMES.length,
        name: '第' + floorNumber + '庭 · ' + FLOOR_NAMES[floorIndex].name + ' · ' + FLOOR_NAMES[floorIndex].sub,
        sub: FLOOR_NAMES[floorIndex].sub,
        rooms,
        startRoomId: prep.id,
        prepRoomId: prep.id,
        bossRoomId: bossRoom.id,
        shopRoomId: shop.id,
        eventRoomId: eventRoom.id,
        branchRoomIds: [sideA.id, sideB.id],
        spineIds: [stage1.id, stage2.id, stage3.id, stage4.id, eventRoom.id, stage6.id, bossRoom.id],
        bossId,
        layoutId: layout.id,
        layoutName: layout.name,
        bossUnlocked: false,
        passiveOffered2: false,
        passiveOffered4: false,
        passiveOffered6: false,
        mapW: 8,
        mapH: 3
      };

      for (const room of rooms) {
        room.floorIndex = floorIndex;
        room.spawnPlan = this._buildSpawnPlan(room, floorIndex, rng);
      }
      // Boss 房固定五棵庭树；其余房间随机障碍
      for (const room of rooms) {
        room.obstacles = this._buildObstacles(room, floorIndex, rng);
      }

      bossRoom.visited = false;
      this.refresh(floor);
      return floor;
    }

    /** 第五层：准备房 + 巨书战场，没有商店、侧庭与事件。 */
    _generateFinalFloor(floorIndex, floorNumber, theme, bossId, bossConf) {
      const rng = this.rng;
      const rooms = [];
      const prep = this._makeRoom(floorIndex, 0, 'prep', 0, 1, 0, rng);
      prep.name = '最后一页之前';
      prep.cleared = true;
      prep.visited = true;
      prep.prepared = false;
      rooms.push(prep);
      const boss = this._makeRoom(floorIndex, 1, 'boss', 1, 1, 7, rng);
      boss.name = (bossConf && bossConf.roomName) || '目录之外';
      rooms.push(boss);
      this._connect(prep, boss);
      const floor = {
        index: floorIndex,
        number: floorNumber,
        theme,
        themeIndex: floorIndex % Ink.Art.THEMES.length,
        name: '第' + floorNumber + '庭 · 目录之外',
        sub: '创世者',
        rooms,
        startRoomId: prep.id,
        prepRoomId: prep.id,
        bossRoomId: boss.id,
        shopRoomId: null,
        eventRoomId: null,
        branchRoomIds: [],
        spineIds: [boss.id],
        bossId,
        layoutId: 'finale',
        layoutName: '巨书',
        bossUnlocked: true,
        passiveOffered2: false,
        passiveOffered4: false,
        passiveOffered6: false,
        mapW: 2,
        mapH: 3
      };
      for (const room of rooms) {
        room.floorIndex = floorIndex;
        room.spawnPlan = this._buildSpawnPlan(room, floorIndex, rng);
        room.obstacles = this._buildObstacles(room, floorIndex, rng);
      }
      this.refresh(floor);
      return floor;
    }

    _makeRoom(floorIndex, index, type, mapX, mapY, stage, rng) {
      const id = 'f' + (floorIndex + 1) + 'r' + index;
      let name;
      const nameSet = ROOM_NAMES[floorIndex % ROOM_NAMES.length];
      if (type === 'battle') name = rng.pick(nameSet[0]);
      else if (type === 'elite') name = rng.pick(nameSet[1]);
      else if (type === 'boss') name = rng.pick(BOSS_ROOM_FALLBACK);
      else if (type === 'shop') name = rng.pick(SHOP_NAMES);
      else if (type === 'event') name = '奇遇';
      else name = '无名庭';

      const layout = type === 'boss' ? 'court'
        : type === 'shop' ? 'shop'
        : type === 'prep' ? 'prep'
        : rng.pick(['grove', 'archive', 'stream', 'court']);
      return {
        id, floorIndex, index, type, name, stage, layout,
        mapX, mapY,
        spine: type !== 'shop',
        branch: type === 'shop',
        cleared: false,
        visited: false,
        entered: false,
        doors: [],
        connections: [],
        spawnPlan: [],
        obstacles: [],
        seed: (floorIndex + 1) * 9973 + index * 131,
        bg: null,
        torches: []
      };
    }

    _connect(a, b) {
      if (a.connections.includes(b.id)) return;
      a.connections.push(b.id);
      b.connections.push(a.id);
    }

    /** 根据坐标计算所有门，并刷新“已开门”状态。 */
    refresh(floor) {
      const byId = {};
      for (const r of floor.rooms) byId[r.id] = r;

      for (const r of floor.rooms) {
        r.doors = [];
        for (const targetId of r.connections) {
          const target = byId[targetId];
          if (!target) continue;
          r.doors.push({ side: sideBetween(r, target), targetId, open: false });
        }
      }

      const required = floor.spineIds.filter((id) => {
        const r = byId[id];
        return r && r.type !== 'boss';
      });
      floor.bossUnlocked = required.every((id) => byId[id] && byId[id].cleared);

      for (const r of floor.rooms) {
        for (const d of r.doors) {
          const target = byId[d.targetId];
          // Boss 房一旦踏入就封门，只能走胜利传送门
          d.open = r.type !== 'boss' && r.cleared &&
            (target.type !== 'boss' || floor.bossUnlocked);
        }
      }
      return floor;
    }

    markCleared(floor, room) {
      if (!room || room.cleared) {
        if (floor) this.refresh(floor);
        return;
      }
      room.cleared = true;
      this.refresh(floor);
    }

    getRoom(floor, id) {
      return floor.rooms.find((r) => r.id === id) || null;
    }

    /** 统计该层已探索 / 已清理房间数。 */
    roomStats(floor) {
      const total = floor.rooms.length;
      let cleared = 0;
      let visited = 0;
      for (const r of floor.rooms) {
        if (r.cleared) cleared++;
        if (r.visited) visited++;
      }
      return { total, cleared, visited };
    }

    // ── 敌人生成计划 ──────────────────────────────────────
    _buildSpawnPlan(room, floorIndex, rng) {
      room.waves = 1;
      if (room.type === 'boss' || room.type === 'shop' || room.type === 'prep') return [];
      if (room.type === 'event') {
        // 奇遇房可能由一只守室精英（小 Boss）把门，清掉后才出现事件选项。
        if (!room.eventElite) return [];
        const A = Ink.ARENA;
        let ep = ENEMY_POOLS[Math.min(ENEMY_POOLS.length - 1, floorIndex)];
        if (ep.length === 1 && ep[0] === 'all') ep = ['slime', 'skull', 'gargoyle', 'spider', 'tome', 'guard', 'moth', 'bell', 'rat'];
        const plan = [{
          type: rng.pick(ep),
          elite: true,
          x: A.x + A.w / 2 + rng.int(-90, 90),
          y: A.y + A.h / 2 + rng.int(-50, 50)
        }];
        for (let i = 0; i < 1 + Math.floor(floorIndex / 3); i++) {
          plan.push({
            type: rng.pick(['skull', 'spider', 'slime']),
            elite: false,
            x: A.x + 110 + rng() * (A.w - 220),
            y: A.y + 100 + rng() * (A.h - 200)
          });
        }
        return plan;
      }
      const eliteRoom = room.type === 'elite';
      // 九层逐层加量；第 3 关精英、第 6 关是庭主前最后一战，更密。
      const base = 5 + floorIndex * 2 + rng.int(0, 2) +
        (room.stage === 3 ? 2 : 0) + (room.stage === 6 ? 3 : 0);
      const normalCount = Math.max(3, base - (eliteRoom ? 1 : 0));
      const count = Math.min(24, normalCount + (eliteRoom ? 1 : 0));
      // 后半程和精英关更容易分两波：先清一波，门仍锁着，第二波从墨里爬出。
      const waveChance = floorIndex >= 5 ? 0.95 : floorIndex >= 2 ? 0.65 : 0.35;
      room.waves = (room.stage >= 5 || eliteRoom || floorIndex >= 5) && rng.chance(waveChance) ? 2 : 1;
      let pool = ENEMY_POOLS[Math.min(ENEMY_POOLS.length - 1, floorIndex)];
      if (pool.length === 1 && pool[0] === 'all') {
        pool = ['slime', 'skull', 'gargoyle', 'spider', 'tome', 'guard', 'moth', 'bell', 'rat'];
      }
      const A = Ink.ARENA;
      const plan = [];
      const doorPts = Object.values(Ink.DOOR_POINTS);

      for (let i = 0; i < count; i++) {
        let x = A.x + A.w / 2;
        let y = A.y + A.h / 2;
        let tries = 0;
        while (tries++ < 50) {
          x = A.x + 84 + rng() * (A.w - 168);
          y = A.y + 80 + rng() * (A.h - 160);
          if (U.dist(x, y, A.x + A.w / 2, A.y + A.h / 2 + 40) < 145) continue;
          let nearDoor = false;
          for (const dp of doorPts) {
            if (U.dist(x, y, dp.x, dp.y) < 108) { nearDoor = true; break; }
          }
          if (nearDoor) continue;
          break;
        }
        plan.push({
          type: rng.pick(pool),
          elite: eliteRoom && i === 0,
          x, y
        });
      }
      return plan;
    }

    // ── 障碍物 ──────────────────────────────────────────
    _obstacle(type, x, y, variant, r) {
      const destructible = type === 'crate';
      const trap = type === 'spike' || type === 'flame' || type === 'arrow';
      const hp = destructible ? 22 : 1;
      return {
        type, x, y, variant: variant || 0, r: r || 16,
        destructible, hp, maxHp: hp, broken: false, trap
      };
    }

    _buildObstacles(room, floorIndex, rng) {
      if (room.type === 'boss') {
        // 五棵树：五个位置、五种形态，对应“庭中有奇树”
        return [
          this._obstacle('tree', 186, 186, 0, 22),
          this._obstacle('tree', 774, 186, 1, 22),
          this._obstacle('tree', 170, 476, 2, 22),
          this._obstacle('tree', 790, 476, 3, 22),
          this._obstacle('tree', 480, 520, 4, 20)
        ];
      }
      if (room.type === 'shop') {
        return [
          this._obstacle('crate', 160, 180, 0, 14),
          this._obstacle('crate', 800, 470, 1, 14)
        ];
      }
      if (room.type === 'event') {
        // 事件房留出中央空场，只在两侧放一点叙事道具。
        return [
          this._obstacle('stone', 250, 220, 0, 15),
          this._obstacle('crate', 760, 440, 1, 14)
        ];
      }
      if (room.type === 'prep') {
        // 准备房：两盏灯、两只箱，中央保持空旷。
        return [
          this._obstacle('pillar', 210, 210, 0, 14),
          this._obstacle('pillar', 750, 210, 1, 14),
          this._obstacle('crate', 210, 470, 2, 13),
          this._obstacle('crate', 750, 470, 3, 13)
        ];
      }

      // 每层不仅换主题，也换房间骨架：树庭 / 书库 / 水廊 / 四角庭。
      const layouts = {
        grove: () => [
          this._obstacle('tree', 220, 200, 0, 20), this._obstacle('tree', 390, 170, 1, 20),
          this._obstacle('tree', 580, 180, 2, 20), this._obstacle('tree', 740, 220, 3, 20),
          this._obstacle('tree', 250, 470, 4, 20), this._obstacle('tree', 700, 480, 0, 20),
          this._obstacle('flame', 480, 330, 0, 16)
        ],
        archive: () => [
          this._obstacle('crate', 200, 220, 0, 14), this._obstacle('crate', 200, 330, 1, 14),
          this._obstacle('crate', 760, 240, 2, 14), this._obstacle('crate', 760, 380, 3, 14),
          this._obstacle('pillar', 420, 180, 0, 15), this._obstacle('pillar', 540, 490, 1, 15),
          this._obstacle('arrow', 480, 330, 0, 16)
        ],
        stream: () => [
          this._obstacle('stone', 220, 330, 0, 15), this._obstacle('stone', 340, 280, 1, 14),
          this._obstacle('stone', 460, 340, 2, 13), this._obstacle('stone', 580, 280, 3, 14),
          this._obstacle('stone', 700, 340, 4, 15), this._obstacle('pillar', 480, 480, 0, 16),
          this._obstacle('flame', 480, 400, 0, 16)
        ],
        court: () => [
          this._obstacle('tree', 210, 210, 0, 20), this._obstacle('tree', 750, 210, 1, 20),
          this._obstacle('tree', 210, 470, 2, 20), this._obstacle('tree', 750, 470, 3, 20),
          this._obstacle('pillar', 480, 200, 0, 15), this._obstacle('stone', 480, 480, 1, 14),
          this._obstacle('arrow', 480, 330, 0, 16)
        ]
      };
      if (layouts[room.layout]) return layouts[room.layout]();

      const A = Ink.ARENA;
      const count = 2 + floorIndex + rng.int(0, 2);
      const out = [];
      const doorPts = Object.values(Ink.DOOR_POINTS);
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0, ok = false;
        for (let tries = 0; tries < 40; tries++) {
          x = A.x + 110 + rng() * (A.w - 220);
          y = A.y + 100 + rng() * (A.h - 200);
          if (U.dist(x, y, A.x + A.w / 2, A.y + A.h / 2 + 40) < 120) continue;
          let nearDoor = false;
          for (const dp of doorPts) {
            if (U.dist(x, y, dp.x, dp.y) < 120) { nearDoor = true; break; }
          }
          if (nearDoor) continue;
          let nearSpawn = false;
          for (const s of room.spawnPlan) {
            if (U.dist(x, y, s.x, s.y) < 52) { nearSpawn = true; break; }
          }
          if (nearSpawn) continue;
          ok = true;
          break;
        }
        if (!ok) continue;
        const roll = rng();
        const type = roll < 0.5 ? 'tree' : roll < 0.72 ? 'pillar' : roll < 0.9 ? 'crate' : 'stone';
        out.push(this._obstacle(type, x, y, rng.int(0, 4), type === 'tree' ? 19 : type === 'pillar' ? 15 : 13));
      }
      if (rng.chance(0.35)) {
        out.push(this._obstacle(rng.pick(['spike', 'flame', 'arrow']), 480, 330, 0, 16));
      }
      return out;
    }

    /** Boss 的展示名，给 UI / 过场用。 */
    bossName(floor) {
      const conf = Ink.Bosses && Ink.Bosses[floor.bossId];
      return conf ? conf.name : '未知庭主';
    }

    /** 下一层；第 3 层后返回 null。 */
    nextFloor(currentFloor) {
      return this.floors[currentFloor.index + 1] || null;
    }
  }

  Ink.Dungeon = Dungeon;
  Ink.FLOOR_COUNT = FLOOR_COUNT;
  Ink.BOSS_POOLS = BOSS_POOLS;
  // 旧代码兼容别名
  Ink.BOSS_ORDER = BOSS_POOLS[0];
})();
