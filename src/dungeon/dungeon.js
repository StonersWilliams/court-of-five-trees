/**
 * src/dungeon/dungeon.js
 * ------------------------------------------------------------
 * 程序化地牢：3 层，每层 3 关 + 1 间商店。
 *
 * 布局：
 *   一进（普通关） → 二进（精英关） → 庭主（Boss）
 *                         └────────→ 行商（商店支线）
 *
 * 规则：
 *   - 每层第 1、2 关清怪后开门；第 2 关清完给一次机制被动三选一；
 *   - 第 3 关固定 Boss；Boss 房踏入即封门，只能走胜利传送门；
 *   - 每层从指定的三名庭主中随机一位；
 *   - 房间生成障碍物（树/柱/木箱/石头），Boss 房固定五棵庭树。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  const FLOOR_COUNT = 3;

  const BOSS_POOLS = [
    ['truffle', 'sunstar', 'ninesun'],
    ['peach', 'oga', 'june'],
    ['tower', 'bigmon', 'edo']
  ];

  const ENEMY_POOLS = [
    ['slime', 'skull', 'spider'],
    ['skull', 'spider', 'guard', 'gargoyle', 'tome'],
    ['gargoyle', 'tome', 'guard', 'spider', 'skull']
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
      for (let i = 0; i < FLOOR_COUNT; i++) {
        this.floors.push(this.generateFloor(i));
      }
    }

    generateFloor(floorIndex) {
      const rng = this.rng;
      const floorNumber = floorIndex + 1;
      const theme = Ink.Art.THEMES[floorIndex];
      const bossId = rng.pick(BOSS_POOLS[floorIndex]);
      const bossConf = (Ink.Bosses && Ink.Bosses[bossId]) || null;
      const shopY = rng.chance(0.5) ? 0 : 2;

      const rooms = [];
      const stage1 = this._makeRoom(floorIndex, rooms.length, 'battle', 0, 1, 1, rng);
      rooms.push(stage1);
      const stage2 = this._makeRoom(floorIndex, rooms.length, 'elite', 1, 1, 2, rng);
      rooms.push(stage2);
      const bossRoom = this._makeRoom(floorIndex, rooms.length, 'boss', 2, 1, 3, rng);
      bossRoom.name = (bossConf && bossConf.roomName) || rng.pick(BOSS_ROOM_FALLBACK);
      rooms.push(bossRoom);
      const shop = this._makeRoom(floorIndex, rooms.length, 'shop', 1, shopY, 0, rng);
      shop.name = rng.pick(SHOP_NAMES);
      rooms.push(shop);

      stage1.visited = true;
      stage1.cleared = false;
      shop.cleared = true;
      shop.visited = false;

      this._connect(stage1, stage2);
      this._connect(stage2, bossRoom);
      this._connect(stage2, shop);

      const floor = {
        index: floorIndex,
        number: floorNumber,
        theme,
        themeIndex: floorIndex,
        name: theme.name,
        sub: theme.sub || '',
        rooms,
        startRoomId: stage1.id,
        bossRoomId: bossRoom.id,
        shopRoomId: shop.id,
        spineIds: [stage1.id, stage2.id, bossRoom.id],
        bossId,
        bossUnlocked: false,
        passiveOffered: false,
        mapW: 3,
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

    _makeRoom(floorIndex, index, type, mapX, mapY, stage, rng) {
      const id = 'f' + (floorIndex + 1) + 'r' + index;
      let name;
      if (type === 'battle') name = rng.pick(ROOM_NAMES[floorIndex][0]);
      else if (type === 'elite') name = rng.pick(ROOM_NAMES[floorIndex][1]);
      else if (type === 'boss') name = rng.pick(BOSS_ROOM_FALLBACK);
      else if (type === 'shop') name = rng.pick(SHOP_NAMES);
      else name = '无名庭';

      return {
        id, floorIndex, index, type, name, stage,
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
      if (room.type === 'boss' || room.type === 'shop') return [];
      const eliteRoom = room.type === 'elite';
      const base = (room.stage === 2 ? 4 : 3) + floorIndex + rng.int(0, 1);
      const normalCount = Math.max(2, base - (eliteRoom ? 1 : 0));
      const count = normalCount + (eliteRoom ? 1 : 0);
      const pool = ENEMY_POOLS[Math.min(ENEMY_POOLS.length - 1, floorIndex)];
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
      const hp = destructible ? 22 : 1;
      return {
        type, x, y, variant: variant || 0, r: r || 16,
        destructible, hp, maxHp: hp, broken: false
      };
    }

    _buildObstacles(room, floorIndex, rng) {
      if (room.type === 'boss') {
        // 五棵树：五个位置、五种形态，对应“庭有五棵树”
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
