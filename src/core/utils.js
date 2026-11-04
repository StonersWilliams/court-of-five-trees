/**
 * src/core/utils.js
 * 基础数学、随机数、几何与颜色工具。
 * 所有模块挂载在 window.Ink 命名空间下，无模块打包器依赖。
 */
(function () {
  'use strict';

  const Ink = window.Ink = window.Ink || {};

  const TAU = Math.PI * 2;

  const U = {
    TAU,

    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    invLerp(a, b, v) { return (v - a) / (b - a || 1); },
    smoothstep(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); },
    easeOutCubic(t) { return 1 - Math.pow(1 - U.clamp(t, 0, 1), 3); },
    easeInCubic(t) { return Math.pow(U.clamp(t, 0, 1), 3); },
    easeOutBack(t) {
      t = U.clamp(t, 0, 1);
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },

    rand(a = 1, b) {
      if (b === undefined) { b = a; a = 0; }
      return a + Math.random() * (b - a);
    },
    randInt(a, b) {
      if (b === undefined) { b = a; a = 0; }
      return Math.floor(a + Math.random() * (b - a + 1));
    },
    chance(p) { return Math.random() < p; },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** 按权重选取: items = [{weight, ...}] */
    weighted(items, weightKey = 'weight') {
      let total = 0;
      for (const it of items) total += it[weightKey] || 0;
      let r = Math.random() * total;
      for (const it of items) {
        r -= it[weightKey] || 0;
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },

    dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    dist(ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
    distTo(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
    angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); },
    normAngle(a) {
      while (a > Math.PI) a -= TAU;
      while (a < -Math.PI) a += TAU;
      return a;
    },
    angleDiff(a, b) { return U.normAngle(a - b); },
    vec(angle, length = 1) { return { x: Math.cos(angle) * length, y: Math.sin(angle) * length }; },
    lerpAngle(a, b, t) { return a + U.normAngle(b - a) * U.clamp(t, 0, 1); },

    pointInRect(px, py, r) { return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h; },
    pointInCircle(px, py, cx, cy, radius) { return U.dist2(px, py, cx, cy) <= radius * radius; },
    circleOverlap(ax, ay, ar, bx, by, br) {
      const r = ar + br;
      return U.dist2(ax, ay, bx, by) <= r * r;
    },
    /** 点到线段的最短距离 */
    pointSegDist(px, py, ax, ay, bx, by) {
      const abx = bx - ax, aby = by - ay;
      const len2 = abx * abx + aby * aby || 1;
      let t = ((px - ax) * abx + (py - ay) * aby) / len2;
      t = U.clamp(t, 0, 1);
      return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
    },
    /** 圆与矩形碰撞 */
    circleRect(cx, cy, cr, r) {
      const nx = U.clamp(cx, r.x, r.x + r.w);
      const ny = U.clamp(cy, r.y, r.y + r.h);
      return U.dist2(cx, cy, nx, ny) <= cr * cr;
    },

    /** 原地删除数组中满足条件的元素（倒序，效率好） */
    removeWhere(arr, fn) {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (fn(arr[i], i)) arr.splice(i, 1);
      }
    },
    /** 从数组中移除指定元素 */
    remove(arr, item) {
      const i = arr.indexOf(item);
      if (i >= 0) arr.splice(i, 1);
      return i >= 0;
    },

    /** 秒数格式化为 m:ss */
    time(seconds) {
      seconds = Math.max(0, Math.floor(seconds));
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },
    pct(v) { return `${Math.round(v * 100)}%`; },

    /** 确定性伪随机（用于房间装饰种子） */
    seeded(seed) {
      let s = (seed >>> 0) || 1;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },

    /** 颜色亮度调整，输入 #rrggbb */
    shade(hex, amount) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      if (amount >= 0) {
        r = Math.round(r + (255 - r) * amount);
        g = Math.round(g + (255 - g) * amount);
        b = Math.round(b + (255 - b) * amount);
      } else {
        const k = 1 + amount;
        r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
      }
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    rgba(hex, alpha) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
    },

    /** 屏幕坐标 -> 逻辑画布坐标，处理 CSS 缩放 */
    canvasPoint(canvas, clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left) * (canvas.width / Math.max(1, r.width)),
        y: (clientY - r.top) * (canvas.height / Math.max(1, r.height))
      };
    }
  };

  Ink.U = U;

  /** 全局色板：低饱和墨色 + 少量高亮，统一像素风。 */
  Ink.PAL = {
    void: '#07060c',
    ink: '#0d0b16',
    ink2: '#151222',
    ink3: '#211b34',
    slate: '#302844',
    slate2: '#453a60',
    muted: '#6d6388',
    parchment: '#efe4c8',
    parchment2: '#cfc09d',
    gold: '#e8c170',
    gold2: '#f7df9c',
    rust: '#c16a4a',
    blood: '#d94f5c',
    blood2: '#ff8a86',
    jade: '#74d6b1',
    jade2: '#a8f0d3',
    cyan: '#6cc7e8',
    violet: '#a681e8',
    violet2: '#cbb1ff',
    white: '#fff8e7',
    black: '#050509',
    // 角色主色
    qiyun: '#6ea8d8',
    xiaoying: '#c078e8',
    xinyue: '#f0a7bd',
    ziyu: '#e05a55',
    smartdog: '#e8a34e'
  };
})();
