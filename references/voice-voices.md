# 音色库（语音合成 voice 可用值）

> 依据官方文档 https://docs.jcaigc.cn/voice/voices.md 整理。
> 合成时 `voice` 必须填**音色 ID**，不是中文展示名。音色与模型必须配套。

## 默认音色

默认合成模型 `seed-tts-2.0` 使用豆包语音 2.0 音色；**默认音色为
`zh_female_vv_uranus_bigtts`（Vivi，通用女声）**。

| 上游 / 模型 | 音色数 | 音色 ID 形态 | 配哪个 `model` |
|---|---|---|---|
| 阿里云百炼 · 千问 | 48 条内置 | 如 `Cherry` | `qwen3-tts-flash` |
| 阿里云百炼 · CosyVoice | 0 条系统音色 | 复刻/设计音色，如 `cosyvoice-v3.5-plus-…` | `cosyvoice-v3.5-plus` / `cosyvoice-v3.5-flash` |
| 火山引擎 · 豆包语音 | 40 条预设 | 如 `zh_female_vv_uranus_bigtts` | `seed-tts-2.0`；复刻音色用 `seed-icl-2.0` |

## 豆包语音（40 条）

### 中文音色（26 条）

| 音色 | 音色 ID | 场景 |
|------|---------|------|
| Vivi | `zh_female_vv_uranus_bigtts` | 通用（**默认**） |
| 小何 | `zh_female_xiaohe_uranus_bigtts` | 通用 |
| 云舟 | `zh_male_m191_uranus_bigtts` | 通用 |
| 小天 | `zh_male_taocheng_uranus_bigtts` | 通用 |
| 刘飞 | `zh_male_liufei_uranus_bigtts` | 通用 |
| 爽快思思 | `zh_female_shuangkuaisisi_uranus_bigtts` | 通用 |
| 魅力苏菲 | `zh_female_sophie_uranus_bigtts` | 通用 |
| 磁性解说男声 | `zh_male_cixingjieshuonan_uranus_bigtts` | 通用 |
| 解说小明 | `zh_male_jieshuoxiaoming_uranus_bigtts` | 通用 |
| 广告解说 | `zh_male_guanggaojieshuo_uranus_bigtts` | 通用 |
| 温柔妈妈 | `zh_female_wenroumama_uranus_bigtts` | 通用 |
| 深夜播客 | `zh_male_shenyeboke_uranus_bigtts` | 通用 |
| 高冷御姐 | `zh_female_gaolengyujie_uranus_bigtts` | 通用 |
| 傲娇霸总 | `zh_male_aojiaobazong_uranus_bigtts` | 通用 |
| TVB 女声 | `zh_female_tvbnv_uranus_bigtts` | 通用 |
| 暖阳女声 | `zh_female_kefunvsheng_uranus_bigtts` | 客服 |
| Tina 老师 | `zh_female_yingyujiaoxue_uranus_bigtts` | 教育 |
| 儿童绘本 | `zh_female_xiaoxue_uranus_bigtts` | 有声阅读 |
| 悬疑解说 | `zh_male_xuanyijieshuo_uranus_bigtts` | 有声阅读 |
| 大壹 | `zh_male_dayi_uranus_bigtts` | 视频配音 |
| 猴哥 | `zh_male_sunwukong_uranus_bigtts` | 视频配音 |
| 佩奇猪 | `zh_female_peiqi_uranus_bigtts` | 视频配音 |
| 古风少御 | `zh_female_gufengshaoyu_uranus_bigtts` | 角色扮演 |
| 唐僧 | `zh_male_tangseng_uranus_bigtts` | 角色扮演 |
| 猪八戒 | `zh_male_zhubajie_uranus_bigtts` | 角色扮演 |
| 武则天 | `zh_female_wuzetian_uranus_bigtts` | 角色扮演 |

### 外语音色（14 条）

| 音色 | 音色 ID | 语种 | 场景 |
|------|---------|------|------|
| Allison | `en_female_allison_uranus_bigtts` | 美式英语 | 视频配音 |
| Ryan | `en_male_ryan_uranus_bigtts` | 美式英语 | 有声阅读 |
| Yusuke | `ja_male_yusuke_uranus_bigtts` | 日语 | 有声阅读 |
| Minho | `ko_male_m03_uranus_bigtts` | 韩语 | 客服 |
| Cesna | `id_female_cesna_uranus_bigtts` | 印尼语 | 通用 · 客服 |
| Elle | `th_female_elle_uranus_bigtts` | 泰语 | 通用 |
| Hannah | `vi_female_f01507b_uranus_bigtts` | 越南语 | 通用 · 客服 |
| Romina | `es_female_romina_uranus_bigtts` | 西班牙语 | 通用 |
| Mari | `pt_female_mari_uranus_bigtts` | 巴西葡萄牙语 | 教学 · 视频配音 |
| Camille | `fr_female_fr_f47_uranus_bigtts` | 法语 | 教学 · 客服 |
| Sven | `de_male_sven_uranus_bigtts` | 德语 | 通用 · 教学 |
| Pavel | `ru_male_pavel_uranus_bigtts` | 俄语 | 通用 · 视频配音 |
| Luca | `it_male_luca_uranus_bigtts` | 意大利语 | 有声阅读 |
| Fatma | `ar_female_fatma_uranus_bigtts` | 阿拉伯语 | 趣味口音 |

> 豆包音色属于 2.0 一代（ID 以 `_uranus_bigtts` 结尾），只能配 `seed-tts-2.0`；
> 上一代 `_moon_bigtts` 等音色不适用。

