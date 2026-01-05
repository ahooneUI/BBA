/**
 * NextMeet - Whiteboard Module
 * 画面共有オーバーレイでの描画機能
 */

class WhiteboardManager {
    constructor(rtcManager) {
        this.rtc = rtcManager;
        this.canvas = null;
        this.ctx = null;
        this.isActive = false;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#ffffff';
        this.lineWidth = 3;
        this.lastX = 0;
        this.lastY = 0;
        this.callbacks = new Map();

        this.init();
    }

    init() {
        this.canvas = document.getElementById('whiteboardCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            this.bindEvents();
        }

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    /**
     * キャンバスをリサイズ
     */
    resizeCanvas() {
        if (!this.canvas) return;

        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    /**
     * イベントをバインド
     */
    bindEvents() {
        if (!this.canvas) return;

        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // タッチイベント
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(touch);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.draw(touch);
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // ツールボタン
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
            });
        });

        // 色ボタン
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setColor(btn.dataset.color);
            });
        });

        // クリアボタン
        document.getElementById('clearWhiteboard')?.addEventListener('click', () => {
            this.clear();
        });

        // ホワイトボードトグル
        document.getElementById('whiteboardBtn')?.addEventListener('click', () => {
            this.toggle();
        });
    }

    /**
     * ホワイトボードをアクティブ化
     */
    activate() {
        this.isActive = true;

        const overlay = document.getElementById('whiteboardOverlay');
        const tools = document.getElementById('whiteboardTools');

        if (overlay) overlay.classList.add('active');
        if (tools) tools.classList.add('visible');

        const btn = document.getElementById('whiteboardBtn');
        if (btn) {
            btn.classList.add('active');
            btn.classList.remove('secondary');
        }
    }

    /**
     * ホワイトボードを非アクティブ化
     */
    deactivate() {
        this.isActive = false;

        const overlay = document.getElementById('whiteboardOverlay');
        const tools = document.getElementById('whiteboardTools');

        if (overlay) overlay.classList.remove('active');
        if (tools) tools.classList.remove('visible');

        const btn = document.getElementById('whiteboardBtn');
        if (btn) {
            btn.classList.remove('active');
            btn.classList.add('secondary');
        }
    }

    /**
     * トグル
     */
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
        return this.isActive;
    }

    /**
     * 描画開始
     */
    startDrawing(e) {
        if (!this.isActive) return;

        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    /**
     * 描画
     */
    draw(e) {
        if (!this.isDrawing || !this.isActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ctx.beginPath();

        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.lineWidth * 5;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
        }

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();

        // 描画データを送信
        this.broadcastDraw({
            tool: this.currentTool,
            color: this.currentColor,
            width: this.lineWidth,
            from: { x: this.lastX, y: this.lastY },
            to: { x, y }
        });

        this.lastX = x;
        this.lastY = y;
    }

    /**
     * 描画終了
     */
    stopDrawing() {
        this.isDrawing = false;
    }

    /**
     * ツールを設定
     */
    setTool(tool) {
        this.currentTool = tool;

        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    /**
     * 色を設定
     */
    setColor(color) {
        this.currentColor = color;

        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.classList.toggle('ring-2', btn.dataset.color === color);
            btn.classList.toggle('ring-white', btn.dataset.color === color);
        });
    }

    /**
     * キャンバスをクリア
     */
    clear() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // クリアを他のピアに送信
        this.broadcastClear();
    }

    /**
     * 描画データをブロードキャスト
     */
    broadcastDraw(data) {
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'whiteboard-draw',
                data
            });
        }
    }

    /**
     * クリアをブロードキャスト
     */
    broadcastClear() {
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'whiteboard-clear'
            });
        }
    }

    /**
     * リモートの描画を適用
     */
    applyRemoteDraw(data) {
        if (!this.ctx) return;

        this.ctx.beginPath();

        if (data.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = data.width * 5;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = data.color;
            this.ctx.lineWidth = data.width;
        }

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(data.from.x, data.from.y);
        this.ctx.lineTo(data.to.x, data.to.y);
        this.ctx.stroke();
    }

    /**
     * キャンバスを画像として取得
     */
    getImage() {
        return this.canvas?.toDataURL('image/png');
    }

    /**
     * イベントリスナー登録
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }

    /**
     * イベント発火
     */
    emit(event, data) {
        const callbacks = this.callbacks.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }
}

// Export
window.NextMeet = window.NextMeet || {};
window.NextMeet.WhiteboardManager = WhiteboardManager;
