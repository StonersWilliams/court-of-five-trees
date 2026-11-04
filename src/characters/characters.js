/**
 * src/characters/characters.js
 * ------------------------------------------------------------
 * 角色注册表与 CharacterBase 基类。
 *
 * 每个角色文件只做两件事：
 *   1. 继承 Ink.CharacterBase，实现钩子；
 *   2. 调用 Ink.registerCharacter({ 面板数值, create() {...} })。
 *
 * 钩子调用时机（由 player.js / game.js 调用）：
 *   onSpawn()                       角色生成
 *   onRoomEnter(room)               进入新房间
 *   update(dt)                      每帧
 *   basicAttack()                   普通攻击（由角色决定近战/远程）
 *   onBasicHit(enemy, projectile)   普通攻击命中
 *   useSkill()                      主动技能，返回 true 表示释放成功
 *   onKill(enemy)                   击杀敌人
 *   beforeDamage(amount, source)    受伤前修正（心阅的首次减伤）
 *   tryDeflect(source)              完全偏转一次伤害（心阅心域）
 *   modifyDamageDealt(enemy, dmg)   增伤（字狱字印 / 小影标记）
 *   onDogBroken()                   影犬被击破
 *   drawWorld(ctx, game)            角色专属的场景绘制
 */
(function () {
  'use strict';

  const Ink = window.Ink;

  class CharacterBase {
    constructor(player, game) {
      this.player = player;
      this.game = game;
    }
    onSpawn() {}
    onRoomEnter() {}
    update(dt) {}
    basicAttack() { return false; }
    onBasicHit(enemy, projectile) {}
    useSkill() { return false; }
    onKill(enemy) {}
    beforeDamage(amount, source) { return amount; }
    tryDeflect(source) { return false; }
    modifyDamageDealt(enemy, amount) { return amount; }
    onDogBroken() {}
    drawWorld(ctx, game) {}
  }

  const Characters = {};
  const CharacterList = [];

  /**
   * @param {object} def
   * 必填：id, name, title, role, color, hp, armor, speed, damage,
   *       atkInterval, range, cooldown, skillName, skillDesc,
   *       passiveName, passiveDesc, create(player, game)
   */
  function registerCharacter(def) {
    if (!def || !def.id || !def.create) throw new Error('角色注册缺少 id/create');
    if (Characters[def.id]) throw new Error('角色重复注册: ' + def.id);
    Characters[def.id] = def;
    // UI 直接遍历角色定义；id 仍可通过 def.id / Ink.Characters 获取。
    CharacterList.push(def);
  }

  function createCharacter(id, player, game) {
    const def = Characters[id];
    if (!def) throw new Error('未知角色: ' + id);
    return def.create(player, game);
  }

  Ink.CharacterBase = CharacterBase;
  Ink.Characters = Characters;
  Ink.CharacterList = CharacterList;
  Ink.registerCharacter = registerCharacter;
  Ink.createCharacter = createCharacter;
})();
