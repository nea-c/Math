# Function Layout Redesign

## 目的

公開 API を function tag の `#math:<name>` に限定し、実装関数を処理単位で整理する。現在の `function/internal/*.mcfunction` という一括配置を廃止し、専用処理は公開関数と同じフォルダ、複数の公開関数から再利用する汎用処理は `.common` 配下へ移す。

この変更は関数IDの互換性を維持しない。`function math:add` などの直接呼び出しは廃止し、利用者は `function #math:add` を使用する。

## 公開 API

- 現在の34個の公開名を維持する。
- 公開名ごとに `data/math/tags/function/<name>.json` を1つ用意する。
- 各タグは対応する実装入口 `math:<name>/0.start` だけを参照する。
- `.common` の関数を参照するタグは作らない。
- 公開関数の追加・削除時は、実装入口、タグ、README、テストを同時に更新する。

例:

```json
{
  "values": [
    "math:add/0.start"
  ]
}
```

呼び出し例:

```mcfunction
function #math:add
```

## ディレクトリ規則

公開関数とその専用処理は、`data/math/function/<public-name>/` の直下へ置く。このフォルダより深い専用サブフォルダは作らない。

```text
function/
├─ add/
│  └─ 0.start.mcfunction
├─ divide/
│  ├─ 0.start.mcfunction
│  ├─ 1.normalize.mcfunction
│  ├─ 2.normalize_scale_down.mcfunction
│  ├─ 3.normalize_scale_up.mcfunction
│  └─ 4.underflow.mcfunction
```

複数の公開関数から参照される汎用処理は、`data/math/function/.common/<module>/` の直下へ置く。`.common/<module>/` より深いフォルダは作らない。

```text
function/
└─ .common/
   ├─ reciprocal/
   │  ├─ 0.start.mcfunction
   │  ├─ 1.scale_down.mcfunction
   │  ├─ 2.scale_up.mcfunction
   │  └─ 3.finish.mcfunction
   ├─ normalize_period/
   │  ├─ 0.start.mcfunction
   │  └─ 1.negative.mcfunction
   └─ invalid_number/
      └─ 0.start.mcfunction
```

`internal/` と `common/` は作らない。汎用処理の予約名は先頭にドットを付けた `.common` とする。

## ファイル命名規則

- 各フォルダの入口は必ず `0.start.mcfunction` とする。
- 後続ファイルは、そのフォルダ内で最初に到達する処理順に `1.*`、`2.*` と採番する。
- 分岐する処理は、入口ファイル内で分岐が現れる順に採番する。
- 別フォルダへ移ると番号を `0.start` から再開する。
- ファイル名は `<number>.<role>.mcfunction` とする。
- role は小文字の snake_case とする。
- ファイルとフォルダの同名併置は行わない。
- 深い階層を作る代わりに、`2.normalize_scale_down.mcfunction` のように役割をファイル名へ含める。

既存の `00.mcfunction` 形式は関数ツリーでは使用しない。number provider、predicateなど関数以外の既存命名はこの変更の対象外とする。

## 配置の判断

ある処理をどこへ置くかは、次の順で判断する。

1. 1つの公開関数からしか参照されない場合、その公開関数のフォルダへ置く。
2. 2つ以上の公開関数、または複数の汎用モジュールから参照される場合、`.common/<module>/` へ置く。
3. 公開関数自身の入力検証、storage API処理、`ans`・`error`・function resultの確定は、公開フォルダの `0.start` に残す。
4. `.common` は計算核または共通エラー終了処理だけを担当し、公開入力の契約を持たない。

想定する主な汎用モジュールは次のとおり。

- `reciprocal`: divide、square_root、tan系から使う逆数計算核
- `floor` と `truncate`: 丸め関数、exp、powerから使う内部計算
- `reduce_remainder`: remainder、modulo、周期正規化から使う剰余削減
- `normalize_period`: sin、cos、tan系から使う周期正規化
- `sin`、`cos`、`tan`: radian版とdegree版で共有する三角関数計算核
- `log` と `exp`: 公開関数とpowerで共有する超越関数計算核
- `invalid_number` と `result_out_of_range`: 複数の公開関数で共有する終了処理

一方、divideの仮数正規化、square_rootの正規化、powerの符号・境界分類などは各公開関数専用なので、それぞれの公開フォルダへ置く。

## 呼び出し構造

公開呼び出しは常にタグを経由する。

```text
#math:divide
  -> math:divide/0.start
     -> math:divide/1.normalize
     -> math:.common/reciprocal/0.start
```

データパック内部ではタグを再経由せず、実装関数IDを直接呼ぶ。これにより、公開APIと内部の制御フローを分離し、タグの複数値実行という意味を内部処理へ持ち込まない。

## 生成器とmanifest

`tools/generate-math-providers.mjs` のfunction出力先と、生成されるfunction内の参照先を新しいIDへ変更する。公開関数の生成では、対応するfunction tagも決定的に生成する。`tools/generated-math-files.json` は移動後のfunctionとtagを列挙し、旧ルート関数と`function/internal/`を生成対象から削除する。

通常生成後に旧manifestだけに存在する生成物を削除する既存動作を利用し、古い関数ファイルを残さない。手作業で生成済み関数を移動して二重管理しない。

## テスト

以下を自動検証する。

- 公開34タグが存在し、それぞれが `<name>/0.start` の1関数だけを参照する。
- タグの集合とREADMEで宣言する公開APIの集合が一致する。
- `function/` 直下に `.mcfunction` が存在しない。
- `function/internal/` と `function/common/` が存在しない。
- 公開フォルダと `.common/<module>/` より深い関数ディレクトリが存在しない。
- 各関数フォルダに `0.start.mcfunction` が存在する。
- 全ファイルが `<number>.<role>.mcfunction` 形式で、同一フォルダ内の番号が重複しない。
- mcfunctionとtagの全参照が解決する。
- offline function harnessは公開タグから入口を解決して既存の数値・エラー契約を検証する。
- Snapshot 10統合テストは `function #math:<name>` だけを使って実行する。
- `node tools/generate-math-providers.mjs --check`、`node --test`、Snapshot 10統合テストを通す。

## 非対象

- storageの公開フィールド、戻り値、エラーID、数値精度は変更しない。
- number providerとpredicateの`internal`パスや数値付きファイル名は変更しない。
- 公開関数の追加・削除や計算アルゴリズムの変更は行わない。
- 旧 `function math:<name>` に対する互換aliasは作らない。
