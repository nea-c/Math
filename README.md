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
| `t` | `lerp` の補間量、または時間補間関数の経過tick |
| `curve` | `bezier` の4要素の数値リスト `[x1,y1,x2,y2]` |
| `amplitude`, `period` | `elastic` の振幅倍率と1周期のtick数 |
| `oscillations`, `damping` | `elastic_decay` の全区間の振動回数と指数減衰率 |
| `bounces`, `decay` | `bounce_decay` の跳ね密度と指数減衰率 |
| `rotation` | `quaternion_to_axis_angle` の quaternion `[x,y,z,w]` |
| `ans` | 成功時の float 結果（`quaternion_to_axis_angle` のみ `{angle:<float>,axis:[<float>,<float>,<float>]}`） |
| `error` | 失敗時のエラー ID（文字列） |

単項関数は `a`、二項関数は `a` と `b`、`atan2` は一般的な `atan2(y,x)` に対して `a=y`, `b=x`、`clamp` は `a/min/max`、`lerp` は `a/b/t`、`bezier` と `bounce` は `a/b/t/max`（`bezier` は加えて `curve`）、`elastic` は `a/b/t/max/amplitude/period`、`elastic_decay` は `a/b/t/max/oscillations/damping`、`bounce_decay` は `a/b/t/max/bounces/decay`、`quaternion_to_axis_angle` は `rotation` を読みます。定数関数は入力を読みません。公開入力は変更されません。

- 成功: 古い `error` を削除し、float の `ans` を書き、function result `1` を返します。例外として `quaternion_to_axis_angle` は compound の `ans` を書きます。
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
| 逆三角関数（rad） | `asin`, `acos`, `atan`, `atan2` | ラジアンを返す。`atan2(a,b)` は象限を考慮 |
| 逆三角関数（degree） | `asin_degrees`, `acos_degrees`, `atan_degrees`, `atan2_degrees` | 対応する角度を度で返す |
| 角度変換 | `rad`, `deg` | `rad`: 度 → ラジアン、`deg`: ラジアン → 度 |
| 定数 | `pi`, `tau`, `e` | `π`, `2π`, `e`; 入力を無視する |
| 補間 | `lerp`, `bezier`, `elastic`, `elastic_decay`, `bounce`, `bounce_decay` | 線形補間; CSS互換cubic-bezier; Elastic Out 2種; Bounce Out 2種 |
| quaternion | `quaternion_to_axis_angle` | `rotation:[x,y,z,w]` を `{angle,axis:[x,y,z]}` へ変換 |

`round(a)` は `floor(a + 0.5)` です。たとえば `round(1.5)=2`、`round(-1.5)=-1` となります。

`power` は、正の底では実数指数を扱います。負の底は `b` が正確な整数のときだけ使用でき、`power(0,0)=1`、`power(0,b>0)=0` です。ゼロの負数乗は失敗します。

`bezier` は `u=clamp(t/max,0,1)` を曲線のx座標として、`curve:[x1,y1,x2,y2]` で指定したCSS `cubic-bezier(x1,y1,x2,y2)` のy座標を求め、`a` から `b` を補間します。`curve` の各要素は任意の数値NBT型を受理し、演算時にbinary32へ変換します。`x1` と `x2` は `[0,1]`、`y1` と `y2` は有限値なら範囲外も指定でき、オーバーシュートを表現できます。`t<=0` は正確に `a`、`t>=max` は正確に `b` を返します。

`elastic` は一般的なElastic Out式を使用します。`amplitude>=1` は値幅 `abs(b-a)` に対する振幅倍率、`period>0` は1周期のtick数です。`u=t/max`、`s=period/tau*asin(1/amplitude)` として、補間係数 `1+amplitude*2^(-10u)*sin((t-s)*tau/period)` を求めます。

`elastic_decay` は振動と減衰を直接指定します。`oscillations>0` は全区間の振動回数、`damping>0` は正規化時間に対する指数減衰率です。`u=t/max` として、補間係数 `1-exp(-damping*u)*cos(tau*oscillations*u)` を求めます。

両Elastic関数とも係数を使って `a` から `b` を補間し、`t<=0` は正確に `a`、`t>=max` は正確に `b` を返します。

`bounce` は一般的な4区間の二次 Bounce Out 式を使用します。追加パラメータなしで、着地後に3回の小さな跳ね返りを表現します。

`bounce_decay` は少数を含む `bounces>0` と `decay>=0` を受け取ります。`u=t/max`、`phase=(bounces+0.5)*u+0.5`、`fraction=phase-floor(phase)`、`wave=1-(2*fraction-1)^2` として、補間係数 `1-exp(-decay*u)*wave` を求めます。`decay=0` では跳ね返りの高さを保ち、正の値では指数減衰します。整数の `bounces=N` は N 回跳ね返った後、`t=max` で自然に接地します。少数も受理し、最後の途中の弧は `t=max` で終了します。半周期ずらした放物線により、空中の頂点は滑らかに、接地時は鋭く折り返します。ループと三角関数を使わないため、跳ね密度を増やしても実行コマンド数は増えません。`bounces<=30` を精度保証範囲とし、それより大きい有限値も受理しますが、binary32で小数位相が失われるにつれて波形精度は低下します。

両Bounce関数とも係数を使って `a` から `b` を補間し、`t<=0` は正確に `a`、`t>=max` は正確に `b` を返します。

