/**
 * NextMeet - Main Application Module
 * ランディングページのロジック
 */

// Utility Functions
const Utils = {
    /**
     * ランダムなミーティングコードを生成
     * 形式: NEXT-XXXX-XXXX
     */
    generateMeetingCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segments = [];

        for (let i = 0; i < 2; i++) {
            let segment = '';
            for (let j = 0; j < 4; j++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            segments.push(segment);
        }

        return `NEXT-${segments[0]}-${segments[1]}`;
    },

    /**
     * ミーティングコードをバリデーション
     */
    validateMeetingCode(code) {
        if (!code) return false;
        // Format: NEXT-XXXX-XXXX or just XXXX-XXXX
        const pattern = /^(NEXT-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
        return pattern.test(code.trim());
    },

    /**
     * URLからミーティングコードを抽出
     */
    extractMeetingCode(input) {
        // URLの場合、パラメータからコードを抽出
        if (input.includes('?')) {
            const url = new URL(input, window.location.origin);
            const code = url.searchParams.get('code') || url.searchParams.get('room');
            if (code) return code.toUpperCase();
        }

        // 直接コードの場合
        const normalized = input.trim().toUpperCase();
        if (!normalized.startsWith('NEXT-')) {
            return `NEXT-${normalized}`;
        }
        return normalized;
    },

    /**
     * ローカルストレージに保存
     */
    saveToStorage(key, value) {
        try {
            localStorage.setItem(`nextmeet_${key}`, JSON.stringify(value));
        } catch (e) {
            console.warn('LocalStorage not available:', e);
        }
    },

    /**
     * ローカルストレージから取得
     */
    getFromStorage(key) {
        try {
            const value = localStorage.getItem(`nextmeet_${key}`);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.warn('LocalStorage not available:', e);
            return null;
        }
    }
};

// Landing Page Controller
class LandingPage {
    constructor() {
        this.startBtn = document.getElementById('startMeetingBtn');
        this.joinBtn = document.getElementById('joinMeetingBtn');
        this.codeInput = document.getElementById('meetingCodeInput');

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkUrlParams();
    }

    bindEvents() {
        // 会議を始めるボタン
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startNewMeeting());
        }

        // 参加ボタン
        if (this.joinBtn) {
            this.joinBtn.addEventListener('click', () => this.joinMeeting());
        }

        // Enterキーで参加
        if (this.codeInput) {
            this.codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.joinMeeting();
                }
            });

            // 入力時のバリデーション
            this.codeInput.addEventListener('input', (e) => {
                this.validateInput(e.target.value);
            });
        }
    }

    /**
     * URLパラメータをチェック（直接リンクでの参加）
     */
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') || params.get('room');
        const action = params.get('action');

        if (action === 'start') {
            this.startNewMeeting();
        } else if (code) {
            this.codeInput.value = code;
            this.joinMeeting();
        }
    }

    /**
     * 新しいミーティングを開始
     */
    startNewMeeting() {
        const meetingCode = Utils.generateMeetingCode();

        // ミーティングルームへ遷移
        this.navigateToMeeting(meetingCode, true);
    }

    /**
     * 既存のミーティングに参加
     */
    joinMeeting() {
        const input = this.codeInput?.value?.trim();

        if (!input) {
            this.showError('ミーティングコードを入力してください');
            return;
        }

        const meetingCode = Utils.extractMeetingCode(input);

        if (!Utils.validateMeetingCode(meetingCode)) {
            this.showError('無効なミーティングコードです');
            return;
        }

        this.navigateToMeeting(meetingCode, false);
    }

    /**
     * ミーティングルームへ遷移
     */
    navigateToMeeting(code, isHost) {
        // ホスト情報を保存
        Utils.saveToStorage(`meeting_${code}`, {
            isHost,
            joinedAt: Date.now()
        });

        // ミーティングページへ遷移
        window.location.href = `meeting.html?code=${encodeURIComponent(code)}`;
    }

    /**
     * 入力バリデーション
     */
    validateInput(value) {
        if (!value) {
            this.joinBtn?.classList.remove('opacity-50');
            return;
        }

        const isValid = Utils.validateMeetingCode(Utils.extractMeetingCode(value));

        if (isValid) {
            this.joinBtn?.classList.remove('opacity-50');
            this.codeInput?.classList.remove('border-red-500');
        } else {
            this.codeInput?.classList.add('border-red-500');
        }
    }

    /**
     * エラー表示
     */
    showError(message) {
        // シンプルなトースト通知
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500/90 backdrop-blur text-white rounded-xl shadow-lg z-50 animate-fade-in';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 入力フィールドをハイライト
        if (this.codeInput) {
            this.codeInput.classList.add('border-red-500');
            this.codeInput.focus();
        }

        // 3秒後に削除
        setTimeout(() => {
            toast.classList.add('opacity-0', 'transition-opacity');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export for use in other modules
window.NextMeet = window.NextMeet || {};
window.NextMeet.Utils = Utils;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // ランディングページの場合のみ初期化
    if (document.getElementById('startMeetingBtn')) {
        new LandingPage();
    }
});
