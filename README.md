# NextMeet - 軽量Webミーティングプラットフォーム

WebRTC、Vanilla JS、Tailwind CSS（CDN）を使用した軽量なWebミーティングアプリケーションです。

## 機能

- ✅ ワンクリックミーティング開始
- ✅ ミーティングコードでの参加
- ✅ マイク/カメラ制御
- ✅ 画面共有
- ✅ テキストチャット
- ✅ リアクション（絵文字）
- ✅ 挙手機能
- ✅ AI議事録（Web Speech API）
- ✅ ホワイトボード
- ✅ 録画機能
- ✅ PWA対応

## ローカルで実行

```bash
# Python 3の場合
python3 -m http.server 8080

# Node.jsの場合
npx serve .
```

ブラウザで http://localhost:8080 を開く

## デプロイ

### GitHub Pages

1. このリポジトリをGitHubにプッシュ
2. Settings > Pages > Source を "main" ブランチに設定
3. 数分後にサイトが公開されます

### Netlify / Vercel

静的サイトとしてそのままデプロイ可能です。

## 技術スタック

- HTML5 / CSS3 / JavaScript (ES6+)
- WebRTC API
- Web Speech API
- MediaRecorder API
- Canvas API
- Tailwind CSS (CDN)
- PWA (Service Worker)

## ライセンス

MIT
