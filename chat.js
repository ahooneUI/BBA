/**
 * NextMeet - Chat Module
 * テキストチャットとファイル共有
 */

class ChatManager {
    constructor(rtcManager) {
        this.rtc = rtcManager;
        this.messages = [];
        this.unreadCount = 0;
        this.isPanelOpen = false;
        this.userName = 'あなた';
        this.callbacks = new Map();

        this.init();
    }

    init() {
        // RTCからのメッセージを受信
        if (this.rtc) {
            this.rtc.on('dataChannelMessage', ({ peerId, data }) => {
                if (data.type === 'chat') {
                    this.receiveMessage(data);
                } else if (data.type === 'file-info') {
                    this.handleFileInfo(peerId, data);
                }
            });

            this.rtc.on('dataChannelBinary', ({ peerId, data }) => {
                this.handleFileData(peerId, data);
            });
        }
    }

    /**
     * ユーザー名を設定
     */
    setUserName(name) {
        this.userName = name;
    }

    /**
     * メッセージを送信
     */
    sendMessage(text) {
        if (!text.trim()) return;

        const message = {
            type: 'chat',
            id: Date.now(),
            sender: this.userName,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            isOwn: true
        };

        // ローカルに追加
        this.messages.push(message);
        this.renderMessage(message);

        // 他のピアに送信
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'chat',
                id: message.id,
                sender: message.sender,
                text: message.text,
                timestamp: message.timestamp
            });
        }

        this.emit('messageSent', message);
    }

    /**
     * メッセージを受信
     */
    receiveMessage(data) {
        const message = {
            ...data,
            isOwn: false
        };

        this.messages.push(message);
        this.renderMessage(message);

        // パネルが閉じている場合は未読カウントを増やす
        if (!this.isPanelOpen) {
            this.unreadCount++;
            this.updateBadge();
        }

        this.emit('messageReceived', message);
    }

    /**
     * メッセージを画面に描画
     */
    renderMessage(message) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const time = new Date(message.timestamp);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

        const div = document.createElement('div');
        div.className = `chat-message ${message.isOwn ? 'own text-right' : ''}`;
        div.innerHTML = `
            <div class="sender ${message.isOwn ? 'text-accent-blue' : ''}">${message.isOwn ? '' : message.sender} <span class="text-gray-500 text-xs">${timeStr}</span></div>
            <div class="text inline-block max-w-[80%]">${this.escapeHtml(message.text)}</div>
        `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * ファイルを送信
     */
    async sendFile(file) {
        const fileInfo = {
            type: 'file-info',
            id: Date.now(),
            name: file.name,
            size: file.size,
            mimeType: file.type
        };

        // ファイル情報を送信
        if (this.rtc) {
            this.rtc.broadcast(fileInfo);
        }

        // ファイルを読み込んでチャンクで送信
        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target.result;
            const chunkSize = 16384; // 16KB chunks

            for (let i = 0; i < buffer.byteLength; i += chunkSize) {
                const chunk = buffer.slice(i, i + chunkSize);
                // DataChannelでバイナリ送信
                // 実際の実装ではチャンクを適切に処理
            }
        };
        reader.readAsArrayBuffer(file);

        // ローカルチャットに表示
        const message = {
            type: 'file',
            id: fileInfo.id,
            sender: this.userName,
            fileName: file.name,
            fileSize: this.formatFileSize(file.size),
            timestamp: new Date().toISOString(),
            isOwn: true
        };

        this.messages.push(message);
        this.renderFileMessage(message);
    }

    /**
     * ファイルメッセージを描画
     */
    renderFileMessage(message) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = `chat-message ${message.isOwn ? 'own text-right' : ''}`;
        div.innerHTML = `
            <div class="sender ${message.isOwn ? 'text-accent-blue' : ''}">${message.isOwn ? '' : message.sender}</div>
            <div class="inline-block max-w-[80%] p-3 bg-dark-600 rounded-xl">
                <div class="flex items-center gap-3">
                    <svg class="w-8 h-8 text-accent-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    <div class="text-left">
                        <div class="font-medium text-sm">${this.escapeHtml(message.fileName)}</div>
                        <div class="text-xs text-gray-400">${message.fileSize}</div>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * ファイルサイズをフォーマット
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * パネルを開く
     */
    openPanel() {
        const panel = document.getElementById('chatPanel');
        if (panel) {
            panel.classList.add('open');
        }
        this.isPanelOpen = true;
        this.unreadCount = 0;
        this.updateBadge();
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        const panel = document.getElementById('chatPanel');
        if (panel) {
            panel.classList.remove('open');
        }
        this.isPanelOpen = false;
    }

    /**
     * パネルをトグル
     */
    togglePanel() {
        if (this.isPanelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    /**
     * 未読バッジを更新
     */
    updateBadge() {
        const badge = document.getElementById('chatBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    /**
     * UIイベントをバインド
     */
    bindUIEvents() {
        // チャットボタン
        document.getElementById('chatBtn')?.addEventListener('click', () => {
            this.togglePanel();
        });

        // 閉じるボタン
        document.getElementById('closeChatBtn')?.addEventListener('click', () => {
            this.closePanel();
        });

        // 送信ボタン
        document.getElementById('sendChatBtn')?.addEventListener('click', () => {
            const input = document.getElementById('chatInput');
            if (input) {
                this.sendMessage(input.value);
                input.value = '';
            }
        });

        // Enter送信
        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const input = e.target;
                this.sendMessage(input.value);
                input.value = '';
            }
        });

        // ファイル添付
        document.getElementById('fileInput')?.addEventListener('change', (e) => {
            const files = e.target.files;
            for (const file of files) {
                this.sendFile(file);
            }
            e.target.value = '';
        });
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
window.NextMeet.ChatManager = ChatManager;
