# 深淵生物與巨獸 Canvas 建模參考

查閱日期：2026-11-26。以下記錄 `index.html` 的 `DDRAW`、巨獸 Canvas 繪圖及圖鑑縮圖參考。這些是遊戲用向量插畫：以研究機構、水族館、自然史博物館的文字與活體照片辨識構造，重新撰寫 Canvas 路徑，沒有複製或內嵌來源圖片。顏色、發光強度、動作幅度和顯示比例經過遊戲化處理，不是科學測量模型。

## 16 種深淵生物

| ID／名稱 | 第一手或機構來源 | 本次建模依據與互動 |
| --- | --- | --- |
| `lantern` 燈籠魚 | [WHOI：Lanternfishes](https://www.whoi.edu/ocean-learning-hub/ocean-facts/lanternfishes/) | 小型魚群、分明尾鰭與大眼；腹部及身側兩列藍綠發光器。保留點擊後魚群閃光與散開，光點排列是概括設計。 |
| `viperfish` 蝰魚 | [Monterey Bay Aquarium：Pacific viperfish](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/pacific-viperfish) | 細長身體、大口、超出嘴緣的交錯長牙、背部細長誘餌及腹部光點。張嘴時下顎獨立旋轉。 |
| `barreleye` 桶眼魚 | [MBARI：Barreleye fish](https://www.mbari.org/animal/barreleye-fish/) | 透明頭罩、罩內可轉向的綠色管狀眼、前端鼻孔、大面積穩定鰭。綠眼不再被畫成自行發光的燈。 |
| `oarfish` 皇帶魚 | [Florida Museum：Oarfish](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/oarfish/) | 銀色緞帶身形、沿背延伸的紅色鰭膜、冠狀前背鰭條及細長腹鰭。冠羽與長身連續起伏；移除地震預言描述。 |
| `coelacanth` 腔棘魚 | [Smithsonian：Coelacanth](https://ocean.si.edu/ocean-life/fish/coelacanth) | 肉質鰭柄、三葉尾端、厚鱗與白色斑點，成對鰭緩慢划動。保留倒立互動。 |
| `atolla` 警報水母 | [MBARI：Deep-sea crown jelly](https://www.mbari.org/animal/deep-sea-crown-jelly/)、[MBARI：Atolla 新種](https://www.mbari.org/news/scientists-discover-a-new-species-of-deep-sea-crown-jelly-in-monterey-bay/) | 冠狀鐘體、環溝、分節邊緣與單根特長拖曳觸手；受驚時藍光沿圓周轉動。採多數 Atolla 的典型輪廓，並非沒有長觸手的 A. reynoldsi。 |
| `anglerfish` 深海鮟鱇魚 | [MBARI：Deep-sea anglerfish](https://www.mbari.org/animal/deep-sea-anglerfish/) | 大頭寬口、細長牙列、斑駁表皮、獨立胸鰭及釣竿末端發光誘餌。保留誘餌閃光與咬合；雄魚永久附著的說明限定為某些種類。 |
| `gulper` 寬咽魚 | [MBARI：Whiptail gulper eel](https://www.mbari.org/animal/whiptail-gulper-eel/) | 極小眼睛、膨大的可擴張口部、細長身體、鞭狀尾端光點；張口時呈現袋狀摺線。這是遊戲通用寬咽魚造型，不作種級鑑定。 |
| `blobfish` 水滴魚 | [Australian Museum：Blobfish／水下胖頭魚照片](https://australian.museum/learn/animals/fishes/fathead-psychrolutes-aka-mr-blobby/) | 以水下 Psychrolutes 活體照片的圓厚頭部、寬胸鰭與灰褐斑紋為形態參考，改掉離水後下垂鼻子的迷因臉。點擊為身體與鰭輕晃。 |
| `vampsquid` 吸血鬼魷魚 | [Smithsonian：Vampire squid](https://ocean.si.edu/ocean-life/invertebrates/vampire-squid-hell)、[Aquarium of the Pacific：Vampire squid](https://www.aquariumofpacific.org/onlinelearningcenter/species/vampire_squid) | 八腕腕膜、腕內軟刺、雙鰭及兩根細長攝食絲，保留翻傘與腕端光點。描述說明以海洋雪為食；不是吸血行為。 |
| `frilled` 皺鰓鯊 | [Australian Museum：Frill shark](https://australian.museum/learn/animals/fishes/frill-shark-chlamydoselachus-anguineus-garman-1884/) | 褐色鰻狀身軀、六對皺褶鰓裂、靠後的背鰭、前端口及三叉細牙。下顎可張開展示牙形。 |
| `giantsquid` 大王魷魚 | [Smithsonian：Giant squid](https://ocean.si.edu/ocean-life/invertebrates/giant-squid) | 披針形外套膜、後方雙鰭、漏斗、八腕及兩條長觸腕；長觸腕末端有擴大的吸盤區。保留甩腕與原有噴墨互動，眼睛不自行發光。 |
| `tripod` 三腳架魚 | [NOAA：Tripod fish](https://oceanexplorer.noaa.gov/multimedia/okeanos-explorations-ex1903-dailyupdates-june29-media-tripod-fish-2/) | 兩根腹鰭長鰭條加一根尾鰭長鰭條支撐海底，額外胸鰭觸覺絲伸向前方。保留收腳換位。 |
| `isopod` 大王具足蟲 | [Smithsonian：Giant isopods](https://ocean.si.edu/ocean-life/invertebrates/meet-giant-isopods) | 分節背甲、七對步足、兩對觸角、尾部板片與大眼，受驚縮起。去除容易誤讀為一般餵養建議的特定耐餓紀錄。 |
| `dumbo` 小飛象章魚 | [Natural History Museum：Dumbo octopus](https://www.nhm.ac.uk/discover/what-is-a-dumbo-octopus.html) | 外套膜上的一對耳形鰭、八腕與傘狀腕膜，腕面有吸盤。保留拍鰭及轉圈。 |
| `snailfish` 超深淵獅子魚 | [MBARI：Snailfish](https://www.mbari.org/animal/snailfish/) | 柔軟無鱗的大頭、漸細尾端、寬胸鰭及連續鰭膜，半透明層表現膠質感。這是獅子魚科的概括造型，透明程度不是所有種類的共同特徵；移除固定最深紀錄及完整透骨宣稱。 |

## 3 種史前巨獸重建

這三種已滅絕，遊戲觀測場景為虛構。化石能支持的構造與推測的軟組織分開處理，沒有把現生大白鯊比例直接當成巨齒鯊的定論。

| ID／名稱 | 來源 | 本次建模依據 |
| --- | --- | --- |
| `dunkle` 鄧氏魚 | [Case Western Reserve University：2023 年短而壯的體型研究](https://case.edu/news/chunky-dunk-clevelands-prehistoric-sea-monster-may-have-been-shorter-stouter-once-believed) | 改為短而厚實的輪廓、頭胸部多片骨甲接縫與無真牙的骨刃顎。保留三次咬合；後段軀體、鰭形與配色為藝術重建。 |
| `mosa` 滄龍 | [Natural History Museum：What is a mosasaur?](https://www.nhm.ac.uk/discover/what-is-a-mosasaur.html) | 拉長爬蟲式口吻、圓錐牙、四個分明槳狀肢、尾端向下彎曲支撐的尾鰭；沒有添加魚類背鰭。保留追逐誘餌動作。 |
| `megalodon` 巨齒鯊 | [Natural History Museum：Is megalodon still alive?](https://www.nhm.ac.uk/discover/is-megalodon-still-alive.html) | 尖端漸細的鯊魚身軀、五道鰓裂、背腹明暗、鰭與月牙尾；側視及正面撞窗皆畫出寬三角鋸齒牙與替換牙列。體型比例和配色為推測，文字明確標註已滅絕。 |

## 5 種神話幻想巨獸

文學原文或博物館對海怪傳說的說明只提供創作母題，不能當作實際動物的解剖證據。遊戲圖鑑 `era` 已明確標示「神話幻想」。

| ID／名稱 | 文獻或機構來源 | 幻想設計的範圍 |
| --- | --- | --- |
| `scylla` 斯庫拉 | [Tufts Perseus：《奧德賽》第十二卷](https://beta.perseus.tufts.edu/urn:cts:greekLit:tlg0012.tlg002.butlernagy2020-eng2/book:12/) | 六條長頸、六個頭、十二隻腳、多排牙與岩洞棲身的母題。遊戲採犬形頭、共同軀幹與爪足，六頭可同時咆哮。 |
| `kraken` 克拉肯 | [Natural History Museum：Sea monsters and their inspiration](https://www.nhm.ac.uk/discover/sea-monsters-inspiration-serpents-mermaids-the-kraken.html) | 巨型頭足類啟發的海怪傳說；完整外套膜、雙眼與八條連接軀幹的吸盤腕是本作設計，保留拍窗及墨汁。 |
| `charybdis` 卡律布迪斯 | [Tufts Perseus：《奧德賽》第十二卷](https://beta.perseus.tufts.edu/urn:cts:greekLit:tlg0012.tlg002.butlernagy2020-eng2/book:12/) | 文學母題是吞吐海水的危險漩渦；海底口部、牙環與岩壁構造為創作。場景強調水流螺旋及吸水、噴水循環。 |
| `leviathan` 利維坦 | [《約伯記》第四十一章原文譯本](https://www.biblegateway.com/passage/?search=Job+41&version=KJV) | 盾狀緊密鱗甲、利齒及火煙意象；盤曲長軀、角冠、背棘與藍白吐息是遊戲幻想，不主張對應特定現生物種。 |
| `kun` 鯤 | [中國哲學書電子化計劃：《莊子・逍遙遊》](https://ctext.org/zhuangzi/enjoyment-in-untroubled-ease) | 巨魚化鵬的母題沒有指定解剖構造；寬厚魚身、金眼、翼狀鰭及化鵬光影皆為本作演繹。原中文頁直接存取受限，已用該站可檢索文本核對開篇。 |

## 程式接點與驗證

- `abyssPoly`、`abyssEye`、`abyssFan`、`abyssFangs` 提供共用向量構件；`DDRAW` 保持原本 16 個 ID。
- `megTooth`、`drawMeg`、`drawMegFront`、`drawMosa`、`drawDunk`、`drawGHead` 更新巨獸構造；`GSCENE` 保留原本 8 個 ID 與演出時長。
- `giantThumb` 的 5 個幻想種縮圖直接使用同一組場景函式，避免縮圖仍顯示舊模型。物種 ID、捕獲費用、研究收益、所有權、互動入口與保存格式不在本次造型修改範圍。
- 執行 `node scripts/validate-game.cjs`，檢查 16 種深淵和 8 種巨獸的 Canvas 參數、既有 206 物種、304 花色及遊戲存檔回歸。Canvas mock 只能檢查執行與有限數值；畫面排版與實際像素仍需瀏覽器視覺檢查。
