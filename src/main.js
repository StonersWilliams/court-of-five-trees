/**
 * src/main.js
 * ------------------------------------------------------------
 * 启动入口：
 *   1. 找到 canvas，创建 Game
 *   2. 移除加载遮罩
 *   3. 启动 requestAnimationFrame 循环
 *
 * 保持零构建：这个文件只依赖前面 script 标签建立的 window.Ink。
 */
(function () {
  'use strict';

  const Ink = window.Ink;

  function boot() {
    const canvas = document.getElementById('game');
    if (!canvas) {
      console.error('[庭中有奇树] 找不到 #game canvas');
      return;
    }
    if (!Ink || !Ink.Game) {
      console.error('[庭中有奇树] Ink.Game 未加载，请检查脚本顺序。');
      return;
    }

    const game = new Ink.Game(canvas);
    window.Ink.game = game;
    Ink.game = game;

    // 首次指针 / 键盘操作时解锁 WebAudio（浏览器自动播放策略）。
    const unlock = () => {
      game.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });

    const bootEl = document.getElementById('boot');
    if (bootEl) {
      bootEl.classList.add('hidden');
      setTimeout(() => { if (bootEl.parentNode) bootEl.parentNode.removeChild(bootEl); }, 450);
    }

    canvas.focus();
    game.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
