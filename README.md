# Hearth Recipes

Hugo Book テーマをベースにした多言語対応の家庭料理レシピ集です。日本語 (`ja`) を既定にしつつ英語 (`en`) も提供し、各レシピは同じショートコードで構造化されたデータを持ちます。ここではリポジトリ全体の構造と、`content/` 以下にレシピページを追加する際の決まりをまとめます。

## ローカル開発・ビルド

- `hugo server -D --disableFastRender` — 下書きと多言語切り替えを含めたローカルプレビュー。
- `hugo --gc --minify` — 本番ビルド（`public/` に出力、ビルド後に `docs/` に反映して GitHub Pages に配置）。
- `hugo --i18n-warnings` — 翻訳漏れを検出してから PR を作成します。

## ディレクトリ早見表

| パス | 役割 |
| --- | --- |
| `hugo.toml` | サイト共通設定。Book テーマを Hugo Module として読み込み、多言語設定を宣言。 |
| `.github/workflows/deploy.yml` | GitHub Pages 用のビルド & デプロイワークフロー。`hugo --gc --minify --printI18nWarnings` を実行し `public/` を artifact にアップロード。 |
| `archetypes/` | 新規コンテンツのテンプレート。`default.md` はドラフト記事用の最小 TOML front matter を持ちます。 |
| `content/` | 実際のコンテンツ。`content/<lang>/<section>/<slug>/index.<lang>.md` という階層でレシピを格納。 |
| `i18n/en.toml`, `i18n/ja.toml` | Book テーマやレシピ短縮ラベルの翻訳文字列。キーを追加してから `hugo --i18n-warnings` で検証。 |
| `layouts/` | Book テーマを上書きするレイアウト。`_default/single.html` で個別ページをラップし、`partials/recipe/*.html` と `shortcodes/*.html` がレシピ UI を構成。 |
| `assets/_custom.scss` | Book テーマの上に被せるスタイル拡張。配色やレシピカードの UI をここで調整。`assets/js/recipe.js` にはタイマーや材料トグルなどのインタラクション。 |
| `static/images/recipes/` | レシピ hero 画像やプレースホルダー（`nukujaga-placeholder.svg`）。`featured` で参照します。 |
| `scripts/convert_recipes.py` | 旧 HTML（`geofood/` 由来）をこのリポジトリの TOML + ショートコード形式へ変換する移行スクリプト。 |
| `resources/_gen/` | Hugo が生成するキャッシュ。自動生成物なので基本的に手動編集しません。 |
| `public/`・`docs/` | ビルド成果物。`public/` は直近の `hugo` 出力、`docs/` は GitHub Pages 配信用にコミットされるディストリビューション。 |
| `geofood/` | 旧コンテンツ（移行元）の完全コピー。必要に応じて `scripts/convert_recipes.py` と組み合わせて参照します。 |
| `themes/` | Hugo Modules を使っているため空ディレクトリ。テーマ更新は `hugo mod get -u` で行います。 |

## `content/` の構成ルール

- 言語別に `content/ja` と `content/en` を用意し、`hugo.toml` の `languages.<code>.contentDir` で参照しています。
- セクション（例: `maindish`, `sidedish`, `sidedish-meat`, `dessert` など）は日本語/英語で概ね対応。日本語ディレクトリにはすでにレシピが多数あり、英語側は `_index.md` でカテゴリ説明を整備中です。
- レシピファイルは `content/<lang>/<section>/<slug>/index.<lang>.md` で配置し、`slug` とフォルダー名は小文字ケバブケースで一致させます（例: `content/ja/maindish/mini-okonomiyaki/index.ja.md`）。
- セクショントップには `_index.md`（英語）または `_index.ja.md`（日本語）を置いて一覧ページのフロントマターと冒頭リード文を記述します。

### レシピページの front matter

レシピ本文は TOML front matter でメタ情報を定義し、その下で共通ショートコードを呼び出します。主要フィールドは以下のとおりです。

```toml
+++
title = "ミニお好み焼き"
weight = 1
slug = "mini-okonomiyaki"
description = "ミニサイズで焼けるお好み焼きの作り方"
tags = ["粉もの", "ホットプレート"]
featured = "/images/recipes/nukujaga-placeholder.svg"
tools = ["フライパン", "ボウル"]
[recipe]
  serves = "2人分"
  prep = "15分"
  cook = "30分"
  rest = ""
  difficulty = "★★☆☆"
  inspiration = "大阪のお好み焼き"
  tags = ["週末メニュー"]
[[ingredients]]
  group = "生地"
  [[ingredients.items]]
    name = "薄力粉"
    amount = "120g"
  [[ingredients.items]]
    name = "卵"
    amount = "2個"
[[ingredients]]
  group = "具材"
  [[ingredients.items]]
    name = "キャベツ"
    amount = "200g"
[[steps]]
  title = "下準備"
  detail = "キャベツを粗みじんにする"
  timer = ""
[[steps]]
  title = "焼成"
  detail = "両面がきつね色になるまで焼く"
  timer = "15分"
+++
```

- `[[ingredients]]` ブロックで材料グループを作り、各グループに `[[ingredients.items]]` を並べます。数量やメモがない場合は空文字で OK です。
- `[[steps]]` で調理工程を順番に記載し、`timer` には任意の目安時間を入れます。
- 翻訳が未確定のレシピは `translationPending = true` を front matter に追加してレビュアーが抽出できるようにしてください。

### 本文で使うショートコード

Front matter の下には以下のショートコードを並べて UI を構成します。必要に応じて `kitchen-notes` でメモを包みます。

```
{{< recipe-meta >}}
{{< recipe-tools >}}
{{< ingredients >}}
{{< recipe-steps >}}
{{< kitchen-notes title="ポイント" >}}
- 火加減は中火でスタート
- ソースは食べる直前に塗る
{{< /kitchen-notes >}}
```

`layouts/shortcodes/*.html` にこれらのテンプレートがあり、`layouts/partials/recipe/*.html` で細かい UI をカスタマイズしています。新しい装飾が必要な場合はまずショートコードを追加し、翻訳キーも `i18n/*.toml` に定義してください。

## アセットと画像管理

- レシピで使う画像は `static/images/recipes/` に配置し、ファイル名はレシピ slug など意味のある名前にします。静的パスになるためキャッシュ破棄を意識して管理します。
- `assets/_custom.scss` と `assets/js/recipe.js` は Hugo のパイプラインでまとめられます。SCSS 変数は Book テーマの命名に合わせて `camelCase` に揃えてください。

## 自動化・補助スクリプト

- GitHub Actions (`deploy.yml`) が `main` ブランチへの push で自動ビルド・デプロイを実行します。`public/` へ吐き出された成果物を artifact として Pages に配信します。
- `scripts/convert_recipes.py` は旧サイト (`geofood/` 以下) の HTML から本リポジトリ形式へ変換するためのユーティリティです。Front matter、材料、工程、メモを抽出し TOML + ショートコード構造へ書き直します。

## 追加の覚え書き

- PR を出す前に `hugo --gc --minify` と `hugo --i18n-warnings` のログを残し、見た目が変わる場合はライト/ダーク両方のスクリーンショットを添付してください。
- 翻訳用の文言はできる限り `i18n/*.toml` にまとめ、レイアウト内でハードコードしないようにします。
- 旧サイト (`geofood/`) は参照専用です。必要なレシピは `scripts/convert_recipes.py` で再生成し、このリポジトリの構造に合わせて追加してください。

