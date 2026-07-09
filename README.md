# 現地調査ヒアリングAI（本番版）｜丸八テント商会

現場担当がスマホで入力・撮影 → Claude API が写真も解析して、推奨テント種類・柱数・生地・補強・注意点・提案文を返すWebアプリ。

## 構成（ファイルの役割）

```
genchi-hearing-ai-prod/
├─ index.html        … アプリ本体（スマホ画面・16製品の判定ロジック）
├─ api/analyze.js    … サーバー関数。ここでClaude APIを呼ぶ（APIキーはここだけ）
├─ package.json      … 使うライブラリ（@anthropic-ai/sdk）の宣言
├─ vercel.json       … 関数のタイムアウト設定（写真解析は時間がかかるため60秒）
├─ .env.example      … APIキーの置き場所の見本
└─ .gitignore        … 公開しないファイルの指定
```

判定ロジック（柱数・生地・補強など）は index.html 内で動き、**注意点の文章化と写真解析だけ** Claude API が担当します。APIが落ちても従来のテンプレ文で動き続けます（フォールバック）。

---

## 公開までの手順（はじめての人向け）

### ステップ0：Anthropic の APIキーを取る
1. https://console.anthropic.com を開いてアカウント作成
2. 支払い方法（クレジットカード）を登録し、少額チャージ（$5〜で十分試せます）
3. 「API Keys」で新しいキーを発行し、`sk-ant-...` をコピーして控える（**この鍵は他人に見せない**）

> 費用の目安：1回の提案で数円程度。写真解析を含めても月数百件で数千円ほど。

### ステップ1：GitHub にこのフォルダを置く
1. https://github.com でアカウント作成 →「New repository」で空のリポジトリを作る
2. この `genchi-hearing-ai-prod` フォルダの中身をアップロード
   （GitHub Desktop アプリを使うのが簡単。`node_modules` は上げない＝`.gitignore`で自動除外）

### ステップ2：Vercel にデプロイ
1. https://vercel.com に GitHub アカウントでログイン
2. 「Add New… → Project」→ ステップ1のリポジトリを選ぶ
3. フレームワークは自動判定（"Other" のままでOK）→「Deploy」

### ステップ3：APIキーを Vercel に登録（重要）
1. Vercel のプロジェクト画面 → **Settings → Environment Variables**
2. 追加する：
   - Name（名前）：`ANTHROPIC_API_KEY`
   - Value（値）：ステップ0でコピーした `sk-ant-...`
3. 保存したら **Deployments → 最新のデプロイを Redeploy**（環境変数を反映させるため）

### ステップ4：スマホで開いて確認
- Vercel が発行した URL（例 `https://xxxx.vercel.app`）をスマホで開く
- 製品を選び、寸法などを入力し、写真を撮って「AIに提案してもらう」
- 「写真からのAI所見」が表示されれば成功

---

## うまく動かないとき
- **AI所見が出ず、テンプレ文だけ表示される** → APIキー未登録／Redeploy忘れ／残高不足のいずれか。Vercelの Functions ログでエラーを確認。
- **写真を付けると重い・エラー** → 枚数を減らす（サーバー側で最大6枚・アップ前に自動縮小済み）。
- **キーを変えたい** → Settings → Environment Variables で値を更新し Redeploy。

## ローカルで試す（任意・上級）
Node.js を入れて：
```
npm install
npm i -g vercel
cp .env.example .env   # .env に自分のAPIキーを記入
vercel dev             # http://localhost:3000 で動作
```

---

## 次にできる拡張
- 提案の保存・案件一覧（データベース連携）→ 見積・設計への引き継ぎ
- 判定数値（柱ピッチ・生地型番・地域係数）を御社の実基準に合わせ込み
- 写真の複数アングル指示（全景/地面/取付先/搬入経路）で解析精度を上げる
