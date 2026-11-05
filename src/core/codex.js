/**
 * 《庭中有奇树》图鉴数据
 * ------------------------------------------------------------
 * 这里只放“展示用”的资料：数值、背景、招式说明。
 * 实际战斗参数仍以 entities/enemy.js、entities/boss.js 为准；
 * 改数值时请两边同步，避免图鉴与实战不一致。
 *
 * 图鉴由 ui/ui.js 读取：
 *   Ink.Codex.enemies / Ink.Codex.bosses
 * 每个条目都包含 id、名称、基础数值、背景与招式数组。
 */
(function () {
  'use strict';

  const Ink = window.Ink;

  // ── 小怪 ────────────────────────────────────────────────
  // hp/speed/damage/xp 为第 1 层基础值；层数缩放写在 panel 的说明里。
  const enemies = [
    {
      id: 'slime', name: '墨团', en: 'INK BLOB', title: '未干的一滴墨',
      hp: 34, speed: 76, damage: 9, xp: 5, color: '#4fbf94',
      desc: '从废弃稿纸边缘滴落的墨点，久了便有了胃口。它不认得字，只认得纸纤维的味道，常把整页批注啃成一圈湿漉漉的牙印。',
      skills: [
        { name: '墨跃', desc: '一蹦一停地逼近，落地时溅出小片墨渍。' },
        { name: '黏身', desc: '贴身后连续顶撞；被击破时炸成四散墨珠。' }
      ]
    },
    {
      id: 'skull', name: '飞颅', en: 'FLYING SKULL', title: '被退稿的头骨',
      hp: 30, speed: 66, damage: 7, xp: 6, color: '#65d7ff',
      desc: '旧书库最上层的一颗纸扎头骨，眼眶里塞着没寄出的退稿信。它总在离你三步远的地方停下，像在斟酌一句更刻薄的评语。',
      skills: [
        { name: '墨弹', desc: '保持中距离，朝当前方向吐出一枚墨色弹丸。' },
        { name: '退稿凝视', desc: '开火前短暂停顿；停顿结束才真正出手。' }
      ]
    },
    {
      id: 'gargoyle', name: '石像鬼', en: 'STONE WARDEN', title: '压纸的镇兽',
      hp: 94, speed: 38, damage: 14, xp: 10, color: '#ff8a5c',
      desc: '原本是书院门前一对镇纸兽，被香火熏黑后学会了起身。它走得很慢，因为每一块石头都还记得自己曾经压过什么。',
      skills: [
        { name: '蓄力冲撞', desc: '原地伏低约 0.7 秒，随后直线冲锋，撞上墙才停。' },
        { name: '碎石甲', desc: '生命较高，受击时只会掉下细碎石屑。' }
      ]
    },
    {
      id: 'spider', name: '影蛛', en: 'SHADOW SPIDER', title: '书页夹缝里的影子',
      hp: 27, speed: 112, damage: 7, xp: 5, color: '#ff5c7a',
      desc: '只在两页纸合拢的瞬间出现。它把批注之间的空白当作巢穴，吐出的丝细得几乎看不见，却能把一行字拖进另一行。',
      skills: [
        { name: '短扑', desc: '极短前摇后高速扑咬，适合惩罚站桩。' },
        { name: '影行', desc: '移动快，受击后短暂加速脱离。' }
      ]
    },
    {
      id: 'tome', name: '咒书', en: 'CURSED TOME', title: '会自己翻页的禁注',
      hp: 42, speed: 44, damage: 8, xp: 8, color: '#c084fc',
      desc: '一本没有封皮的批注本，页边写满了“不可读”。它喜欢与人保持距离，翻页时书脊会渗出紫色的咒文，像在低声点名。',
      skills: [
        { name: '纸页闪现', desc: '靠近后短距传送，留下纸屑与残影。' },
        { name: '环咒', desc: '传送落点释放一圈咒文弹，层数越高弹数越多。' }
      ]
    },
    {
      id: 'guard', name: '枪俑', en: 'SPEAR GUARD', title: '考场门外的泥卫',
      hp: 72, speed: 55, damage: 11, xp: 9, color: '#ffb35c',
      desc: '泥塑的考场门卫，手里那杆枪其实是一支蘸满朱砂的判笔。它不问你姓名，只问你有没有带小抄。',
      skills: [
        { name: '朱线', desc: '先在地面画出笔直的预警线，约 0.55 秒后刺出光束。' },
        { name: '守门', desc: '在中距离来回踱步，逼迫玩家绕开正面。' }
      ]
    },
    {
      id: 'moth', name: '纸蛾', en: 'PAPER MOTH', title: '灯下扑火的校样',
      hp: 38, speed: 82, damage: 8, xp: 7, color: '#ffe0a0',
      desc: '从校样边缘飞起的纸蛾，翅膀上还印着半行红字。它以为灯是月亮，以为你是灯，于是总在离你最近的时候撒下一把鳞粉。',
      skills: [
        { name: '鳞粉扇', desc: '短暂振翅后朝前方扇形吐出三枚鳞粉弹。' },
        { name: '趋光', desc: '会绕着玩家画弧，寻找最容易命中的角度。' }
      ]
    },
    {
      id: 'bell', name: '铜铃傀', en: 'BELL PUPPET', title: '无风自响的钟',
      hp: 68, speed: 40, damage: 10, xp: 10, color: '#9fd8ff',
      desc: '钟楼掉下来的一枚小铜铃，铃舌被人换成了骨头。它走路时没有声音，停下时却会自己响；听见铃声的人，往往会忘记自己要去哪。',
      skills: [
        { name: '摇铃', desc: '停下摇铃约 0.62 秒，随后放出一圈八发音浪。' },
        { name: '余响', desc: '音浪扩散慢，但覆盖整圈，逼玩家提前走位。' }
      ]
    },
    {
      id: 'rat', name: '书蠹', en: 'BOOK WORM', title: '吃批注的小虫',
      hp: 24, speed: 148, damage: 6, xp: 5, color: '#d8b08a',
      desc: '不是鼠，却长着鼠的牙；不是虫，却把整座书库当成果腹的果子。它专挑批注下口，因为那是最有味道的部分。',
      skills: [
        { name: '疾扑', desc: '极快的一次直线扑咬，前摇很短。' },
        { name: '钻缝', desc: '体型小、移速高，容易从障碍与弹幕之间穿过。' }
      ]
    }
  ];

  // ── 庭主 ────────────────────────────────────────────────
  // hp/damage 为第 1 层基础值；实际值按层数缩放。
  const bosses = [
    {
      id: 'truffle', name: '松露菌', en: 'TRUFFLE LORD', title: '菌伞下的甜梦',
      floor: 1, hp: 560, speed: 54, damage: 14, xp: 125, color: '#c89b6a',
      desc: '第一庭的守门者，一株从退稿堆里长出来的巨菌。它把“再改一稿”的疲惫酿成甜味，请每个路过的人尝一口。吃完的人确实不疼了，只是再也想不起自己为什么来。',
      skills: [
        { name: '孢子环', desc: '伞盖一抖，朝四周撒出一圈孢子弹。' },
        { name: '甜梦毒地', desc: '在玩家脚下种下延迟绽放的毒菌，留下减速区域。' },
        { name: '召菌', desc: '从菌丝里唤出小墨团；二阶段召唤更频繁。' }
      ]
    },
    {
      id: 'sunstar', name: '环日星神', en: 'SUNSTAR DEITY', title: '把太阳戴在颈上的神',
      floor: 2, hp: 540, speed: 60, damage: 15, xp: 130, color: '#ffd36b',
      desc: '第二庭的日轮祭司。它说光应当平等，于是把九轮太阳依次挂在每个生灵头顶。被照到的人都说太亮了，它便再挂一轮，直到谁也睁不开眼。',
      skills: [
        { name: '日光环', desc: '颈后日轮展开，释放一圈缓慢外扩的光弹。' },
        { name: '圣光场', desc: '在场地中央留下持续灼烧的圣光区域。' },
        { name: '日爆', desc: '蓄力后以自身为中心炸开大范围光爆，前摇很长。' }
      ]
    },
    {
      id: 'ninesun', name: '九阳神君', en: 'NINE-SUN TYRANT', title: '九轮不落的暴君',
      floor: 3, hp: 600, speed: 52, damage: 16, xp: 140, color: '#ff8a4c',
      desc: '第三庭的暴君，九颗太阳是它从九个失败王朝那里抢来的冠冕。它最恨阴影，因为阴影会提醒它：天上本来只有一个太阳。',
      skills: [
        { name: '九日双环', desc: '连续放出两圈方向错开的火弹。' },
        { name: '火焰地脉', desc: '沿地面埋下数道延迟喷发的火柱。' },
        { name: '九阳爆发', desc: '二阶段召来九日同坠，覆盖大半场地。' }
      ]
    },
    {
      id: 'peach', name: '桃柱', en: 'PEACH PILLAR', title: '开花不倒的庭柱',
      floor: 4, hp: 640, speed: 54, damage: 16, xp: 145, color: '#ff9bb0',
      desc: '第四庭的桃木庭柱，被雷劈过三次仍不肯倒。每年春天它都开一树花，花瓣落进土里，第二年就长出新的、会咬人的花傀。',
      skills: [
        { name: '花雨', desc: '抖落漫天桃花，花瓣落地后化作弹幕。' },
        { name: '花傀', desc: '召唤小怪；二阶段会借花傀回血。' },
        { name: '震地', desc: '以柱根砸地，震开近身敌人并造成范围伤害。' }
      ]
    },
    {
      id: 'oga', name: '尾刚一郎', en: 'OGA ICHIRO', title: '只挥一刀的剑鬼',
      floor: 5, hp: 620, speed: 74, damage: 17, xp: 150, color: '#8f9dff',
      desc: '第五庭的剑鬼，生前是个总也考不中的武举人。死后它终于练成了“只挥一刀”的绝技，于是把每个闯入者都当成迟到的考官。',
      skills: [
        { name: '居合', desc: '压低身形后瞬间突进，留下一条剑痕。' },
        { name: '三连斩波', desc: '朝前方连发三道弧形剑气。' },
        { name: '剑环', desc: '二阶段以自身为圆心扫出一圈剑风。' }
      ]
    },
    {
      id: 'june', name: '六月云之末', en: 'JUNE CLOUD', title: '梅雨尽头的云',
      floor: 6, hp: 600, speed: 58, damage: 16, xp: 150, color: '#b7d9ff',
      desc: '第六庭的雨云，停在梅雨季最后一天，再也不肯走。它说只要雨不停，就没人能说夏天已经过去。云里偶尔会露出一双潮湿的眼睛。',
      skills: [
        { name: '云雨', desc: '在场地各处落下延迟雨点，形成湿滑区域。' },
        { name: '天雷束', desc: '召来一道垂直雷光，预警后劈落。' },
        { name: '雾隐', desc: '化入雨雾短距传送，在落点释放环弹。' }
      ]
    },
    {
      id: 'tower', name: '伦敦塔', en: 'THE TOWER', title: '会走路的钟楼',
      floor: 7, hp: 720, speed: 42, damage: 18, xp: 160, color: '#d7c39a',
      desc: '第七庭的钟楼，从一张旧明信片上走下来。它每走一步就敲一次钟，钟声里夹着不同时区的报时。被钟声罩住的人，会同时迟到于所有约会。',
      skills: [
        { name: '十字钟光', desc: '以钟面为轴，放出横竖两道贯穿光柱。' },
        { name: '砖雨', desc: '从塔身抖落砖石，砸向玩家附近。' },
        { name: '钟摆环', desc: '钟摆横扫一圈，二阶段摆幅更大。' }
      ]
    },
    {
      id: 'bigmon', name: '大大怪', en: 'BIGMON', title: '五树庭的笨重噩梦',
      floor: 8, hp: 760, speed: 48, damage: 18, xp: 165, color: '#8ef0c8',
      desc: '第八庭的看守，没人知道它原来是什么，只知道它很大、很怪，而且总在笑。它把撞塌的院墙当成积木，把来访者当成新积木。',
      skills: [
        { name: '蛮撞', desc: '大步冲撞，撞到墙会短暂眩晕。' },
        { name: '落石', desc: '从头顶抓下碎石，砸出持续存在的石堆。' },
        { name: '踏地', desc: '抬脚重踏，震荡整片近身区域。' }
      ]
    },
    {
      id: 'edo', name: '江户十二口女', en: 'EDO TWELVE-MOUTHS', title: '十二张嘴的都市传说',
      floor: 9, hp: 800, speed: 68, damage: 19, xp: 170, color: '#c084fc',
      desc: '第九庭的最后一位守门人，传说她每说一句谎就多长一张嘴。如今十二张嘴各说各话，有的在哭，有的在笑，有的在叫你的名字。',
      skills: [
        { name: '扇面', desc: '展开十二骨扇，朝前方喷出扇形弹幕。' },
        { name: '十二口', desc: '在场地各处短暂现身，每个落点都留下一圈咒文。' },
        { name: '咒域', desc: '二阶段展开大范围咒域，持续压缩走位空间。' }
      ]
    }
  ];

  const enemyById = {};
  const bossById = {};
  for (const e of enemies) enemyById[e.id] = e;
  for (const b of bosses) bossById[b.id] = b;

  Ink.Codex = {
    enemies,
    bosses,
    enemyById,
    bossById,
    // 统一取条目，方便 UI 切换页签。
    list(tab) {
      return tab === 'boss' ? bosses : enemies;
    },
    get(tab, index) {
      const arr = this.list(tab);
      return arr[((index % arr.length) + arr.length) % arr.length];
    }
  };
})();
