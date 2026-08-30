# Math

四則演算、三角関数、補間、クォータニオン変換などの数値計算を提供するライブラリデータパック。

## 最新

r1

## 動作要件

Minecraft Java Edition 26.3

## 使用方法

リポジトリの `Math` ディレクトリを、使用するワールドの `datapacks` ディレクトリへ入れてください。

必要な値を `storage math:` に書き込み、対応するfunctionタグを実行します。計算に成功すると `storage math: ans` に結果が入り、失敗すると `storage math: error` にエラーIDが入ります。

```mcfunction
# 12 / 5を計算する
data modify storage math: a set value 12.0f
data modify storage math: b set value 5.0f
function #math:divide
data get storage math: ans
```

- 成功時は古い `error` を削除し、function result `1` を返します。
- 失敗時は古い `ans` を削除し、function result `0` を返します。
- 入力値は変更されません。
- 数値には有限な値を指定してください。計算は32-bit floatを基準に行われます。
- 公開APIは `#math:<関数名>` です。`math:internal` や `Math/data/math/function` 内のfunctionは直接実行しないでください。

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
| `ans` | 成功時の計算結果 |
| `error` | 失敗時のエラーID |

### API一覧

#### 基本演算

| functionタグ | 入力 | 計算内容 |
| :- | :-: | :- |
| `#math:add` | `a`, `b` | `a + b` |
| `#math:subtract` | `a`, `b` | `a - b` |
| `#math:multiply` | `a`, `b` | `a * b` |
| `#math:divide` | `a`, `b` | `a / b` |
| `#math:reciprocal` | `a` | `1 / a` |
| `#math:remainder` | `a`, `b` | 切り捨て除算を基準にした剰余 |
| `#math:modulo` | `a`, `b` | floor除算を基準にした剰余 |
| `#math:absolute` | `a` | 絶対値 |
| `#math:sign` | `a` | 符号 |
| `#math:minimum` | `a`, `b` | 小さい方の値 |
| `#math:maximum` | `a`, `b` | 大きい方の値 |
| `#math:clamp` | `a`, `min`, `max` | `a` を `min` 以上 `max` 以下に制限 |

#### 丸め

| functionタグ | 入力 | 計算内容 |
| :- | :-: | :- |
| `#math:floor` | `a` | 負の無限大方向へ丸める |
| `#math:ceil` | `a` | 正の無限大方向へ丸める |
| `#math:round` | `a` | `floor(a + 0.5)` |
| `#math:truncate` | `a` | 0方向へ丸める |

結果はいずれもfloatで返します。`round(-1.5)` は `-1.0f` です。

#### 累乗・指数・対数

| functionタグ | 入力 | 計算内容 |
| :- | :-: | :- |
| `#math:square` | `a` | `a²` |
| `#math:cube` | `a` | `a³` |
| `#math:square_root` | `a` | 平方根 |
| `#math:power` | `a`, `b` | `a` の `b` 乗 |
| `#math:exp` | `a` | `e` の `a` 乗 |
| `#math:log` | `a` | 自然対数 |

`power` は正の底で実数指数を扱えます。負の底では `b` が整数の場合のみ成功します。`power(0,0)` は `1.0f`、0の負数乗はエラーです。

#### 三角関数

| functionタグ | 入力 | 単位・計算内容 |
| :- | :-: | :- |
| `#math:sin` | `a` | ラジアン |
| `#math:cos` | `a` | ラジアン |
| `#math:tan` | `a` | ラジアン |
| `#math:sin_degrees` | `a` | 度 |
| `#math:cos_degrees` | `a` | 度 |
| `#math:tan_degrees` | `a` | 度 |
| `#math:asin` | `a` | 結果をラジアンで返す |
| `#math:acos` | `a` | 結果をラジアンで返す |
| `#math:atan` | `a` | 結果をラジアンで返す |
| `#math:atan2` | `a`, `b` | `a=y`, `b=x` として結果をラジアンで返す |
| `#math:asin_degrees` | `a` | 結果を度で返す |
| `#math:acos_degrees` | `a` | 結果を度で返す |
| `#math:atan_degrees` | `a` | 結果を度で返す |
| `#math:atan2_degrees` | `a`, `b` | `a=y`, `b=x` として結果を度で返す |

