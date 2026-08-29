# Minecraft 26.3 Math Library

Minecraft Java Edition 26.3 Snapshot 10 向けの、依存関係なしで動く 32-bit float 数学データパックです。データパック形式は `118` で、`compute` と `minecraft:number_provider` を使います。実行時の Mod、プラグイン、ライブラリは不要です。

## インストール

リポジトリの `Math` ディレクトリを、対象ワールドの `datapacks/Math` にコピーします。ワールドを開き直すか `reload` を実行し、必要なら `datapack list enabled` で有効化を確認してください。対象バージョン以外ではコマンドや provider codec の互換性を保証しません。

## ストレージ API

呼び出し側は必要な値を `storage math:` に書き、`function #math:<name>` を実行します。公開関数だけが同名の function tag に登録されているため、`function #math:` の補完を公開 API 一覧として使用できます。数値は有限な float 値として毎回設定してください。

`Math/data/math/function` 以下の実装 ID は非公開で不安定です。サポート対象のエントリーポイントは `function #math:<name>` のみです。`math:internal/*` はタグへ登録されておらず、内部実装なので直接呼び出さないでください。

| フィールド | 用途 |
|---|---|
| `a` | 単項入力、または左オペランド |
| `b` | 右オペランド |
| `min`, `max` | `clamp` の下限と上限、または `bezier` の最大tick (`max`) |
| `t` | `lerp` の補間量、または `bezier` の経過tick |
| `curve` | `bezier` の4要素の数値リスト `[x1,y1,x2,y2]` |
| `ans` | 成功時の float 結果 |
| `error` | 失敗時のエラー ID（文字列） |

単項関数は `a`、二項関数は `a` と `b`、`clamp` は `a/min/max`、`lerp` は `a/b/t`、`bezier` は `a/b/t/max/curve` を読みます。定数関数は入力を読みません。公開入力は変更されません。

- 成功: 古い `error` を削除し、float の `ans` を書き、function result `1` を返します。
- 失敗: 古い `ans` を削除し、`error` を書き、function result `0` を返します。

作業領域は別の `storage math:internal` にあります。ルート名が `x`、`y`、`z`、`w` で始まる値は不安定な内部 scratch state で、呼び出し後に残ることがあります。読み書きしたり、構造や値に依存したりしないでください。

## 公開関数

| 分類 | 関数 | 定義・入力 |
|---|---|---|
| 基本演算 | `add`, `subtract`, `multiply`, `divide` | `a+b`, `a-b`, `a*b`, `a/b` |
| 逆数・剰余 | `reciprocal`, `remainder`, `modulo` | `1/a`; `a-truncate(a/b)*b`; `a-floor(a/b)*b` |
| 比較・制限 | `absolute`, `sign`, `minimum`, `maximum`, `clamp` | `abs(a)`, `sign(a)`, `min(a,b)`, `max(a,b)`, `[min,max]` への制限 |
| 丸め | `floor`, `ceil`, `round`, `truncate` | 整数値を float で返す |
| 累乗・超越 | `square`, `cube`, `square_root`, `power`, `exp`, `log` | `a²`, `a³`, `sqrt(a)`, `a^b`, `e^a`, 自然対数 `ln(a)` |
| 三角関数（rad） | `sin`, `cos`, `tan` | `a` をラジアンとして扱う |
| 三角関数（degree） | `sin_degrees`, `cos_degrees`, `tan_degrees` | `a` を度として扱う |
| 角度変換 | `rad`, `deg` | `rad`: 度 → ラジアン、`deg`: ラジアン → 度 |
| 定数 | `pi`, `tau`, `e` | `π`, `2π`, `e`; 入力を無視する |
| 補間 | `lerp`, `bezier` | 線形補間; CSS互換のcubic-bezier時間補間 |

`round(a)` は `floor(a + 0.5)` です。たとえば `round(1.5)=2`、`round(-1.5)=-1` となります。

`power` は、正の底では実数指数を扱います。負の底は `b` が正確な整数のときだけ使用でき、`power(0,0)=1`、`power(0,b>0)=0` です。ゼロの負数乗は失敗します。

`bezier` は `u=clamp(t/max,0,1)` を曲線のx座標として、`curve:[x1,y1,x2,y2]` で指定したCSS `cubic-bezier(x1,y1,x2,y2)` のy座標を求め、`a` から `b` を補間します。`curve` の各要素は任意の数値NBT型を受理し、演算時にbinary32へ変換します。`x1` と `x2` は `[0,1]`、`y1` と `y2` は有限値なら範囲外も指定でき、オーバーシュートを表現できます。`t<=0` は正確に `a`、`t>=max` は正確に `b` を返します。

## エラー

| `error` | 条件 |
|---|---|
| `division_by_zero` | `divide`、`reciprocal`、`remainder`、`modulo` の除数が `+0` または `-0` |
| `negative_square_root` | `square_root` の入力が負 |
| `undefined_tangent` | tangent の極を安全に除外できない |
| `non_real_result` | `log(a<=0)`、または負の底に非整数指数を指定 |
| `zero_to_negative_power` | `power(0,b<0)` |
| `invalid_clamp_range` | `clamp` で `min>max` |
| `invalid_duration` | `bezier` で `max<=0` |
| `invalid_curve` | `curve` が4要素でない、または `x1` / `x2` が `[0,1]` の範囲外 |
| `invalid_number` | 必須入力が非有限値 |
| `result_out_of_range` | 計算結果を有限 binary32 として表現できない |

