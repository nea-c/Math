# Math

四則演算、三角関数、補間、クォータニオン変換などの数値計算を提供するライブラリデータパック。

## 最新

r1

## 動作要件

Minecraft Java Edition 26.3 Pre-Release 1 以降

データパック形式119の `context_float_provider` を使用します。基本演算、丸め、三角関数、平方根、累乗などは26.3で追加された公式のfloat providerで計算します。

## 使用方法

リポジトリの `Math` ディレクトリを、使用するワールドの `datapacks` ディレクトリへ入れてください。

必要な値を `storage math:` に書き込み、対応するfunctionタグを実行します。

```mcfunction
# 12 / 5を計算する
data modify storage math: a set value 12.0f
data modify storage math: b set value 5.0f
function #math:div
data get storage math: ans
```

実行前に古い `ans` は削除され、計算結果が得られた場合だけ新しい値が入ります。function resultによる成功・失敗は返しません。

- 入力値は変更されません。
- すべての数値入力は有限値で指定し、32-bit floatとして評価されます。
- 下表の有効入力条件を満たさない入力の動作は未定義です。
- 無効な入力に対する `ans` の存在・型・値は保証しません。
- `internal` は非公開scratchであり、通常終了後に削除されます。
- 公開APIは `#math:<関数名>` です。`storage math: internal` と `Math/data/math/function` 内のprivate implementation functionは実装詳細であり、直接参照・実行しないでください。

### 入出力

| フィールド | 用途 |
| :- | :- |
| `a` | 単項入力、または左オペランド |
| `b` | 右オペランド |
| `min`, `max` | `clamp` の下限と上限。補間APIでは `max` を終了tickとして使用 |
| `t` | 補間量、または経過tick |
| `curve` | `bezier` の制御点 `[x1,y1,x2,y2]` |
| `amplitude`, `period` | `elastic` の振幅倍率と1周期のtick数 |
| `oscillations`, `damping` | `elastic_decay` の振動回数と減衰率 |
| `bounces`, `decay` | `bounce_decay` の跳ねる回数と減衰率 |
| `rotation` | クォータニオン `[x,y,z,w]` |
| `ans` | 計算結果 |

### API一覧

#### 基本演算

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :-: | :- | :- |
| `#math:add` | `a`, `b` | `a + b` | `a`, `b`が有限で、数学的結果が有限floatに収まる |
| `#math:sub` | `a`, `b` | `a - b` | `a`, `b`が有限で、数学的結果が有限floatに収まる |
| `#math:mul` | `a`, `b` | `a * b` | `a`, `b`が有限で、数学的結果が有限floatに収まる |
| `#math:div` | `a`, `b` | `a / b` | `a`, `b`が有限、`b != 0`、商が有限floatに収まる |
| `#math:reciprocal` | `a` | `1 / a` | `a`が有限、`a != 0`、逆数が有限floatに収まる |
| `#math:remainder` | `a`, `b` | 切り捨て除算を基準にした剰余 | `a`, `b`が有限、`b != 0` |
| `#math:mod` | `a`, `b` | floor除算を基準にした剰余 | `a`, `b`が有限、`b != 0` |
| `#math:abs` | `a` | 絶対値 | 必須入力が有限 |
| `#math:sign` | `a` | 符号 | 必須入力が有限 |
| `#math:min` | `a`, `b` | 小さい方の値 | 必須入力が有限 |
| `#math:max` | `a`, `b` | 大きい方の値 | 必須入力が有限 |
| `#math:clamp` | `a`, `min`, `max` | `a` を `min` 以上 `max` 以下に制限 | `a`, `min`, `max`が有限、`min <= max` |

#### 丸め

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :-: | :- | :- |
| `#math:floor` | `a` | 負の無限大方向へ丸める | `a`が有限 |
| `#math:ceil` | `a` | 正の無限大方向へ丸める | `a`が有限 |
| `#math:round` | `a` | `floor(a + 0.5)` | `a`が有限 |
| `#math:truncate` | `a` | 0方向へ丸める | `a`が有限 |

