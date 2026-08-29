# Elastic Easing Design

## Goal

`bezier` と同じ時間補間 API に、調整方法の異なる2種類の Elastic Out 補間を追加する。

## Public API

### `#math:elastic`

- Inputs: `t`, `max`, `a`, `b`, `amplitude`, `period`
- Output: `ans`
- `amplitude` は値幅 `abs(b-a)` に対する振幅倍率で、`1.0` 以上を受理する。
- `period` は1周期のtick数で、`0.0` より大きい値を受理する。
- 正規化された進行値を `u=t/max` とし、Robert Penner 型の Elastic Out を使用する。
- 位相は `s=period/tau*asin(1/amplitude)`、補間係数は `1 + amplitude*2^(-10u)*sin((t-s)*tau/period)` とする。

### `#math:elastic_decay`

- Inputs: `t`, `max`, `a`, `b`, `oscillations`, `damping`
- Output: `ans`
- `oscillations` は全区間の振動回数で、`0.0` より大きい値を受理する。
- `damping` は正規化時間に対する指数減衰率で、`0.0` より大きい値を受理する。
- 正規化された進行値を `u=t/max` とし、補間係数は `1-exp(-damping*u)*cos(tau*oscillations*u)` とする。

両関数とも最終結果は `a+(b-a)*係数` とする。

## Shared behavior

- 公開入力は変更しない。
- 成功時は古い `error` を削除し、binary32 の `ans` と function result `1` を返す。
- `t<=0` は正確に `a`、`t>=max` は正確に `b` を返す。
- `max<=0` は `invalid_duration`。
- 必須入力が数値でない、または有限でない場合は `invalid_number`。
- 固有パラメータが許容範囲外の場合は `invalid_elastic`。
- 有限binary32に収まらない結果は `result_out_of_range`。
- 公開入口は `Math/data/math/tags/function/*.json` に置く。
- 実装は既存規約に従い `function/elastic/` と `function/elastic_decay/` に置き、ファイル名に処理順の番号を付ける。
- 汎用化できる逆正弦処理は `.common/asin_positive/` に置き、公開関数にはしない。

## Numerical approach

`elastic` が必要とする `asin(1/amplitude)` の入力範囲は `(0,1]` に限定される。内部の逆正弦は `[0,pi/2]` 上の二分探索で求め、既存の共通 sine 実装を評価に使用する。端点は公開関数側で正確に処理し、探索誤差が端点結果へ影響しないようにする。

