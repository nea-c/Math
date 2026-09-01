# Storage-only Runtime Design

## 目的

公開関数の契約を `storage math:` の入出力だけに単純化する。ライブラリ独自の入力検証、結果検証、`error` 出力、function resultによる成功・失敗通知を廃止し、Minecraft 26.3系のnumber providerと`data ... compute`の挙動をそのまま受け入れる。

同時に、計算用の一時値を公開storage内の単一compoundへまとめ、各公開呼び出しの終了時に一括削除する。計算後のscratch stateは公開せず、次の呼び出しへ持ち越さない。

この設計は、従来のエラー契約とfunction result契約について後方互換性を維持しない。

## 公開API

利用者は従来どおり、必要な入力を`storage math:`へ書き込み、`function #math:<name>`を実行する。

- 公開入力フィールドと公開function tag名は維持する。
- 計算結果は`storage math: ans`だけで返す。
- `storage math: error`は出力しない。
- 公開関数は成功値、失敗値、result値を返さない。
- `execute store success ... run function #math:<name>`と`execute store result ... run function #math:<name>`の結果はAPIとして保証しない。
- 有効かつ対応範囲内の入力に対する数値結果と精度契約は維持する。

各公開呼び出しは計算前に既存の`ans`を削除する。これにより、結果が書き込まれなかった場合に以前の結果を今回の結果として誤用しない。

従来の`error`がstorageに残っている場合の混乱を避けるため、公開入口は既存の`error`も削除する。ただし新しい`error`は書き込まない。

## 無効入力の扱い

欠損値、非数値、NaN、Infinity、定義域外、オーバーフローなどの無効入力に対する結果は未定義とする。

- ライブラリ独自のfinite検査やdomain errorへの変換は行わない。
- `data ... compute`が値を`0.0f`として扱う場合は、その結果を受け入れる。
- provider評価または代入が結果を書かなかった場合は、入口で削除された`ans`が欠損したままでもよい。
- 無効入力に対して`ans`の存在、型、値は保証しない。
- 無効入力によって、後続の有効な公開呼び出しが古い`ans`やscratchを読むことは許可しない。

計算アルゴリズムの分岐に必要なpredicateは残す。削除対象は、公開エラーを生成するためだけの入力検証、結果検証、エラー用predicate、finite provider、エラー終了関数である。

## READMEの入力契約

実行時検証を削除しても利用者が有効入力を判断できるよう、READMEを入力契約の正本として更新する。検証resourceを削除する前に、現在コード化されている制約をREADMEへ移す。

公開function一覧には、各functionについて次を明記する。

- 必須入力フィールドとNBTの型または構造
- 各数値入力が有限値である必要
- 個別の定義域、符号、大小関係、非ゼロ条件
- `min <= max`のような入力間の制約
- easing系のduration、周期、回数、減衰値などの有効範囲
- curve、quaternionなど複合入力の要素数と要素ごとの制約
- 有効入力でも出力範囲に制限がある場合、その制限

単に「無効入力は未定義」と書くだけで済ませず、利用者が事前に検証できる具体的な条件を記載する。境界値を含むかどうかも、`0 < max`、`-1 <= a <= 1`、`b != 0`のように曖昧さのない表記にする。

同一制約を持つfunctionは共通注記を参照してよいが、各functionの行だけを読んでも必要な制約へ到達できるようにする。実装後のテストは、全公開functionがREADMEの入力契約表に存在することを検証する。

## Scratch storage

従来の独立した`storage math:internal`は使用しない。すべての一時値を`storage math:`直下の`internal` compoundへ移す。

```text
storage math:
├─ a, b, min, max, t, ...
├─ ans
└─ internal
   ├─ x
   ├─ y
   ├─ z
   └─ w_*
```

provider、predicate、mcfunctionからの参照も同じ配置へ統一する。

```mcfunction
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float math:<provider>
data remove storage math: internal
```

`internal`は実行中だけ存在する非公開scratchであり、値や構造に互換性を持たせない。公開関数が`ans`を確定した後、公開入口へ制御が戻った時点でcompound全体を削除する。通常実行では入口での`internal`初期化を追加しない。