## 数値モデルと精度

provider の定数、storage 読み出し、各 aggregate 演算で Java の binary32 相当へ丸めます。そのため、実数式を一度だけ丸めた結果とは異なる場合があります。`remainder` と `modulo` は binary32 値を厳密な dyadic reduction で処理します。

| 対象 | 公開保証 | 現在の offline 検証での最大値（代表） |
|---|---|---|
| `reciprocal` | 有限結果で相対誤差 `<= 0.00001` | `7.36e-7`（20,000 samples） |
| `divide` | normal 結果は相対誤差 `<= 0.00001`; subnormal は最小 subnormal の 1 ULP 以内 | normal `0`; subnormal `1 ULP`（12,288 境界 cases を含む） |
| `square_root` | 相対誤差 `<= 0.00001` | `2.37e-7`（10,000 samples） |
| `log` | 相対誤差 `<= 0.00001`（ゼロ近傍は絶対誤差） | `1.90e-7`（10,000 samples） |
| `exp` | 相対誤差 `<= 0.00001`; subnormal は最小 normal で scale した絶対誤差 | `4.11e-6`（10,000 samples） |
| `power` | 相対誤差 `<= 0.00005`; subnormal は同じ scale 規則 | `7.57e-6`（overflow 境界帯） |
| `bezier` | x座標の逆算に20回の二分探索を使用 | パラメータ区間幅 `<= 2^-20` |
| `sin`, `cos` | `[-100,100]` rad で絶対誤差 `<= 0.00001` | `3.60e-6` 以下 |
| `sin_degrees`, `cos_degrees` | `[-5000,5000]` degree で絶対誤差 `<= 0.00001` | `6.89e-6` 以下 |

`tan` / `tan_degrees` は極の近くに一律の誤差上限を持ちません。保証範囲内では、近似 cosine の guard を `0.00002` とすることで、真の `abs(cos)<=0.00001` を必ず `undefined_tangent` にします。この安全側判定により、真の `abs(cos)` が最大およそ `0.00003` の値も拒否する場合があります。

保証範囲を超える有限角も受け付けますが、binary32 の入力や周期定数で位相情報が失われるほど精度は低下します。`sin` と `cos` は巨大な有限角にも有限値を返しますが、保証範囲外の実数角としての精度保証はありません。tangent は位相不確かさを上向きに見積もって guard を広げ、極を否定できない場合は保守的に `undefined_tangent` を返します。現在は概ね `3.59e7` rad、`6.02e8` degree 付近から全面的な拒否領域になります。

Snapshot 10 では predicate 内の number provider が整数モードで評価されます。この実装は必要な float 比較を `math:internal` に一度 materialize してから判定します。この staged comparison は内部実装であり、公開 API ではありません。

## 使用例

12 を 5 で割ります。

```mcfunction
data modify storage math: a set value 12.0f
data modify storage math: b set value 5.0f
function #math:divide
data get storage math: ans
```

度をラジアンへ変換して sine を求める例です。

```mcfunction
data modify storage math: a set value 30.0f
function #math:rad
data modify storage math: a set from storage math: ans
function #math:sin
data get storage math: ans
```

power と失敗結果の確認例です。

```mcfunction
data modify storage math: a set value -2.0f
data modify storage math: b set value 0.5f
function #math:power
data get storage math: error
```

20 tickで0から100へcubic-bezier補間する例です。

```mcfunction
data modify storage math: t set value 10.0f
data modify storage math: max set value 20.0f
data modify storage math: a set value 0.0f
data modify storage math: b set value 100.0f
data modify storage math: curve set value [0.17f,0.67f,0.83f,0.67f]
function #math:bezier
data get storage math: ans
```

## 生成と検証

大きな provider/predicate/function graph は `tools/generate-math-providers.mjs` が決定的に生成します。生成物を直接編集せず、リポジトリルートで次を実行してください。

```powershell
node tools/generate-math-providers.mjs
node tools/generate-math-providers.mjs --check
```

`tools/generated-math-files.json` は生成コマンドと全生成 asset の manifest です。通常生成は manifest を更新し、`--check` は OS の一時ディレクトリで再生成して byte comparison するため、作業ツリーを書き換えません。Node.js の第三者 package は使いません。

offline の static、provider evaluator、function behavior、数値・境界テストは次で実行します。

```powershell
node --test
```

公式サーバー統合は Java 25 と 26.3 Snapshot 10 server JAR を明示して実行します。

```powershell
pwsh -NoProfile -File tools/integration-test.ps1 `
  -MinecraftServerJar "C:\Users\nea\AppData\Local\Temp\minecraft-26.3-snapshot-10-server.jar" `
  -JavaExecutable "C:\Program Files (x86)\Minecraft Launcher\runtime\java-runtime-epsilon\windows-x64\java-runtime-epsilon\bin\java.exe"
```

ハーネスは OS temp 直下に一意な `math-pack-test-*` を作り、データパックと assertion pack を置いて成功・失敗 return、`ans` / `error` cleanup、代表的な数値境界を検証します。終了時にはその一時ディレクトリだけを削除します。server JAR、EULA、world、logs、libraries などのサーバー runtime はリポジトリに生成・保存しません。
