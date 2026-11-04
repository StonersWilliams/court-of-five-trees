/**
 * src/core/input.js
 * ------------------------------------------------------------
 * 统一输入层：
 *   - 键盘：WASD / 方向键、空格、E、Esc、1-5、M、F
 *   - 鼠标：位置、左键持续攻击、右键技能
 *   - 指针：把触摸/鼠标事件压入队列，由 Game 决定摇杆、按钮与 UI 命中
 *
 * 所有坐标都转换成 960x600 的逻辑画布坐标，因此 CSS 缩放不影响操作。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  const PREVENT = new Set([
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab'
  ]);

  class InputManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pressed = new Set();
      this.released = new Set();
      this.events = [];
      this.mouse = { x: 480, y: 300, down: false, right: false, inside: false };
      this.touch = false;
      this.hasTouch = (navigator.maxTouchPoints || 0) > 0;
      this.pointers = new Map();
      this.lastInputWasTouch = false;
      this.onBlur = null;
      this.onFirstGesture = null;
      this._firstGestureFired = false;
      this._bind();
    }

    _bind() {
      const canvas = this.canvas;

      window.addEventListener('keydown', (e) => {
        if (PREVENT.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code);
        this.pressed.add(e.code);
        this._gesture(e);
      }, { passive: false });

      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
        this.released.add(e.code);
      });

      window.addEventListener('blur', () => {
        this.keys.clear();
        this.pointers.clear();
        this.mouse.down = false;
        this.mouse.right = false;
        if (this.onBlur) this.onBlur();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.keys.clear();
          this.pointers.clear();
          this.mouse.down = false;
          this.mouse.right = false;
          if (this.onBlur) this.onBlur();
        }
      });

      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
        if (e.pointerType === 'touch') {
          this.touch = true;
          this.hasTouch = true;
          this.lastInputWasTouch = true;
        }
        const p = this._point(e);
        this._gesture(e);
        this.pointers.set(e.pointerId, { x: p.x, y: p.y, pointerType: e.pointerType, button: e.button });
        if (e.pointerType === 'mouse') {
          if (e.button === 0) this.mouse.down = true;
          if (e.button === 2) this.mouse.right = true;
          this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
        }
        this.events.push({
          type: 'down',
          x: p.x, y: p.y,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          button: e.button,
          shift: e.shiftKey
        });
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }, { passive: false });

      canvas.addEventListener('pointermove', (e) => {
        const p = this._point(e);
        if (e.pointerType === 'mouse') {
          this.mouse.x = p.x;
          this.mouse.y = p.y;
          this.mouse.inside = true;
        }
        const ptr = this.pointers.get(e.pointerId);
        if (ptr) { ptr.x = p.x; ptr.y = p.y; }
        this.events.push({
          type: 'move',
          x: p.x, y: p.y,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          buttons: e.buttons
        });
      }, { passive: true });

      const endPointer = (e) => {
        const p = this._point(e);
        if (e.pointerType === 'mouse') {
          if (e.button === 0) this.mouse.down = false;
          if (e.button === 2) this.mouse.right = false;
        }
        this.pointers.delete(e.pointerId);
        this.events.push({
          type: e.type === 'pointercancel' ? 'cancel' : 'up',
          x: p.x, y: p.y,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          button: e.button
        });
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      canvas.addEventListener('pointerup', endPointer, { passive: true });
      canvas.addEventListener('pointercancel', endPointer, { passive: true });

      canvas.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') this.mouse.inside = false;
      });
    }

    _point(e) {
      return U.canvasPoint(this.canvas, e.clientX, e.clientY);
    }

    _gesture(e) {
      if (!this._firstGestureFired) {
        this._firstGestureFired = true;
        if (this.onFirstGesture) this.onFirstGesture(e);
      }
    }

    isDown(...codes) {
      for (const c of codes) if (this.keys.has(c)) return true;
      return false;
    }

    wasPressed(...codes) {
      for (const c of codes) if (this.pressed.has(c)) return true;
      return false;
    }

    /** 归一化键盘移动向量 */
    moveVector() {
      let x = 0, y = 0;
      if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
      if (this.isDown('KeyD', 'ArrowRight')) x += 1;
      if (this.isDown('KeyW', 'ArrowUp')) y -= 1;
      if (this.isDown('KeyS', 'ArrowDown')) y += 1;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    }

    /**
     * 取出本帧指针事件。Game 每帧调用一次；返回后队列清空。
     * 事件是普通对象，方便单元测试与录制回放。
     */
    drainEvents() {
      const out = this.events;
      this.events = [];
      return out;
    }

    /** 帧末清理“刚按下”状态。 */
    endFrame() {
      this.pressed.clear();
      this.released.clear();
    }

    /** 供“重新开始”时清理按住状态，避免开局继续开火。 */
    reset() {
      this.keys.clear();
      this.pressed.clear();
      this.released.clear();
      this.events.length = 0;
      this.pointers.clear();
      this.mouse.down = false;
      this.mouse.right = false;
    }
  }

  Ink.InputManager = InputManager;
})();
