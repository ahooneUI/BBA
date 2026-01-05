/**
 * NextMeet - Media Module
 * カメラ・マイク・画面共有の制御
 */

class MediaManager {
    constructor(settingsManager) {
        this.settings = settingsManager;
        this.localStream = null;
        this.screenStream = null;
        this.isMicMuted = false;
        this.isCameraOff = false;
        this.isScreenSharing = false;
        this.callbacks = new Map();
    }

    /**
     * ローカルメディアストリームを取得
     */
    async getLocalStream() {
        try {
            const constraints = this.settings.getMediaConstraints();
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // ローカルビデオに表示
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }

            this.emit('streamReady', this.localStream);
            return this.localStream;
        } catch (error) {
            console.error('Failed to get local stream:', error);
            this.emit('error', { type: 'media', error });
            throw error;
        }
    }

    /**
     * マイクのオン/オフ切り替え
     */
    toggleMicrophone() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });

        this.isMicMuted = !audioTracks[0]?.enabled;
        this.updateMicUI();
        this.emit('micToggled', !this.isMicMuted);

        return !this.isMicMuted;
    }

    /**
     * カメラのオン/オフ切り替え
     */
    toggleCamera() {
        if (!this.localStream) return false;

        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });

        this.isCameraOff = !videoTracks[0]?.enabled;
        this.updateCameraUI();
        this.emit('cameraToggled', !this.isCameraOff);

        return !this.isCameraOff;
    }

    /**
     * 画面共有を開始
     */
    async startScreenShare() {
        try {
            const constraints = this.settings.getScreenShareConstraints();
            this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

            // 画面共有終了時のハンドラ
            this.screenStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };

            this.isScreenSharing = true;
            this.updateScreenShareUI();
            this.emit('screenShareStarted', this.screenStream);

            return this.screenStream;
        } catch (error) {
            console.error('Failed to start screen share:', error);
            this.emit('error', { type: 'screenShare', error });
            return null;
        }
    }

    /**
     * 画面共有を停止
     */
    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }

        this.isScreenSharing = false;
        this.updateScreenShareUI();
        this.emit('screenShareStopped');
    }

    /**
     * 画面共有のトグル
     */
    async toggleScreenShare() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
        return this.isScreenSharing;
    }

    /**
     * メディア制約を更新
     */
    async applyConstraints() {
        if (!this.localStream) return;

        const constraints = this.settings.getMediaConstraints();

        try {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                await videoTrack.applyConstraints(constraints.video);
            }

            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                await audioTrack.applyConstraints(constraints.audio);
            }

            this.emit('constraintsApplied', constraints);
        } catch (error) {
            console.error('Failed to apply constraints:', error);
        }
    }

    /**
     * マイクUIを更新
     */
    updateMicUI() {
        const micBtn = document.getElementById('micBtn');
        const micOnIcon = document.getElementById('micOnIcon');
        const micOffIcon = document.getElementById('micOffIcon');

        if (micBtn) {
            micBtn.classList.toggle('muted', this.isMicMuted);
            micBtn.classList.toggle('secondary', !this.isMicMuted);
        }
        if (micOnIcon) micOnIcon.classList.toggle('hidden', this.isMicMuted);
        if (micOffIcon) micOffIcon.classList.toggle('hidden', !this.isMicMuted);
    }

    /**
     * カメラUIを更新
     */
    updateCameraUI() {
        const cameraBtn = document.getElementById('cameraBtn');
        const cameraOnIcon = document.getElementById('cameraOnIcon');
        const cameraOffIcon = document.getElementById('cameraOffIcon');

        if (cameraBtn) {
            cameraBtn.classList.toggle('muted', this.isCameraOff);
            cameraBtn.classList.toggle('secondary', !this.isCameraOff);
        }
        if (cameraOnIcon) cameraOnIcon.classList.toggle('hidden', this.isCameraOff);
        if (cameraOffIcon) cameraOffIcon.classList.toggle('hidden', !this.isCameraOff);
    }

    /**
     * 画面共有UIを更新
     */
    updateScreenShareUI() {
        const shareBtn = document.getElementById('shareScreenBtn');
        if (shareBtn) {
            if (this.isScreenSharing) {
                shareBtn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    <span class="text-sm">Stop Sharing</span>
                `;
                shareBtn.classList.add('from-accent-red', 'to-red-600');
                shareBtn.classList.remove('from-accent-orange', 'to-orange-600');
            } else {
                shareBtn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    <span class="text-sm">Share Screen</span>
                `;
                shareBtn.classList.remove('from-accent-red', 'to-red-600');
                shareBtn.classList.add('from-accent-orange', 'to-orange-600');
            }
        }
    }

    /**
     * カメラ/マイクのデバイス一覧を取得
     */
    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                audioInputs: devices.filter(d => d.kind === 'audioinput'),
                videoInputs: devices.filter(d => d.kind === 'videoinput'),
                audioOutputs: devices.filter(d => d.kind === 'audiooutput')
            };
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            return { audioInputs: [], videoInputs: [], audioOutputs: [] };
        }
    }

    /**
     * デバイスを切り替え
     */
    async switchDevice(kind, deviceId) {
        if (!this.localStream) return;

        const constraints = this.settings.getMediaConstraints();

        if (kind === 'audio') {
            constraints.audio.deviceId = { exact: deviceId };
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
            const newTrack = newStream.getAudioTracks()[0];
            const oldTrack = this.localStream.getAudioTracks()[0];

            this.localStream.removeTrack(oldTrack);
            this.localStream.addTrack(newTrack);
            oldTrack.stop();

            this.emit('trackReplaced', { kind: 'audio', track: newTrack });
        } else if (kind === 'video') {
            constraints.video.deviceId = { exact: deviceId };
            const newStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video });
            const newTrack = newStream.getVideoTracks()[0];
            const oldTrack = this.localStream.getVideoTracks()[0];

            this.localStream.removeTrack(oldTrack);
            this.localStream.addTrack(newTrack);
            oldTrack.stop();

            // ローカルビデオを更新
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }

            this.emit('trackReplaced', { kind: 'video', track: newTrack });
        }
    }

    /**
     * 全てのメディアを停止
     */
    stopAll() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.stopScreenShare();
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
window.NextMeet.MediaManager = MediaManager;
