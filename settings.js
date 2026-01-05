/**
 * NextMeet - Settings Module
 * 設定管理とメディア制約の適用
 */

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.callbacks = new Map();
    }

    /**
     * デフォルト設定
     */
    static DEFAULT_SETTINGS = {
        audio: {
            noiseSuppression: true,
            echoCancellation: true,
            quality: 'voice' // 'high' | 'voice'
        },
        video: {
            resolution: 720,
            frameRate: 30
        },
        screenShare: {
            quality: 'standard' // 'high' | 'standard'
        },
        features: {
            whiteboard: false,
            recording: false,
            focusMode: false
        }
    };

    /**
     * 設定をロード
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('nextmeet_settings');
            if (saved) {
                return { ...SettingsManager.DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        return { ...SettingsManager.DEFAULT_SETTINGS };
    }

    /**
     * 設定を保存
     */
    saveSettings() {
        try {
            localStorage.setItem('nextmeet_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    /**
     * 設定値を取得
     */
    get(path) {
        const keys = path.split('.');
        let value = this.settings;
        for (const key of keys) {
            value = value?.[key];
        }
        return value;
    }

    /**
     * 設定値を更新
     */
    set(path, value) {
        const keys = path.split('.');
        let obj = this.settings;
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        this.saveSettings();
        this.emit('change', { path, value });
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

    /**
     * メディア制約を生成
     */
    getMediaConstraints() {
        const { audio, video } = this.settings;

        return {
            audio: {
                echoCancellation: audio.echoCancellation,
                noiseSuppression: audio.noiseSuppression,
                autoGainControl: true
            },
            video: {
                width: { ideal: this.getWidth(video.resolution) },
                height: { ideal: video.resolution },
                frameRate: { ideal: video.frameRate }
            }
        };
    }

    /**
     * 画面共有の制約を生成
     */
    getScreenShareConstraints() {
        const { screenShare, video } = this.settings;
        const isHigh = screenShare.quality === 'high';

        return {
            video: {
                cursor: 'always',
                width: { ideal: isHigh ? 1920 : 1280 },
                height: { ideal: isHigh ? 1080 : 720 },
                frameRate: { ideal: isHigh ? 60 : 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        };
    }

    /**
     * 解像度から幅を計算
     */
    getWidth(height) {
        return Math.round(height * (16 / 9));
    }

    /**
     * オーディオビットレートを取得
     */
    getAudioBitrate() {
        return this.settings.audio.quality === 'high' ? 128000 : 64000;
    }

    /**
     * UI要素との同期
     */
    syncWithUI() {
        const { audio, video, screenShare, features } = this.settings;

        // Audio toggles
        this.setToggle('noiseSuppressionToggle', audio.noiseSuppression);
        this.setToggle('echoCancellationToggle', audio.echoCancellation);
        this.setSelect('audioQualitySelect', audio.quality);

        // Video selects
        this.setSelect('resolutionSelect', video.resolution);
        this.setSelect('frameRateSelect', video.frameRate);

        // Screen share quality buttons
        this.updateScreenQualityButtons(screenShare.quality);

        // Features
        this.setToggle('whiteboardToggle', features.whiteboard);
        this.setToggle('recordToggle', features.recording);
        this.setToggle('focusModeToggle', features.focusMode);
    }

    /**
     * トグルスイッチを設定
     */
    setToggle(id, value) {
        const el = document.getElementById(id);
        if (el) el.checked = value;
    }

    /**
     * セレクトを設定
     */
    setSelect(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    /**
     * 画面共有品質ボタンを更新
     */
    updateScreenQualityButtons(quality) {
        const high = document.getElementById('screenQualityHigh');
        const standard = document.getElementById('screenQualityStandard');

        if (high && standard) {
            if (quality === 'high') {
                high.classList.add('bg-accent-orange', 'text-white');
                high.classList.remove('bg-dark-600');
                standard.classList.remove('bg-accent-orange', 'text-white');
                standard.classList.add('bg-dark-600');
            } else {
                standard.classList.add('bg-accent-orange', 'text-white');
                standard.classList.remove('bg-dark-600');
                high.classList.remove('bg-accent-orange', 'text-white');
                high.classList.add('bg-dark-600');
            }
        }
    }

    /**
     * UIイベントリスナーをバインド
     */
    bindUIEvents() {
        // Audio toggles
        this.bindToggle('noiseSuppressionToggle', 'audio.noiseSuppression');
        this.bindToggle('echoCancellationToggle', 'audio.echoCancellation');
        this.bindSelect('audioQualitySelect', 'audio.quality');

        // Video selects
        this.bindSelect('resolutionSelect', 'video.resolution', parseInt);
        this.bindSelect('frameRateSelect', 'video.frameRate', parseInt);

        // Screen share quality
        document.getElementById('screenQualityHigh')?.addEventListener('click', () => {
            this.set('screenShare.quality', 'high');
            this.updateScreenQualityButtons('high');
        });
        document.getElementById('screenQualityStandard')?.addEventListener('click', () => {
            this.set('screenShare.quality', 'standard');
            this.updateScreenQualityButtons('standard');
        });

        // Features
        this.bindToggle('whiteboardToggle', 'features.whiteboard');
        this.bindToggle('recordToggle', 'features.recording');
        this.bindToggle('focusModeToggle', 'features.focusMode');
    }

    /**
     * トグルスイッチをバインド
     */
    bindToggle(id, path) {
        document.getElementById(id)?.addEventListener('change', (e) => {
            this.set(path, e.target.checked);
        });
    }

    /**
     * セレクトをバインド
     */
    bindSelect(id, path, transform = (v) => v) {
        document.getElementById(id)?.addEventListener('change', (e) => {
            this.set(path, transform(e.target.value));
        });
    }
}

// Export
window.NextMeet = window.NextMeet || {};
window.NextMeet.SettingsManager = SettingsManager;