`asin` と `acos` の入力範囲は `-1` 以上 `1` 以下です。`atan2(0,0)` は `0.0f` を返します。

```mcfunction
# atan2(y=1, x=-1)を度で求める
data modify storage math: a set value 1.0f
data modify storage math: b set value -1.0f
function #math:atan2_degrees
data get storage math: ans
```

#### 角度変換・定数

| functionタグ | 入力 | 計算内容 |
| :- | :-: | :- |
| `#math:rad` | `a` | 度からラジアンへ変換 |
| `#math:deg` | `a` | ラジアンから度へ変換 |
| `#math:pi` | なし | 円周率 `π` |
| `#math:tau` | なし | `2π` |
| `#math:e` | なし | ネイピア数 `e` |

#### 補間

`lerp` は `t` をそのまま補間係数として使用します。それ以外の補間APIは `t <= 0` で正確に `a`、`t >= max` で正確に `b` を返します。`max` には0より大きい値を指定してください。

| functionタグ | 入力 | 計算内容 |
| :- | :- | :- |
| `#math:lerp` | `a`, `b`, `t` | `t` を補間係数とした線形補間 |
| `#math:bezier` | `a`, `b`, `t`, `max`, `curve` | cubic-bezierによる補間 |
| `#math:elastic` | `a`, `b`, `t`, `max`, `amplitude`, `period` | 振幅と周期を指定するElastic Out |
| `#math:elastic_decay` | `a`, `b`, `t`, `max`, `oscillations`, `damping` | 振動回数と減衰率を指定するElastic Out |
| `#math:bounce` | `a`, `b`, `t`, `max` | 3回の跳ね返りを行う一般的なBounce Out |
| `#math:bounce_decay` | `a`, `b`, `t`, `max`, `bounces`, `decay` | 跳ねる回数と減衰率を指定するBounce Out |

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

成功時は次の形式で結果を返します。角度の単位はラジアンです。

```snbt
{angle:<float>,axis:[<float>,<float>,<float>]}
```

入力は安全に正規化されるため、正規化済みである必要はありません。角度はクォータニオンの符号を保った `0` 以上 `2π` 以下となり、`q` と `-q` は同一視されません。回転軸を一意に決められない場合は `+Y` を返します。全要素が0のクォータニオンはエラーです。

### エラー

| `error` | 条件 |
| :- | :- |
| `division_by_zero` | 除数が0 |
| `negative_square_root` | 負数の平方根を計算した |
| `undefined_tangent` | tangentの極付近で結果を安全に求められない |
| `non_real_result` | 実数として結果を求められない |
| `zero_to_negative_power` | 0の負数乗を計算した |
| `invalid_clamp_range` | `clamp` で `min > max` |
| `invalid_duration` | 補間APIで `max <= 0` |
| `invalid_curve` | `curve` の形式または範囲が不正 |
| `invalid_elastic` | Elastic固有の引数が範囲外 |
| `invalid_bounce` | `bounces <= 0` または `decay < 0` |
| `invalid_number` | 必須入力が有限値ではない |
| `invalid_quaternion` | クォータニオンの形式または値が不正 |
| `result_out_of_range` | 結果を有限な32-bit floatで表現できない |

## ライセンス

[MIT License](LICENSE) に基づく。

## 更新履歴

### r1

- 初版
- 基本演算、丸め、累乗、指数、対数APIを追加
- 三角関数、逆三角関数、角度変換、定数APIを追加
- Lerp、Bezier、Elastic、Bounce補間APIを追加
- クォータニオンからaxis-angleへの変換APIを追加
