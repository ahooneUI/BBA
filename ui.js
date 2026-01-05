/**
 * NextMeet - UI Module
 * ミーティングルームのUI制御
 */

class UIManager {
    constructor(options = {}) {
        this.settings = options.settings;
        this.media = options.media;
        this.rtc = options.rtc;
        this.chat = options.chat;

        this.callStartTime = null;
        this.timerInterval = null;
        this.isHandRaised = false;
        this.participants = new Map();

        this.init();
    }

    init() {
        this.bindEvents();
        this.initMeetingCode();
        this.startTimer();
        this.updateParticipantCount();

        // 設定を同期
        if (this.settings) {
            this.settings.syncWithUI();
            this.settings.bindUIEvents();
        }

        // チャットイベントをバインド
        if (this.chat) {
            this.chat.bindUIEvents();
        }
    }

    /**
     * ミーティングコードを初期化
     */
    initMeetingCode() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') || 'NEXT-XXXX-XXXX';

        const codeDisplay = document.getElementById('meetingCode');
        if (codeDisplay) {
            codeDisplay.textContent = code;
        }
    }

    /**
     * イベントをバインド
     */
    bindEvents() {
        // マイクボタン
        document.getElementById('micBtn')?.addEventListener('click', () => {
            if (this.media) {
                this.media.toggleMicrophone();
            }
        });

        // カメラボタン
        document.getElementById('cameraBtn')?.addEventListener('click', () => {
            if (this.media) {
                this.media.toggleCamera();
            }
        });

        // 画面共有ボタン
        document.getElementById('shareScreenBtn')?.addEventListener('click', async () => {
            if (this.media) {
                await this.media.toggleScreenShare();
            }
        });

        // 設定パネル
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
        document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
            this.closeSettingsPanel();
        });

        // 退出ボタン
        document.getElementById('leaveBtn')?.addEventListener('click', () => {
            this.showLeaveModal();
        });
        document.getElementById('cancelLeaveBtn')?.addEventListener('click', () => {
            this.hideLeaveModal();
        });
        document.getElementById('confirmLeaveBtn')?.addEventListener('click', () => {
            this.leaveMeeting();
        });

        // リンクコピー
        document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
            this.copyMeetingLink();
        });

        // 挙手
        document.getElementById('handRaiseBtn')?.addEventListener('click', () => {
            this.toggleHandRaise();
        });

        // リアクション
        document.getElementById('reactionBtn')?.addEventListener('click', () => {
            this.toggleReactionPicker();
        });
        document.querySelectorAll('.reaction-btn[data-reaction]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sendReaction(btn.dataset.reaction);
            });
        });

        // AI議事録
        document.getElementById('aiTranscriptionBtn')?.addEventListener('click', () => {
            this.toggleTranscriptionPanel();
        });
        document.getElementById('closeTranscript')?.addEventListener('click', () => {
            this.closeTranscriptionPanel();
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });

        // ウィンドウリサイズ
        window.addEventListener('resize', () => {
            this.updateVideoGrid();
        });

        // ページを離れる前の確認
        window.addEventListener('beforeunload', (e) => {
            if (this.callStartTime) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /**
     * 通話タイマーを開始
     */
    startTimer() {
        this.callStartTime = Date.now();

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);

            const display = document.getElementById('callTimer');
            if (display) {
                display.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    /**
     * タイマーを停止
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * ビデオグリッドを更新
     */
    updateVideoGrid() {
        const grid = document.getElementById('videoGrid');
        if (!grid) return;

        const count = grid.children.length;
        grid.dataset.count = Math.min(count, 9);
    }

    /**
     * リモートビデオタイルを追加
     */
    addRemoteVideo(peerId, stream, userName = '参加者') {
        const grid = document.getElementById('videoGrid');
        if (!grid) return;

        // 既存のタイルがあれば更新
        let tile = document.getElementById(`video-${peerId}`);
        if (!tile) {
            tile = document.createElement('div');
            tile.id = `video-${peerId}`;
            tile.className = 'video-tile';
            tile.innerHTML = `
                <video autoplay playsinline class="w-full h-full object-cover"></video>
                <div class="participant-info">
                    <svg class="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path>
                    </svg>
                    <span>${userName}</span>
                </div>
                <div class="tile-actions">
                    <button class="tile-action-btn" title="ピン留め">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                        </svg>
                    </button>
                </div>
            `;
            grid.appendChild(tile);
        }

        const video = tile.querySelector('video');
        if (video) {
            video.srcObject = stream;
        }

        this.participants.set(peerId, { userName, stream });
        this.updateVideoGrid();
        this.updateParticipantCount();
    }

    /**
     * リモートビデオタイルを削除
     */
    removeRemoteVideo(peerId) {
        const tile = document.getElementById(`video-${peerId}`);
        if (tile) {
            tile.remove();
        }

        this.participants.delete(peerId);
        this.updateVideoGrid();
        this.updateParticipantCount();
    }

    /**
     * 参加者数を更新
     */
    updateParticipantCount() {
        const count = this.participants.size + 1; // +1 for local user
        const display = document.getElementById('participantCount');
        if (display) {
            display.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
        }

        // アバターを更新
        this.updateParticipantAvatars();
    }

    /**
     * 参加者アバターを更新
     */
    updateParticipantAvatars() {
        const container = document.getElementById('participantAvatars');
        if (!container) return;

        container.innerHTML = '';

        // ローカルユーザー
        container.innerHTML += `
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-orange to-orange-600 border-2 border-dark-800 flex items-center justify-center text-xs font-bold">
                あ
            </div>
        `;

        // リモートユーザー（最大4人表示）
        let i = 0;
        for (const [peerId, info] of this.participants) {
            if (i >= 4) break;
            const initial = info.userName.charAt(0);
            container.innerHTML += `
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-blue-600 border-2 border-dark-800 flex items-center justify-center text-xs font-bold">
                    ${initial}
                </div>
            `;
            i++;
        }
    }

    /**
     * 設定パネルをトグル
     */
    toggleSettingsPanel() {
        const panel = document.getElementById('settingsPanel');
        if (panel) {
            panel.classList.toggle('open');
        }
    }

    /**
     * 設定パネルを閉じる
     */
    closeSettingsPanel() {
        const panel = document.getElementById('settingsPanel');
        if (panel) {
            panel.classList.remove('open');
        }
    }

    /**
     * 退出モーダルを表示
     */
    showLeaveModal() {
        const modal = document.getElementById('leaveModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    /**
     * 退出モーダルを非表示
     */
    hideLeaveModal() {
        const modal = document.getElementById('leaveModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    /**
     * ミーティングから退出
     */
    leaveMeeting() {
        this.stopTimer();

        if (this.media) {
            this.media.stopAll();
        }

        if (this.rtc) {
            this.rtc.closeAll();
        }

        window.location.href = 'index.html';
    }

    /**
     * ミーティングリンクをコピー
     */
    async copyMeetingLink() {
        const code = document.getElementById('meetingCode')?.textContent;
        const link = `${window.location.origin}${window.location.pathname}?code=${code}`;

        try {
            await navigator.clipboard.writeText(link);
            this.showToast('リンクをコピーしました');
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    }

    /**
     * 挙手をトグル
     */
    toggleHandRaise() {
        this.isHandRaised = !this.isHandRaised;

        const btn = document.getElementById('handRaiseBtn');
        if (btn) {
            btn.classList.toggle('active', this.isHandRaised);
            btn.classList.toggle('secondary', !this.isHandRaised);
        }

        // 他のピアに通知
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'handRaise',
                raised: this.isHandRaised
            });
        }
    }

    /**
     * リアクションピッカーをトグル
     */
    toggleReactionPicker() {
        const picker = document.getElementById('reactionPicker');
        if (picker) {
            picker.classList.toggle('open');
        }
    }

    /**
     * リアクションを送信
     */
    sendReaction(emoji) {
        // アニメーション表示
        this.showFloatingReaction(emoji);

        // ピッカーを閉じる
        const picker = document.getElementById('reactionPicker');
        if (picker) {
            picker.classList.remove('open');
        }

        // 他のピアに通知
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'reaction',
                emoji
            });
        }
    }

    /**
     * フローティングリアクションを表示
     */
    showFloatingReaction(emoji) {
        const reaction = document.createElement('div');
        reaction.className = 'floating-reaction';
        reaction.textContent = emoji;
        reaction.style.left = `${Math.random() * 60 + 20}%`;
        reaction.style.bottom = '120px';

        document.body.appendChild(reaction);

        setTimeout(() => {
            reaction.remove();
        }, 2000);
    }

    /**
     * 議事録パネルをトグル
     */
    toggleTranscriptionPanel() {
        const panel = document.getElementById('transcriptionPanel');
        if (panel) {
            panel.classList.toggle('visible');
        }
    }

    /**
     * 議事録パネルを閉じる
     */
    closeTranscriptionPanel() {
        const panel = document.getElementById('transcriptionPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    /**
     * キーボードショートカット
     */
    handleKeyboardShortcut(e) {
        // Ctrl/Cmd + D: マイクトグル
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            if (this.media) this.media.toggleMicrophone();
        }
        // Ctrl/Cmd + E: カメラトグル
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            if (this.media) this.media.toggleCamera();
        }
        // Escape: パネルを閉じる
        if (e.key === 'Escape') {
            this.closeSettingsPanel();
            this.hideLeaveModal();
        }
    }

    /**
     * トースト通知を表示
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-dark-600 text-white rounded-xl shadow-lg z-50 transition-opacity';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Export
window.NextMeet = window.NextMeet || {};
window.NextMeet.UIManager = UIManager;
