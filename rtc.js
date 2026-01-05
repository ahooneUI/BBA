/**
 * NextMeet - WebRTC Module
 * P2P接続の管理
 */

class RTCManager {
    constructor(settingsManager) {
        this.settings = settingsManager;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        this.localStream = null;
        this.callbacks = new Map();

        // STUN/TURNサーバー設定
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }

    /**
     * ローカルストリームを設定
     */
    setLocalStream(stream) {
        this.localStream = stream;
    }

    /**
     * 新しいピア接続を作成
     */
    createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.config);

        // ローカルトラックを追加
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // ICE候補のハンドリング
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.emit('iceCandidate', {
                    peerId,
                    candidate: event.candidate
                });
            }
        };

        // 接続状態の監視
        pc.onconnectionstatechange = () => {
            this.emit('connectionStateChange', {
                peerId,
                state: pc.connectionState
            });

            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.handleDisconnection(peerId);
            }
        };

        // ICE接続状態の監視
        pc.oniceconnectionstatechange = () => {
            this.emit('iceConnectionStateChange', {
                peerId,
                state: pc.iceConnectionState
            });
        };

        // リモートトラックの受信
        pc.ontrack = (event) => {
            this.emit('remoteTrack', {
                peerId,
                streams: event.streams,
                track: event.track
            });
        };

        // DataChannelの受信
        pc.ondatachannel = (event) => {
            this.setupDataChannel(peerId, event.channel);
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    /**
     * DataChannelをセットアップ
     */
    setupDataChannel(peerId, channel) {
        channel.onopen = () => {
            this.emit('dataChannelOpen', { peerId });
        };

        channel.onclose = () => {
            this.emit('dataChannelClose', { peerId });
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit('dataChannelMessage', { peerId, data });
            } catch (e) {
                // バイナリデータ（ファイル共有等）
                this.emit('dataChannelBinary', { peerId, data: event.data });
            }
        };

        this.dataChannels.set(peerId, channel);
    }

    /**
     * DataChannelを作成
     */
    createDataChannel(peerId, label = 'nextmeet') {
        const pc = this.peerConnections.get(peerId);
        if (!pc) return null;

        const channel = pc.createDataChannel(label, {
            ordered: true
        });

        this.setupDataChannel(peerId, channel);
        return channel;
    }

    /**
     * Offerを作成
     */
    async createOffer(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (!pc) {
            this.createPeerConnection(peerId);
        }

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        await pc.setLocalDescription(offer);

        return offer;
    }

    /**
     * Offerを処理してAnswerを作成
     */
    async handleOffer(peerId, offer) {
        let pc = this.peerConnections.get(peerId);
        if (!pc) {
            pc = this.createPeerConnection(peerId);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        return answer;
    }

    /**
     * Answerを処理
     */
    async handleAnswer(peerId, answer) {
        const pc = this.peerConnections.get(peerId);
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    /**
     * ICE候補を追加
     */
    async addIceCandidate(peerId, candidate) {
        const pc = this.peerConnections.get(peerId);
        if (!pc) return;

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    /**
     * トラックを置換（画面共有用）
     */
    async replaceTrack(oldTrack, newTrack) {
        for (const [peerId, pc] of this.peerConnections) {
            const senders = pc.getSenders();
            const sender = senders.find(s => s.track?.kind === oldTrack.kind);

            if (sender) {
                await sender.replaceTrack(newTrack);
            }
        }
    }

    /**
     * DataChannelでメッセージを送信
     */
    sendMessage(peerId, message) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    /**
     * 全ピアにブロードキャスト
     */
    broadcast(message) {
        for (const [peerId, channel] of this.dataChannels) {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        }
    }

    /**
     * 切断処理
     */
    handleDisconnection(peerId) {
        this.emit('peerDisconnected', { peerId });
        this.removePeer(peerId);
    }

    /**
     * ピアを削除
     */
    removePeer(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
        }

        const channel = this.dataChannels.get(peerId);
        if (channel) {
            channel.close();
            this.dataChannels.delete(peerId);
        }
    }

    /**
     * 全接続をクローズ
     */
    closeAll() {
        for (const [peerId, pc] of this.peerConnections) {
            pc.close();
        }
        this.peerConnections.clear();
        this.dataChannels.clear();
    }

    /**
     * 接続統計を取得
     */
    async getStats(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (!pc) return null;

        const stats = await pc.getStats();
        const result = {
            bytesReceived: 0,
            bytesSent: 0,
            packetsLost: 0,
            roundTripTime: 0
        };

        stats.forEach(report => {
            if (report.type === 'inbound-rtp') {
                result.bytesReceived += report.bytesReceived || 0;
                result.packetsLost += report.packetsLost || 0;
            }
            if (report.type === 'outbound-rtp') {
                result.bytesSent += report.bytesSent || 0;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                result.roundTripTime = report.currentRoundTripTime || 0;
            }
        });

        return result;
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

// シグナリング用のシンプルなブロードキャストチャンネル（同一ブラウザ用）
class LocalSignaling {
    constructor(roomId) {
        this.channel = new BroadcastChannel(`nextmeet_${roomId}`);
        this.peerId = this.generatePeerId();
        this.callbacks = new Map();

        this.channel.onmessage = (event) => {
            const { type, from, to, data } = event.data;

            // 自分宛てまたはブロードキャストのみ処理
            if (to && to !== this.peerId) return;
            if (from === this.peerId) return;

            this.emit(type, { from, data });
        };
    }

    generatePeerId() {
        return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    send(type, data, to = null) {
        this.channel.postMessage({
            type,
            from: this.peerId,
            to,
            data
        });
    }

    broadcast(type, data) {
        this.send(type, data, null);
    }

    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.callbacks.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }

    close() {
        this.channel.close();
    }
}

// Export
window.NextMeet = window.NextMeet || {};
window.NextMeet.RTCManager = RTCManager;
window.NextMeet.LocalSignaling = LocalSignaling;