## 千问（48 条内置）

`qwen3-tts-flash` 只能配以下千问音色；不支持声音复刻。

| 音色 | 音色 ID | 描述 |
|------|---------|------|
| 芊悦 | `Cherry` | 阳光积极、亲切自然小姐姐（女性） |
| 苏瑶 | `Serena` | 温柔小姐姐（女性） |
| 晨煦 | `Ethan` | 标准普通话，带部分北方口音（男性） |
| 千雪 | `Chelsie` | 二次元虚拟女友（女性） |
| 茉兔 | `Momo` | 撒娇搞怪，逗你开心（女性） |
| 十三 | `Vivian` | 拽拽的、可爱的小暴躁（女性） |
| 月白 | `Moon` | 率性帅气的月白（男性） |
| 四月 | `Maia` | 知性与温柔的碰撞（女性） |
| 凯 | `Kai` | 耳朵的一场 SPA（男性） |
| 不吃鱼 | `Nofish` | 不会翘舌音的设计师（男性） |
| 萌宝 | `Bella` | 喝酒不打醉拳的小萝莉（女性） |
| 詹妮弗 | `Jennifer` | 品牌级、电影质感般美语女声（女性） |
| 甜茶 | `Ryan` | 节奏拉满，戏感炸裂（男性） |
| 卡捷琳娜 | `Katerina` | 御姐音色（女性） |
| 艾登 | `Aiden` | 精通厨艺的美语大男孩（男性） |
| 沧明子 | `Eldric Sage` | 沉稳睿智的老者（男性） |
| 乖小妹 | `Mia` | 温顺乖巧（女性） |
| 沙小弥 | `Mochi` | 聪明伶俐的小大人（男性） |
| 燕铮莺 | `Bellona` | 声音洪亮，吐字清晰（女性） |
| 田叔 | `Vincent` | 沙哑烟嗓（男性） |
| 萌小姬 | `Bunny` | “萌属性”爆棚的小萝莉（女性） |
| 阿闻 | `Neil` | 字正腔圆的新闻主持人（男性） |
| 墨讲师 | `Elias` | 学科严谨的讲师（女性） |
| 徐大爷 | `Arthur` | 质朴嗓音（男性） |
| 邻家妹妹 | `Nini` | 又软又黏的邻家妹妹（女性） |
| 小婉 | `Seren` | 温和舒缓，助眠（女性） |
| 顽屁小孩 | `Pip` | 调皮捣蛋的小新（男性） |
| 少女阿月 | `Stella` | 甜到发腻的少女音（女性） |
| 博德加 | `Bodega` | 热情的西班牙大叔（男性） |
| 索尼莎 | `Sonrisa` | 热情开朗的拉美大姐（女性） |
| 阿列克 | `Alek` | 战斗民族的冷与暖（男性） |
| 多尔切 | `Dolce` | 慵懒的意大利大叔（男性） |
| 素熙 | `Sohee` | 温柔开朗的韩国欧尼（女性） |
| 小野杏 | `Ono Anna` | 鬼灵精怪的青梅竹马（女性） |
| 莱恩 | `Lenn` | 理性又叛逆的德国青年（男性） |
| 埃米尔安 | `Emilien` | 浪漫的法国大哥哥（男性） |
| 安德雷 | `Andre` | 磁性沉稳男声（男性） |
| 拉迪奥·戈尔 | `Radio Gol` | 足球解说（男性） |
| 上海-阿珍 | `Jada` | 沪上阿姐（女性） |
| 北京-晓东 | `Dylan` | 北京胡同少年（男性） |
| 南京-老李 | `Li` | 耐心的瑜伽老师（男性） |
| 陕西-秦川 | `Marcus` | 老陕味道（男性） |
| 闽南-阿杰 | `Roy` | 诙谐直爽的台湾哥仔（男性） |
| 天津-李彼得 | `Peter` | 天津相声捧哏（男性） |
| 四川-晴儿 | `Sunny` | 川妹子（女性） |
| 四川-程川 | `Eric` | 四川成都男子（男性） |
| 粤语-阿强 | `Rocky` | 幽默风趣的阿强（男性） |
| 粤语-阿清 | `Kiki` | 甜美的港妹闺蜜（女性） |

这 48 条只能配 `qwen3-tts-flash`，不能填给豆包或 CosyVoice。

## CosyVoice（无系统音色）

`cosyvoice-v3.5-plus` / `cosyvoice-v3.5-flash` **没有系统音色**。
可用的 `voice` 只有通过 [声音复刻](voice-clone.md) 创建的专属音色：

- `cosyvoice-v3.5-plus` 创建的音色形如 `cosyvoice-v3.5-plus-…`，只能配 `cosyvoice-v3.5-plus` 合成。
- `cosyvoice-v3.5-flash` 创建的音色形如 `cosyvoice-v3.5-flash-…`，只能配 `cosyvoice-v3.5-flash` 合成。
- `longanyang` / `longanhuan` 属于上一代 `cosyvoice-v3-plus`，填给 3.5 会被上游以 418 拒绝。

## 注意事项

1. **默认音色**：`seed-tts-2.0` 默认 `zh_female_vv_uranus_bigtts`（Vivi）。
2. **音色与模型必须配套**：千问、豆包、CosyVoice 不能交叉；跨家可能得到空音频。
3. **豆包跨代也不行**：只用 `_uranus_bigtts` 结尾的 2.0 音色；上一代 `_moon_bigtts` 等不适用。
4. **完整清单**：官方文档 https://docs.jcaigc.cn/voice/voices.md ；最新可用性以控制台为准。
