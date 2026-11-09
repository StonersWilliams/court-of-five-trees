# 美术资源说明 · Assets

本项目坚持 **零运行时依赖、零图片下载**。当前所有角色、怪物、庭主、武器、树木、地砖与特效均由 `src/core/pixelart.js` 在运行时用 Canvas 2D 像素绘制；没有外链贴图，也没有需要额外许可的二进制素材。

## 资源规格

| 类别 | 尺寸 | 备注 |
| --- | --- | --- |
| 角色 | 16×16，2 帧 | 8 位执棋者，程序化轮廓 + 调色板换色 |
| 普通敌人 | 16×16，2 帧 | 9 种；纸蛾/铜铃傀/书蠹有独立色剪影 |
| 庭主 | 24×24，视觉放大 3–3.6 倍 | 13 位，主色不超过 5 色 |
| 武器 | 程序化矢量像素 | 49 件，含手持轮廓与枪口火光 |
| 场景 | 960×600 逻辑画布 | 五套主题、五树、门、火把、箱、柱、石、地刺 |
| UI | 960×600 逻辑画布 | 血条 / 护盾 / 能量 / 冷却环 / 小地图 / 图鉴 |

## 免费资源调研（CC0 / 公共领域）

以下资源包被评估为可用的免费像素参考；本项目**没有直接打包或依赖**它们，所有图形均按本项目调色板重绘，以避免混合许可证和外部请求：

- Kenney — *1-Bit Pack* / *Tiny Dungeon*（CC0）：<https://kenney.nl/assets>
- Dungeon Crawl Stone Soup — tiles（CC0）：<https://opengameart.org/content/dungeon-crawl-32x32-tiles>
- OpenGameArt — *16×16 Dungeon Tileset*（CC0）：<https://opengameart.org/content/16x16-dungeon-tileset>

如果后续要替换为外部位图，请把文件放入 `assets/`，只使用 CC0 / CC-BY（并在 `ASSETS.md` 标注作者与链接），再用 `src/core/pixelart.js` 的 `loadSheet()` 封装；不要直接散落 `new Image()`。

## 主题与调色板

九套主题定义在 `src/core/pixelart.js` 的 `THEMES`；每套包含地砖、墙、强调色、雾色与符文色。角色与庭主主色集中在 `Ink.PAL` 与各自的 `BOSSES` 配置里，改色不会破坏像素轮廓。

## 生成方式

```bash
node server.js
# 打开 http://localhost:8080
```

所有图形在首次使用时缓存到内存 Canvas；刷新即可重新生成。不产生构建产物。

## 许可

本项目代码与程序化美术均以 MIT 许可发布，版权归 **Court of Wondrous Trees Contributors**。外部参考包各自的许可见上；本项目不复制它们的像素文件。