結果はいずれもfloatで返します。`round(-1.5)` は `-1.0f` です。

#### 累乗・指数・対数

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :-: | :- | :- |
| `#math:square` | `a` | `a²` | `a`が有限で、結果が有限floatに収まる |
| `#math:cube` | `a` | `a³` | `a`が有限で、結果が有限floatに収まる |
| `#math:sqrt` | `a` | 平方根 | `a`が有限、`a >= 0` |
| `#math:pow` | `a`, `b` | `a` の `b` 乗 | `a`, `b`が有限。`a < 0`なら`b`は整数。`a == 0`なら`b >= 0`。結果が有限floatに収まる |
| `#math:exp` | `a` | `e` の `a` 乗 | `a`が有限、`a <= 88.72283172607422f` |
| `#math:log` | `a` | 自然対数 | `a`が有限、`a > 0` |

`pow` は正の底で実数指数を扱えます。負の底では `b` が整数の場合のみ有効です。`pow(0,0)` は `1.0f` です。

#### 三角関数

| functionタグ | 入力 | 単位・計算内容 | 有効入力 |
| :- | :-: | :- | :- |
| `#math:sin` | `a` | ラジアン | `a`が有限 |
| `#math:cos` | `a` | ラジアン | `a`が有限 |
| `#math:tan` | `a` | ラジアン | `a`が有限で、正接が定義され安全に有限floatで表現できる |
| `#math:sin_degrees` | `a` | 度 | `a`が有限 |
| `#math:cos_degrees` | `a` | 度 | `a`が有限 |
| `#math:tan_degrees` | `a` | 度 | `a`が有限で、正接が定義され安全に有限floatで表現できる |
| `#math:asin` | `a` | 結果をラジアンで返す | `a`が有限、`-1 <= a <= 1` |
| `#math:acos` | `a` | 結果をラジアンで返す | `a`が有限、`-1 <= a <= 1` |
| `#math:atan` | `a` | 結果をラジアンで返す | `a`が有限 |
| `#math:atan2` | `a`, `b` | `a=y`, `b=x` として結果をラジアンで返す | `a`, `b`が有限。`atan2(0,0)`は`0.0f` |
| `#math:asin_degrees` | `a` | 結果を度で返す | `a`が有限、`-1 <= a <= 1` |
| `#math:acos_degrees` | `a` | 結果を度で返す | `a`が有限、`-1 <= a <= 1` |
| `#math:atan_degrees` | `a` | 結果を度で返す | `a`が有限 |
| `#math:atan2_degrees` | `a`, `b` | `a=y`, `b=x` として結果を度で返す | `a`, `b`が有限。`atan2(0,0)`は`0.0f` |

`asin` と `acos` の入力範囲は `-1` 以上 `1` 以下です。`atan2(0,0)` は `0.0f` を返します。

```mcfunction
# atan2(y=1, x=-1)を度で求める
data modify storage math: a set value 1.0f
data modify storage math: b set value -1.0f
function #math:atan2_degrees
data get storage math: ans
```

#### 角度変換・定数

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :-: | :- | :- |
| `#math:rad` | `a` | 度からラジアンへ変換 | `a`が有限で、変換結果が有限floatに収まる |
| `#math:deg` | `a` | ラジアンから度へ変換 | `a`が有限で、変換結果が有限floatに収まる |
| `#math:pi` | なし | 円周率 `π` | 入力なし |
| `#math:tau` | なし | `2π` | 入力なし |
| `#math:e` | なし | ネイピア数 `e` | 入力なし |

#### 補間

