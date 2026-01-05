/**
 * NextMeet - Transcription Module
 * AI議事録とリアルタイム音声認識
 */

class TranscriptionManager {
    constructor(rtcManager) {
        this.rtc = rtcManager;
        this.recognition = null;
        this.isRecording = false;
        this.transcript = [];
        this.currentSpeaker = 'あなた';
        this.callbacks = new Map();

        this.init();
    }

    init() {
        // Web Speech API対応チェック
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ja-JP';

            this.recognition.onresult = (event) => {
                this.handleResult(event);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.emit('error', event.error);
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    // 自動再起動
                    this.recognition.start();
                }
            };
        }
    }

    /**
     * 音声認識を開始
     */
    start() {
        if (!this.recognition) {
            this.emit('error', 'Speech recognition not supported');
            return false;
        }

        try {
            this.recognition.start();
            this.isRecording = true;
            this.updateUI();
            this.emit('started');
            return true;
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            return false;
        }
    }

    /**
     * 音声認識を停止
     */
    stop() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
            this.updateUI();
            this.emit('stopped');
        }
    }

    /**
     * トグル
     */
    toggle() {
        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
        return this.isRecording;
    }

    /**
     * 音声認識結果を処理
     */
    handleResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
                finalTranscript += result[0].transcript;
            } else {
                interimTranscript += result[0].transcript;
            }
        }

        if (finalTranscript) {
            this.addEntry({
                speaker: this.currentSpeaker,
                text: finalTranscript.trim(),
                timestamp: new Date().toISOString()
            });
        }

        // 中間結果を表示（リアルタイムフィードバック用）
        if (interimTranscript) {
            this.showInterimResult(interimTranscript);
        }
    }

    /**
     * 議事録エントリを追加
     */
    addEntry(entry) {
        this.transcript.push(entry);
        this.renderEntry(entry);
        this.emit('entry', entry);

        // 他のピアに送信
        if (this.rtc) {
            this.rtc.broadcast({
                type: 'transcription',
                entry
            });
        }
    }

    /**
     * エントリを画面に描画
     */
    renderEntry(entry) {
        const container = document.getElementById('transcriptionContent');
        if (!container) return;

        // 空メッセージを削除
        const emptyMsg = container.querySelector('p.text-gray-400');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        const time = new Date(entry.timestamp);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

        const div = document.createElement('div');
        div.className = 'transcription-line';
        div.innerHTML = `
            <span class="time">${timeStr}</span>
            <span class="speaker">${entry.speaker}:</span>
            <span>${entry.text}</span>
        `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * 中間結果を表示
     */
    showInterimResult(text) {
        const container = document.getElementById('transcriptionContent');
        if (!container) return;

        let interim = container.querySelector('.interim-result');
        if (!interim) {
            interim = document.createElement('div');
            interim.className = 'interim-result text-gray-500 italic';
            container.appendChild(interim);
        }

        interim.textContent = text;
        container.scrollTop = container.scrollHeight;
    }

    /**
     * 議事録をダウンロード
     */
    download() {
        if (this.transcript.length === 0) {
            return;
        }

        let content = '# NextMeet 議事録\n\n';
        content += `日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
        content += '---\n\n';

        this.transcript.forEach(entry => {
            const time = new Date(entry.timestamp);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            content += `**[${timeStr}] ${entry.speaker}:** ${entry.text}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `nextmeet_transcript_${new Date().toISOString().split('T')[0]}.md`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * 要約を生成（将来的にGemini API連携）
     */
    async generateSummary() {
        // 現在は簡易的な要約を生成
        if (this.transcript.length === 0) {
            return '議事録がありません。';
        }

        const speakers = [...new Set(this.transcript.map(e => e.speaker))];
        const wordCount = this.transcript.reduce((sum, e) => sum + e.text.length, 0);

        let summary = `## ミーティング要約\n\n`;
        summary += `- 参加者: ${speakers.join(', ')}\n`;
        summary += `- 発言回数: ${this.transcript.length}回\n`;
        summary += `- 文字数: 約${wordCount}文字\n\n`;
        summary += `### 主な発言\n\n`;

        // 最初と最後の発言を抽出
        if (this.transcript.length > 0) {
            summary += `- 開始: "${this.transcript[0].text.substring(0, 50)}..."\n`;
        }
        if (this.transcript.length > 1) {
            const last = this.transcript[this.transcript.length - 1];
            summary += `- 終了: "${last.text.substring(0, 50)}..."\n`;
        }

        return summary;
    }

    /**
     * UIを更新
     */
    updateUI() {
        const btn = document.getElementById('aiTranscriptionBtn');
        if (btn) {
            if (this.isRecording) {
                btn.classList.add('bg-purple-500/40');
                btn.classList.remove('bg-purple-500/20');
            } else {
                btn.classList.remove('bg-purple-500/40');
                btn.classList.add('bg-purple-500/20');
            }
        }
    }

    /**
     * UIイベントをバインド
     */
    bindUIEvents() {
        document.getElementById('aiTranscriptionBtn')?.addEventListener('click', () => {
            this.toggle();

            const panel = document.getElementById('transcriptionPanel');
            if (panel && this.isRecording) {
                panel.classList.add('visible');
            }
        });

        document.getElementById('downloadTranscript')?.addEventListener('click', () => {
            this.download();
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
window.NextMeet.TranscriptionManager = TranscriptionManager;