`asin` / `acos` と degree 版は有限な `a` が `[-1,1]` にあるときだけ成功します。端点は正確に `asin(-1)=-π/2`、`asin(0)=0`、`asin(1)=π/2`、`acos(-1)=π`、`acos(0)=π/2`、`acos(1)=0`（degree 版ではそれぞれ `-90/0/90` と `180/90/0`）を返します。範囲外は `non_real_result`、非有限値は `invalid_number` です。

`atan` は任意の有限な `a` を受け取り、`[-π/2,π/2]` の角度を返します。`atan2(a,b)` は `a=y`, `b=x` として象限を考慮し、実数上の規約は `(-π,π]`（degree版は `(-180,180]`）です。binary32への丸めで負のπまたは負の180度ちょうどになる場合があります。`atan2(0,0)=0` です。非常に小さい非ゼロ値はゼロへ丸めず、その符号と比を角度へ反映します。

`quaternion_to_axis_angle` は `rotation:[x,y,z,w]` を受け取り、各要素には byte、short、int、long、float、double を含む任意の数値 NBT を指定できます。すべて binary32 に変換してから、有限な非ゼロ quaternion を安全に正規化します。成功時の `ans` は float の `angle` と float 3要素の `axis` を持つ compound です。角度は符号を保って `[0,2*pi]` に入り、`q` と `-q` は同一視されません。ベクトル部がゼロの scalar quaternion では軸を常に `+Y` とし、`[0,0,0,1]` は角度 `0`、`[0,0,0,-1]` は `2*pi` です。4要素以外、非数値・非有限要素、または全ゼロ quaternion は `invalid_quaternion` で失敗します。

## エラー

| `error` | 条件 |
|---|---|
| `division_by_zero` | `divide`、`reciprocal`、`remainder`、`modulo` の除数が `+0` または `-0` |
| `negative_square_root` | `square_root` の入力が負 |
| `undefined_tangent` | tangent の極を安全に除外できない |
| `non_real_result` | `log(a<=0)`、負の底に非整数指数を指定、または inverse trig の `a` が `[-1,1]` 外 |
| `zero_to_negative_power` | `power(0,b<0)` |
| `invalid_clamp_range` | `clamp` で `min>max` |
| `invalid_duration` | `bezier`、`elastic`、`elastic_decay`、`bounce`、`bounce_decay` で `max<=0` |
| `invalid_curve` | `curve` が4要素でない、または `x1` / `x2` が `[0,1]` の範囲外 |
| `invalid_elastic` | `elastic` または `elastic_decay` の固有パラメータが許容範囲外 |
| `invalid_bounce` | `bounce_decay` で `bounces<=0` または `decay<0` |
| `invalid_number` | 必須入力が非有限値 |
| `invalid_quaternion` | quaternion が4要素でない、または数値かつ有限な非ゼロ quaternion でない |
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
| `elastic` | `asin(1/amplitude)` に20回の二分探索を使用 | 逆正弦の探索区間幅 `<= (pi/2)*2^-20` |
| `bounce` | 標準4区間の二次式 | 通常経路67コマンド、端点14コマンド |
| `bounce_decay` | `0<bounces<=30` で放物線位相を保証 | 通常経路95コマンド、端点22コマンド; `bounces=3.5` と `1000.25` で同数 |
| `sin`, `cos` | `[-100,100]` rad で絶対誤差 `<= 0.00001` | `3.60e-6` 以下 |
| `sin_degrees`, `cos_degrees` | `[-5000,5000]` degree で絶対誤差 `<= 0.00001` | `6.89e-6` 以下 |
| `asin`, `acos` | `[-1,1]` で絶対誤差 `<= 0.00000175` rad | 20回二分探索 + binary32 丸め |
| `asin_degrees`, `acos_degrees` | `[-1,1]` で絶対誤差 `<= 0.00011` degree | 20回二分探索 + binary32 丸め |
| `atan`, `atan2` | 全有限入力で絶対誤差 `<= 0.000002` rad | 13次奇数多項式 + 範囲縮小; 通常44 / 78コマンド |
| `atan_degrees`, `atan2_degrees` | 全有限入力で絶対誤差 `<= 0.00012` degree | 通常45 / 79コマンド |

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

0.5 の逆正弦をラジアンで求め、度へ変換する例です（結果は約 `30.0f`）。

```mcfunction
data modify storage math: a set value 0.5f
function #math:asin
data modify storage math: a set from storage math: ans
function #math:deg
data get storage math: ans
```

quaternion を axis-angle に変換する例です。`ans.angle` は約 `3*pi/2`、`ans.axis` は `+Y` です。

```mcfunction
data modify storage math: rotation set value [0.0f,0.70710677f,0.0f,-0.70710677f]
function #math:quaternion_to_axis_angle
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

20 tickで0から100へ、振幅1.0、6 tick周期のElastic Out補間を行う例です。

```mcfunction
data modify storage math: t set value 5.0f
data modify storage math: max set value 20.0f
data modify storage math: a set value 0.0f
data modify storage math: b set value 100.0f
data modify storage math: amplitude set value 1.0f
data modify storage math: period set value 6.0f
function #math:elastic
data get storage math: ans
```

20 tickで0から100へ、3.5回相当の跳ね密度と減衰率3でBounce Out補間する例です。

```mcfunction
data modify storage math: t set value 5.0f
data modify storage math: max set value 20.0f
data modify storage math: a set value 0.0f
data modify storage math: b set value 100.0f
data modify storage math: bounces set value 3.5f
data modify storage math: decay set value 3.0f
function #math:bounce_decay
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