サーバー停止、command chain limitなど、公開入口自身が最後まで実行されない異常終了時のcleanupは保証しない。この場合も、次に行う有効な公開呼び出しが必要なscratchを代入前に読まないことを生成器とテストで保証する。

## 関数の制御フロー

公開関数は自然終了し、function resultを返さない。単純な関数は`0.start`内で直接計算し、最後に`internal`を削除する。

```mcfunction
# math:add/0.start
data remove storage math: error
data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: internal.y set from storage math: b
data modify storage math: ans set compute default float math:.common/add
data remove storage math: internal
```

早期終了や複数段の分岐を必要とする関数では、`0.start`を公開ラッパーとして使う。ラッパーは内部実装を`return run function`ではなく通常の`function`で呼び、内部実装が戻った後にcleanupして自然終了する。

```mcfunction
# math:<name>/0.start
data remove storage math: error
data remove storage math: ans
function math:<name>/1.compute
data remove storage math: internal
```

内部実装では、後続処理を止めるための早期`return`を使用してよい。その返り値は通常の`function`呼び出しで公開ラッパーに吸収され、公開APIには伝播しない。

無条件の末尾`return 1`と、成功値を祖先へ伝播するためだけの`return run function`は削除する。別の内部関数が制御フローとして返り値を消費している箇所では、必要な早期`return`を残すか、通常のfunction呼び出しへ組み直す。公開`0.start`はどの経路でも`return`を実行しない。

## 生成器と生成物

`tools/generate-math-providers.mjs`を唯一の生成元として更新し、生成済みファイルを直接二重管理しない。

生成器は次を行う。

- `storage math:internal <path>`を`storage math: internal.<path>`へ変換する。
- 公開入口から入力・結果のエラー検証とエラー出力を削除する。
- 検証専用のprovider、predicate、`.common/_error`関数を生成対象から削除する。
- アルゴリズム制御に必要なpredicateと中間値は維持する。
- 公開入口を自然終了させる。
- 分岐型の公開処理を必要に応じてprivate compute関数へ分離し、公開入口でcleanupする。
- manifestを再生成し、不要になった生成物を削除する。

READMEからエラーID一覧、成功・失敗の説明、function resultの契約を削除する。代わりに、全公開functionの有効入力範囲、無効入力が未定義であること、`internal`が実行後に削除されることを記載する。

## テスト

自動テストでは次を検証する。

- 有効入力に対する既存の数値結果と精度テストが維持される。
- 全公開`0.start`が自然終了し、`return 1`、`return fail`、`return run function`を公開結果として使用しない。
- 全公開呼び出しが実行前に`ans`を削除する。
- 全公開呼び出しの通常終了後に`storage math: internal`が存在しない。
- 連続した公開呼び出しで、前回のscratchまたは`ans`を次回の結果として使用しない。
- `storage math: error`へ書き込む生成関数が存在しない。
- provider、predicate、mcfunctionに旧`storage math:internal`参照が残っていない。
- 検証専用resourceと`.common/_error`関数がmanifestおよび生成物に残っていない。
- 全公開functionがREADMEの入力契約表に含まれ、削除前の検証条件が文書化されている。
- function tag、function、provider、predicateの全参照が解決する。
- 生成物check、Node.jsテスト、現行Minecraftサーバー統合テストが通る。

無効入力の具体的な`ans`値は未定義なので、数値結果として固定しない。ただし、以前の`ans`が残らないことと、次の有効呼び出しが正常に計算できることは検証する。

## 非対象

- 公開function tag名や入力フィールド名の追加・変更
- 有効入力に対する計算アルゴリズムまたは精度目標の変更
- 無効入力に対する共通fallback値の実装
- function resultによる新しい成功・失敗APIの追加
- 実行後のscratchをデバッグAPIとして公開すること

## 既存設計との差分

この設計は、過去の設計書にある次の契約を置き換える。

- `storage math:internal`を独立scratch storageとして維持する契約
- `storage math: error`へエラーIDを書き込む契約
- 公開関数が`return 1`または`return fail`で成否を返す契約
- 公開入口がfinite検査と結果範囲検査を担当する契約

過去の設計書に記載された公開名、function tag経由の呼び出し、ファイル配置、valid inputの数値精度に関する契約は引き続き有効とする。
