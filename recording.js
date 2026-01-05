/**
 * NextMeet - Recording Module
 * ブラウザ上での録画機能
 */

class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.callbacks = new Map();
    }

    /**
     * 録画を開始
     */
    async start() {
        try {
            // 画面とオーディオのキャプチャ
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            // ユーザーのマイク音声を追加
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });

                const audioTrack = audioStream.getAudioTracks()[0];
                displayStream.addTrack(audioTrack);
            } catch (e) {
                console.warn('Could not add microphone audio:', e);
            }

            // MediaRecorderの設定
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 2500000
            };

            this.mediaRecorder = new MediaRecorder(displayStream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            // 画面共有終了時に録画も停止
            displayStream.getVideoTracks()[0].onended = () => {
                if (this.isRecording) {
                    this.stop();
                }
            };

            this.mediaRecorder.start(1000); // 1秒ごとにデータを保存
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.startTimer();
            this.updateUI();

            this.emit('started');
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * 録画を停止
     */
    stop() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.stopTimer();
            this.updateUI();

            this.emit('stopped');
        }
    }

    /**
     * トグル
     */
    async toggle() {
        if (this.isRecording) {
            this.stop();
        } else {
            await this.start();
        }
        return this.isRecording;
    }

    /**
     * 録画停止時の処理
     */
    handleRecordingStop() {
        const blob = new Blob(this.recordedChunks, {
            type: this.getSupportedMimeType()
        });

        this.downloadRecording(blob);
        this.recordedChunks = [];
    }

    /**
     * 録画をダウンロード
     */
    downloadRecording(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        a.download = `nextmeet_recording_${dateStr}_${timeStr}.webm`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        this.emit('downloaded', { url, size: blob.size });
    }

    /**
     * サポートされているMIMEタイプを取得
     */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'video/webm';
    }

    /**
     * 録画タイマーを開始
     */
    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);

            const display = document.getElementById('recordingTime');
            if (display) {
                display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
     * UIを更新
     */
    updateUI() {
        const indicator = document.getElementById('recordingIndicator');
        const btn = document.getElementById('recordBtn');
        const dot = document.getElementById('recordDot');

        if (indicator) {
            indicator.classList.toggle('visible', this.isRecording);
        }

        if (btn) {
            btn.classList.toggle('danger', this.isRecording);
            btn.classList.toggle('secondary', !this.isRecording);
        }

        if (dot) {
            dot.style.fill = this.isRecording ? '#ef4444' : 'currentColor';
        }
    }

    /**
     * UIイベントをバインド
     */
    bindUIEvents() {
        document.getElementById('recordBtn')?.addEventListener('click', async () => {
            await this.toggle();
        });

        // 設定からのトグル
        document.getElementById('recordToggle')?.addEventListener('change', async (e) => {
            if (e.target.checked && !this.isRecording) {
                await this.start();
            } else if (!e.target.checked && this.isRecording) {
                this.stop();
            }
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

// ミーティングルーム初期化
document.addEventListener('DOMContentLoaded', async () => {
    // ミーティングページの場合のみ初期化
    if (!document.getElementById('videoGrid')) return;

    const { SettingsManager, MediaManager, RTCManager, LocalSignaling, ChatManager, UIManager, TranscriptionManager, WhiteboardManager, RecordingManager } = window.NextMeet;

    // 各マネージャーを初期化
    const settings = new SettingsManager();
    const media = new MediaManager(settings);
    const rtc = new RTCManager(settings);
    const chat = new ChatManager(rtc);
    const transcription = new TranscriptionManager(rtc);
    const whiteboard = new WhiteboardManager(rtc);
    const recording = new RecordingManager();

    // UIマネージャーを初期化
    const ui = new UIManager({
        settings,
        media,
        rtc,
        chat
    });

    // 録画のUIイベントをバインド
    recording.bindUIEvents();

    // 議事録のUIイベントをバインド
    transcription.bindUIEvents();

    // ローカルメディアを取得
    try {
        await media.getLocalStream();
        rtc.setLocalStream(media.localStream);
    } catch (error) {
        console.error('Failed to get local media:', error);
        ui.showToast('カメラ・マイクにアクセスできませんでした');
    }

    // シグナリング（ローカルデモ用）
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('code') || 'demo';
    const signaling = new LocalSignaling(roomId);

    // シグナリングイベント
    signaling.on('join', async ({ from }) => {
        console.log('Peer joined:', from);
        rtc.createPeerConnection(from);
        rtc.createDataChannel(from);

        const offer = await rtc.createOffer(from);
        signaling.send('offer', offer, from);
    });

    signaling.on('offer', async ({ from, data }) => {
        console.log('Received offer from:', from);
        const answer = await rtc.handleOffer(from, data);
        signaling.send('answer', answer, from);
    });

    signaling.on('answer', async ({ from, data }) => {
        console.log('Received answer from:', from);
        await rtc.handleAnswer(from, data);
    });

    signaling.on('ice-candidate', async ({ from, data }) => {
        await rtc.addIceCandidate(from, data);
    });

    // ICE候補の送信
    rtc.on('iceCandidate', ({ peerId, candidate }) => {
        signaling.send('ice-candidate', candidate, peerId);
    });

    // リモートトラックの受信
    rtc.on('remoteTrack', ({ peerId, streams }) => {
        if (streams[0]) {
            ui.addRemoteVideo(peerId, streams[0]);
        }
    });

    // ピア切断
    rtc.on('peerDisconnected', ({ peerId }) => {
        ui.removeRemoteVideo(peerId);
    });

    // DataChannelメッセージ
    rtc.on('dataChannelMessage', ({ peerId, data }) => {
        switch (data.type) {
            case 'reaction':
                ui.showFloatingReaction(data.emoji);
                break;
            case 'whiteboard-draw':
                whiteboard.applyRemoteDraw(data.data);
                break;
            case 'whiteboard-clear':
                whiteboard.clear();
                break;
            case 'transcription':
                transcription.renderEntry(data.entry);
                break;
        }
    });

    // 参加を通知
    setTimeout(() => {
        signaling.broadcast('join', { peerId: signaling.peerId });
    }, 1000);

    // グローバルに公開（デバッグ用）
    window.nextMeetApp = {
        settings,
        media,
        rtc,
        chat,
        ui,
        transcription,
        whiteboard,
        recording,
        signaling
    };

    console.log('NextMeet initialized');
});

// Export
window.NextMeet = window.NextMeet || {};
window.NextMeet.RecordingManager = RecordingManager;
