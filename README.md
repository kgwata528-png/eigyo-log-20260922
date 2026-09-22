# 営業ログ PWA — セットアップ手順

## ファイル構成
```
sales-pwa/
├── index.html      メイン画面
├── style.css       スタイル
├── app.js          ロジック・地図
├── manifest.json   PWA設定
├── sw.js           Service Worker（オフライン対応）
├── icons/
│   ├── icon-192.png   （別途用意）
│   └── icon-512.png   （別途用意）
└── README.md
```

## セットアップ

### 1. Google Maps APIキーの設定

`app.js` の先頭1行を編集：

```js
const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';
//  ↓
const GOOGLE_MAPS_API_KEY = 'AIzaSy...（実際のキー）';
```

**APIキーの取得方法**
1. https://console.cloud.google.com にアクセス
2. 新しいプロジェクトを作成
3. 「Maps JavaScript API」を有効化
4. 「認証情報」→「APIキーを作成」
5. HTTPリファラー制限を設定（本番運用時）

### 2. アイコン画像の用意

`icons/` フォルダに以下を配置：
- `icon-192.png`（192×192px）
- `icon-512.png`（512×512px）

※ なくてもアプリは動きます（ホーム画面アイコンが表示されないだけ）

### 3. サーバーへのアップロード

**HTTPS必須**（位置情報・Service Workerの動作に必要）

おすすめの無料ホスティング：
- **Netlify**: netlify.com にフォルダをドラッグ＆ドロップするだけ
- **Vercel**: vercel.com → CLIで `vercel deploy`
- **GitHub Pages**: リポジトリに push してPages設定

### 4. スマホへの追加

**iPhone（Safari）**
1. SafariでアプリURLを開く
2. 下部の「共有」ボタン →「ホーム画面に追加」

**Android（Chrome）**
1. ChromeでアプリURLを開く
2. メニュー →「ホーム画面に追加」

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| カウンター | 不在/インターホン/対面を個別カウント、合計自動計算。ー1ボタンあり |
| 訪問記録 | 名前・住所・対応区分・見込みランク（A〜F）・訪問種別・自由メモ |
| 現在地取得 | ボタン1つで住所を自動入力（OpenStreetMap逆ジオコーディング） |
| 重複検知 | 名前・住所の入力中に過去記録を自動検索、再訪を示唆 |
| 履歴 | 同一人物の訪問をまとめて一覧化。名前/住所検索・ランクフィルタ |
| 地図・足跡 | Google Maps上にリアルタイムで移動経路を描画（青い線） |
| 訪問ピン | 位置情報付きで保存した記録は地図上にランク色のピンで表示 |
| オフライン | Service Workerによりオフラインでも基本機能が使用可能 |
| データ保存 | localStorage（端末内）、削除しない限り保持 |

## 将来の拡張ポイント

- **クラウド同期**: Firebase / Supabaseを追加すれば複数端末で共有可能
- **ルート最適化**: Google Maps Routes APIで当日の巡回順を最適化
- **CSV出力**: 記録を Excel で確認できるようエクスポート機能
- **チーム共有**: 複数の営業担当者で記録を共有するマルチユーザー対応
