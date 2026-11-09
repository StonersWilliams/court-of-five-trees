# 美术资源说明 · Assets

本项目坚持 **零运行时依赖**。所有角色、怪物、庭主、武器、树木、地砖与特效仍由 `src/core/pixelart.js` 在运行时用 Canvas 2D 像素绘制；`assets/` 中保存了一份 CC0 参考图集，仅用于造型/配色研究，不参与运行时加载，以避免风格与许可混杂。

## 资源规格

| 类别 | 尺寸 | 备注 |
| --- | --- | --- |
| 角色 | 16×16，2 帧 | 8 位执棋者，程序化轮廓 + 调色板换色 |
| 普通敌人 | 16×16，2 帧 | 9 种；纸蛾/铜铃傀/书蠹有独立色剪影 |
| 庭主 | 24×24，视觉放大 3–3.6 倍 | 13 位，主色不超过 5 色 |
| 武器 | 程序化矢量像素 | 53 件，含手持轮廓与枪口火光 |
| 场景 | 960×600 逻辑画布 | 五套主题、五树、门、火把、箱、柱、石、地刺、火焰喷口、箭墙 |
| UI | 960×600 逻辑画布 | 血条 / 护盾 / 能量 / 冷却环 / 小地图 / 图鉴 |

## 免费资源调研（CC0 / 公共领域）

以下 CC0 资源已实际下载/查阅，作为造型与配色参考；运行时未加载其像素，所有图形仍按本项目调色板重绘，以避免风格与许可混杂：

- Kenney — *1-Bit Pack* / *Tiny Dungeon*（CC0）：<https://kenney.nl/assets>
- Dungeon Crawl Stone Soup — tiles（CC0）：<https://opengameart.org/content/dungeon-crawl-32x32-tiles>
- Shade — *16×16 Puny Dungeon Tileset*（CC0）：<https://opengameart.org/content/16x16-puny-dungeon-tileset>
  - 已下载到 `assets/puny-dungeon-tileset.png`，仅作火焰喷口/箭墙/地刺/道具的造型参考；原始许可见来源页。

如果后续要替换为外部位图，请把文件放入 `assets/`，只使用 CC0 / CC-BY（并在 `ASSETS.md` 标注作者与链接），再用 `src/core/pixelart.js` 的 `loadSheet()` 封装；不要直接散落 `new Image()`。

## 主题与调色板

九套主题定义在 `src/core/pixelart.js` 的 `THEMES`；五层实际使用前五套，后四套保留给后续扩展。每套包含地砖、墙、强调色、雾色与符文色。角色与庭主主色集中在 `Ink.PAL` 与各自的 `BOSSES` 配置里，改色不会破坏像素轮廓。

## 生成方式

```bash
node server.js
# 打开 http://localhost:8080
```

所有图形在首次使用时缓存到内存 Canvas；刷新即可重新生成。不产生构建产物。

## 许可

本项目代码与程序化美术均以 MIT 许可发布，版权归 **Court of Wondrous Trees Contributors**。外部参考包各自的许可见上；`assets/puny-dungeon-tileset.png` 为 CC0 参考文件，未在运行时加载；其余图形象素均由本项目重绘。