`lerp` は `t` をそのまま補間係数として使用します。それ以外の補間APIは `t <= 0` で正確に `a`、`t >= max` で正確に `b` を返します。`max` には0より大きい値を指定してください。

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :- | :- | :- |
| `#math:lerp` | `a`, `b`, `t` | `t` を補間係数とした線形補間 | `a`, `b`, `t`が有限で、結果が有限floatに収まる |
| `#math:bezier` | `a`, `b`, `t`, `max`, `curve` | cubic-bezierによる補間 | `a`, `b`, `t`, `max`, `curve`の全要素が有限、`max > 0`、`curve`は4要素、`0 <= x1 <= 1`、`0 <= x2 <= 1` |
| `#math:elastic` | `a`, `b`, `t`, `max`, `amplitude`, `period` | 振幅と周期を指定するElastic Out | `a`, `b`, `t`, `max`, `amplitude`, `period`が有限、`max > 0`、`amplitude >= 1`、`period > 0` |
| `#math:elastic_decay` | `a`, `b`, `t`, `max`, `oscillations`, `damping` | 振動回数と減衰率を指定するElastic Out | 必須入力が有限、`max > 0`、`oscillations > 0`、`damping > 0` |
| `#math:bounce` | `a`, `b`, `t`, `max` | 3回の跳ね返りを行う一般的なBounce Out | `a`, `b`, `t`, `max`が有限、`max > 0` |
| `#math:bounce_decay` | `a`, `b`, `t`, `max`, `bounces`, `decay` | 跳ねる回数と減衰率を指定するBounce Out | 必須入力が有限、`max > 0`、`bounces > 0`、`decay >= 0`。精度保証は`bounces <= 30` |

`bezier` の `curve` はCSSと同じ `[x1,y1,x2,y2]` 形式です。`x1` と `x2` は0以上1以下、`y1` と `y2` は範囲外も指定できます。

`elastic` は `amplitude >= 1`、`period > 0` を受け取ります。`elastic_decay` は `oscillations > 0`、`damping > 0` を受け取ります。

`bounce_decay` は `bounces > 0`、`decay >= 0` を受け取ります。`bounces` は整数を推奨しますが、小数も使用できます。`decay=0` では跳ね返りの高さを維持し、値を大きくするほど早く減衰します。`bounces <= 30` が精度保証範囲です。それより大きい有限値も使用できますが、値が大きくなるほど波形の精度が低下します。跳ねる回数を増やしても実行コマンド数は増えません。

```mcfunction
# 20tickで0から100へ、3.5回の跳ねと減衰率3の補間を行う
data modify storage math: a set value 0.0f
data modify storage math: b set value 100.0f
data modify storage math: t set value 5.0f
data modify storage math: max set value 20.0f
data modify storage math: bounces set value 3.5f
data modify storage math: decay set value 3.0f
function #math:bounce_decay
data get storage math: ans
```

#### クォータニオン

`#math:quaternion_to_axis_angle` は `rotation:[x,y,z,w]` をaxis-angle形式へ変換します。

```mcfunction
data modify storage math: rotation set value [0.0f,0.70710677f,0.0f,-0.70710677f]
function #math:quaternion_to_axis_angle
data get storage math: ans
```

結果は次の形式です。角度の単位はラジアンです。

```snbt
{angle:<float>,axis:[<float>,<float>,<float>]}
```

入力は安全に正規化されるため、正規化済みである必要はありません。角度はクォータニオンの符号を保った `0` 以上 `2π` 以下となり、`q` と `-q` は同一視されません。回転軸を一意に決められない場合は `+Y` を返します。

| functionタグ | 入力 | 計算内容 | 有効入力 |
| :- | :- | :- | :- |
| `#math:quaternion_to_axis_angle` | `rotation` | `rotation:[x,y,z,w]` をaxis-angle形式へ変換 | `rotation`が有限float 4要素の`[x,y,z,w]`で、全要素が同時に0ではない |

## ライセンス

[MIT License](LICENSE) に基づく。

## 更新履歴

### r1

- 初版
- 基本演算、丸め、累乗、指数、対数APIを追加
- 三角関数、逆三角関数、角度変換、定数APIを追加
- Lerp、Bezier、Elastic、Bounce補間APIを追加
- クォータニオンからaxis-angleへの変換APIを追加
