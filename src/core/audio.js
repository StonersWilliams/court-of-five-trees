/**
 * src/core/audio.js
 * ------------------------------------------------------------
 * 所有音效由 WebAudio 实时合成，不加载任何音频文件：
 *   - 振荡器 + 包络 = 射击、技能、升级提示音；
 *   - 噪声缓冲 + 滤波器 = 打击、爆炸、Boss 咆哮；
 *   - 一个极简的生成式环境音乐循环（可静音）。
 *
 * 浏览器要求第一次用户手势后才能创建/恢复 AudioContext，
 * 因此 unlock() 在第一次按键或点击时调用。
 */
(function () {
  'use strict';

  const Ink = window.Ink;
  const U = Ink.U;

  class AudioSys {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.ready = false;
      this.muted = false;
      this.scene = 'title';
      this._noiseBuf = null;
      this._musicTimer = null;
      this._step = 0;
      this._lastShot = 0;
      this._lastHit = 0;
      this.volume = 0.34;
      try {
        this.muted = localStorage.getItem('inkbound.muted') === '1';
      } catch (_) { /* file:// 某些浏览器禁用 storage，忽略 */ }
    }

    unlock() {
      if (this.ready) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.26;
        this.musicGain.connect(this.master);
        this.ready = true;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this._startMusic();
      } catch (err) {
        console.warn('[audio] 初始化失败，将静音运行', err);
      }
    }

    setScene(scene) {
      this.scene = scene;
      if (this.ready) {
        const target = scene === 'boss' ? 0.36 : scene === 'play' ? 0.26 : 0.2;
        this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      try { localStorage.setItem('inkbound.muted', this.muted ? '1' : '0'); } catch (_) {}
      if (this.ready) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
      }
      return this.muted;
    }

    setVolume(v) {
      this.volume = U.clamp(v, 0, 1);
      if (this.ready) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }

    // ─────────────────────────────────────────────────────────
    //  基础合成单元
    // ─────────────────────────────────────────────────────────
    tone({ freq = 440, freq2 = null, dur = 0.12, type = 'square', vol = 0.15, delay = 0, attack = 0.005, music = false }) {
      if (!this.ready || this.muted) return null;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (freq2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(music ? this.musicGain : this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
      return { osc, gain };
    }

    noise({ dur = 0.18, vol = 0.2, freq = 800, q = 0.8, delay = 0, attack = 0.003, music = false }) {
      if (!this.ready || this.muted) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + delay;
      if (!this._noiseBuf) {
        const len = Math.floor(ctx.sampleRate * 1.2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noiseBuf = buf;
      }
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.4), t0 + dur);
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(music ? this.musicGain : this.sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    // ─────────────────────────────────────────────────────────
    //  游戏音效表
    // ─────────────────────────────────────────────────────────
    sfx(name) {
      if (!this.ready || this.muted) return;
      const now = this.ctx.currentTime;
      switch (name) {
        case 'shoot':
          if (now - this._lastShot < 0.035) return;
          this._lastShot = now;
          this.tone({ freq: 640, freq2: 260, dur: 0.07, type: 'square', vol: 0.055 });
          this.noise({ dur: 0.035, vol: 0.025, freq: 2400, q: 1.2 });
          break;
        case 'shootInk':
          if (now - this._lastShot < 0.045) return;
          this._lastShot = now;
          this.tone({ freq: 320, freq2: 150, dur: 0.1, type: 'sawtooth', vol: 0.045 });
          this.noise({ dur: 0.06, vol: 0.03, freq: 900, q: 1 });
          break;
        case 'slash':
          this.noise({ dur: 0.1, vol: 0.1, freq: 3200, q: 2.5 });
          this.tone({ freq: 900, freq2: 1400, dur: 0.05, type: 'triangle', vol: 0.03 });
          break;
        case 'hit':
          if (now - this._lastHit < 0.025) return;
          this._lastHit = now;
          this.noise({ dur: 0.06, vol: 0.11, freq: 1200, q: 1 });
          this.tone({ freq: 180, freq2: 90, dur: 0.06, type: 'square', vol: 0.045 });
          break;
        case 'crit':
          this.noise({ dur: 0.08, vol: 0.14, freq: 1800, q: 1.2 });
          this.tone({ freq: 380, freq2: 120, dur: 0.12, type: 'sawtooth', vol: 0.06 });
          break;
        case 'kill':
          this.tone({ freq: 240, freq2: 70, dur: 0.18, type: 'triangle', vol: 0.07 });
          this.noise({ dur: 0.16, vol: 0.08, freq: 600, q: 0.7 });
          break;
        case 'hurt':
          this.tone({ freq: 160, freq2: 55, dur: 0.22, type: 'sawtooth', vol: 0.11 });
          this.noise({ dur: 0.18, vol: 0.12, freq: 400, q: 0.6 });
          break;
        case 'armor':
          this.tone({ freq: 880, freq2: 1320, dur: 0.08, type: 'triangle', vol: 0.045 });
          break;
        case 'dash':
          this.noise({ dur: 0.18, vol: 0.1, freq: 1800, q: 0.9 });
          this.tone({ freq: 420, freq2: 1100, dur: 0.12, type: 'sine', vol: 0.045 });
          break;
        case 'skill':
          this.tone({ freq: 220, freq2: 880, dur: 0.3, type: 'triangle', vol: 0.08 });
          this.tone({ freq: 330, freq2: 1320, dur: 0.24, type: 'sine', vol: 0.05, delay: 0.04 });
          this.noise({ dur: 0.25, vol: 0.05, freq: 2200, q: 0.8 });
          break;
        case 'skillReady':
          this.tone({ freq: 660, dur: 0.06, type: 'sine', vol: 0.03 });
          this.tone({ freq: 990, dur: 0.09, type: 'sine', vol: 0.025, delay: 0.05 });
          break;
        case 'explosion':
          this.noise({ dur: 0.42, vol: 0.22, freq: 500, q: 0.4 });
          this.tone({ freq: 90, freq2: 35, dur: 0.4, type: 'sawtooth', vol: 0.12 });
          break;
        case 'cage':
          this.tone({ freq: 130, freq2: 65, dur: 0.4, type: 'square', vol: 0.06 });
          this.tone({ freq: 520, freq2: 780, dur: 0.35, type: 'triangle', vol: 0.04, delay: 0.08 });
          this.noise({ dur: 0.3, vol: 0.04, freq: 1600, q: 1.2 });
          break;
        case 'bark':
          this.tone({ freq: 420, freq2: 180, dur: 0.1, type: 'sawtooth', vol: 0.07 });
          this.noise({ dur: 0.07, vol: 0.04, freq: 1400, q: 1 });
          break;
        case 'pickup':
          this.tone({ freq: 880, dur: 0.06, type: 'sine', vol: 0.035 });
          this.tone({ freq: 1320, dur: 0.08, type: 'sine', vol: 0.028, delay: 0.04 });
          break;
        case 'levelup':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.07, delay: i * 0.09 });
          });
          break;
        case 'door':
          this.tone({ freq: 180, freq2: 240, dur: 0.35, type: 'sawtooth', vol: 0.05 });
          this.noise({ dur: 0.35, vol: 0.06, freq: 300, q: 0.5 });
          break;
        case 'ui':
          this.tone({ freq: 620, freq2: 780, dur: 0.05, type: 'square', vol: 0.03 });
          break;
        case 'uiBack':
          this.tone({ freq: 420, freq2: 260, dur: 0.07, type: 'square', vol: 0.03 });
          break;
        case 'boss':
          this.tone({ freq: 70, freq2: 42, dur: 1.2, type: 'sawtooth', vol: 0.14 });
          this.noise({ dur: 1.1, vol: 0.13, freq: 260, q: 0.45 });
          this.tone({ freq: 110, freq2: 55, dur: 1.4, type: 'square', vol: 0.05 });
          break;
        case 'bossHurt':
          this.tone({ freq: 110, freq2: 80, dur: 0.1, type: 'square', vol: 0.05 });
          break;
        case 'bossDie':
          this.noise({ dur: 1.4, vol: 0.24, freq: 500, q: 0.35 });
          [160, 130, 100, 70].forEach((f, i) => {
            this.tone({ freq: f, freq2: f * 0.6, dur: 0.5, type: 'sawtooth', vol: 0.1, delay: i * 0.18 });
          });
          break;
        case 'portal':
          [180, 240, 320, 480, 640].forEach((f, i) => {
            this.tone({ freq: f, dur: 0.8, type: 'sine', vol: 0.045, delay: i * 0.08 });
          });
          break;
        case 'victory':
          [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone({ freq: f, dur: 0.55, type: 'triangle', vol: 0.08, delay: i * 0.16 });
          });
          break;
        case 'gameover':
          [392, 349.23, 293.66, 196].forEach((f, i) => {
            this.tone({ freq: f, dur: 0.6, type: 'triangle', vol: 0.08, delay: i * 0.22 });
          });
          break;
        default:
          break;
      }
    }

    // ─────────────────────────────────────────────────────────
    //  生成式环境音乐
    // ─────────────────────────────────────────────────────────
    _startMusic() {
      if (this._musicTimer || !this.ready) return;
      this._musicTimer = setInterval(() => this._musicTick(), 300);
    }

    _musicTick() {
      if (!this.ready || this.muted || document.hidden) return;
      if (this.scene === 'silent') return;
      this._step++;
      const t = this._step;
      const boss = this.scene === 'boss';
      const scale = boss
        ? [130.81, 138.59, 155.56, 185.0, 196.0, 207.65, 233.08]
        : [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0];
      // 低音
      if (t % 8 === 0) {
        this.tone({ freq: scale[0] / 2, dur: 2.1, type: 'sine', vol: 0.11, attack: 0.15, music: true });
      }
      // 拨弦/钟琴
      if (t % 2 === 0 || Math.random() < 0.4) {
        const f = U.pick(scale) * (boss && Math.random() < 0.3 ? 0.5 : 1);
        this.tone({
          freq: f, dur: boss ? 0.32 : 0.7, type: boss ? 'square' : 'triangle',
          vol: boss ? 0.018 : 0.024, attack: 0.01, music: true
        });
      }
      // 稀疏高音
      if (Math.random() < (boss ? 0.32 : 0.18)) {
        this.tone({
          freq: U.pick(scale) * 2, dur: 1.1, type: 'sine', vol: 0.013, music: true
        });
      }
      // Boss 心跳
      if (boss && t % 4 === 0) {
        this.tone({ freq: 58, freq2: 40, dur: 0.18, type: 'sine', vol: 0.1, music: true });
      }
      // 偶尔的风声
      if (Math.random() < 0.06) {
        this.noise({ dur: 1.2, vol: 0.012, freq: 420, q: 2, music: true });
      }
    }
  }

  Ink.AudioSys = AudioSys;
  Ink.audio = new AudioSys();
})();
