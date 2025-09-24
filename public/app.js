class VoiceInterfaceClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.eventSource = null;
        this.recognition = null;
        this.isListening = false;
        this.isConnected = false;
        
        // DOM elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionText = document.getElementById('connectionText');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.voiceText = document.getElementById('voiceText');
        this.queueCount = document.getElementById('queueCount');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.voiceBtnText = document.getElementById('voiceBtnText');
        this.clearBtn = document.getElementById('clearBtn');
        this.testVoiceBtn = document.getElementById('testVoiceBtn');
        this.speechDisplay = document.getElementById('speechDisplay');
        this.timeoutIndicator = document.getElementById('timeoutIndicator');
        this.queueItems = document.getElementById('queueItems');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.aiSpeechDisplay = document.getElementById('aiSpeechDisplay');
        this.aiSpeechText = document.getElementById('aiSpeechText');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.languageSelect = document.getElementById('languageSelect');
        this.alwaysOnToggle = document.getElementById('alwaysOnToggle');
        this.alwaysOnIndicator = document.getElementById('alwaysOnIndicator');
        this.pauseDuringSpeechToggle = document.getElementById('pauseDuringSpeechToggle');
        this.stopAiOnUserSpeechToggle = document.getElementById('stopAiOnUserSpeechToggle');
        this.silenceThresholdSlider = document.getElementById('silenceThresholdSlider');
        this.silenceThresholdValue = document.getElementById('silenceThresholdValue');
        this.silenceDurationInput = document.getElementById('silenceDurationInput');
        this.speechControls = document.getElementById('speechControls');
        this.speechControlsHeader = document.getElementById('speechControlsHeader');
        this.speechControlsToggle = document.getElementById('speechControlsToggle');
        this.sessionOverlay = document.getElementById('sessionOverlay');
        this.useHereButton = document.getElementById('useHereButton');
        this.useOtherButton = document.getElementById('useOtherButton');
        this.shareSection = document.getElementById('shareSection');
        this.overlayShareGrid = document.getElementById('overlayShareGrid');
        this.overlayFooter = document.getElementById('overlayFooter');
        this.sessionBanner = document.getElementById('sessionBanner');
        this.shareToggleButton = document.getElementById('shareToggle');
        this.deviceDrawer = document.getElementById('deviceDrawer');
        this.drawerShareGrid = document.getElementById('drawerShareGrid');
        this.closeDrawerButton = document.getElementById('closeDrawerButton');
        this.autoClaimOption = document.getElementById('autoClaimOption');
        this.rememberDeviceToggle = document.getElementById('rememberDeviceToggle');
        this.rememberDurationText = document.getElementById('rememberDuration');

        // TTS state
        this.isSpeaking = false;
        this.wasListeningBeforeTTS = false;
        this.currentSpeechText = '';
        this.availableVoices = [];
        this.selectedVoice = null;
        this.preferencesSaved = document.getElementById('preferencesSaved');
        
        // Always-on microphone state
        this.alwaysOnMode = false;
        this.restartTimeout = null;
        this.isAutoRestarting = false;
        
        // Pause during speech state (default: true to prevent echo/feedback)
        this.pauseDuringSpeech = true;
        
        // Stop AI when user speaks (default: true for natural conversation)
        this.stopAiOnUserSpeech = true;
        
        // Speech recognition language (default: en-US)
        this.selectedLanguage = 'en-US';

        // Speech session tracking
        this.currentSessionTranscript = '';
        this.speechTimeout = null;
        this.speechTimeoutDuration = 2000; // 2 seconds of silence before sending

        // AI speech display timeout
        this.aiSpeechHideTimeout = null;

        // Conversation timeout tracking
        this.conversationDeadline = null;
        this.conversationTimeoutSeconds = null;
        this.conversationCountdownInterval = null;
        this.conversationCountdownInitial = null;
        this.conversationCountdownStartTime = null;

        // Speech-to-text configuration
        this.sttMode = 'browser';
        this.whisperConfigured = false;
        this.whisperProxyPath = '/api/whisper/transcriptions';
        this.mediaRecorderSupported = typeof MediaRecorder !== 'undefined';
        this.audioStream = null;
        this.mediaRecorder = null;
        this.mediaRecorderMimeType = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.audioAnalyser = null;
        this.audioAnalyserData = null;
        this.monitorSilenceRaf = null;
        this.collectingAudio = false;
        this.lastSpeechAt = 0;
        this.silenceThreshold = 0.015; // Tuneable RMS threshold for voice activity
        this.silenceDurationMs = 900;   // Consider silence if quiet for ~0.9s
        this.isTranscribing = false;
        this.lastWhisperTranscript = '';
        this.pendingWhisperStop = false;
        this.pendingUtterances = [];
        this.scriptProcessor = null;
        this.capturePCM = false;
        this.pcmChunks = [];
        this.zeroGainNode = null;
        this.debugLastStream = null;

        // Screen wake lock management
        this.wakeLockSentinel = null;
        this.wakeLockManuallyReleased = false;
        this.audioWakeLockContext = null;
        this.audioWakeLockOscillator = null;
        this.audioWakeLockGain = null;
        this.audioWakeLockEnabled = false;

        // Session management state
        this.clientId = null;
        this.activeClientId = null;
        this.sessionActiveHere = false;
        this.audioReady = false;
        this.hostCandidates = [];
        this.httpsPort = null;
        this.pendingAudioReady = false;
        this.overlayHasRenderedHosts = false;
        this.autoClaimSeconds = 0;
        this.autoClaimAttempted = false;
        this.autoClaimStateKey = 'mcpVoiceAutoClaim';
        this.autoClaimState = this.loadAutoClaimState();
        this.sessionStatusReceived = false;
        this.autoClaimInFlight = false;

        this.updateOverlayFooter('Connecting to voice server…');
        
        this.initializeEventSource();
        this.setupEventListeners();
        this.initializeTTS();
        this.loadUserPreferences();
        this.updateSilenceControlsUI();
        this.fetchServerConfig();
        
        // Auto-refresh status every 5 seconds
        setInterval(() => this.refreshStatus(), 5000);
    }

    initializeSpeechRecognition() {
        if (this.recognition) {
            return;
        }

        console.log('[Speech] Browser info:', {
            userAgent: navigator.userAgent,
            hasWebkitSpeech: 'webkitSpeechRecognition' in window,
            hasSpeech: 'SpeechRecognition' in window
        });
        
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            console.log('[Speech] Using webkitSpeechRecognition');
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
            console.log('[Speech] Using SpeechRecognition');
        } else {
            console.error('Speech recognition not supported');
            this.speechDisplay.textContent = 'Speech recognition not supported in this browser. Please use Chrome.';
            return;
        }
        
        // Check microphone permissions
        if (navigator.permissions) {
            navigator.permissions.query({name: 'microphone'}).then((result) => {
                console.log('[Speech] Microphone permission:', result.state);
            });
        }
        
        this.recognition.continuous = false; // Change to false for mobile
        this.recognition.interimResults = true;
        this.recognition.lang = this.selectedLanguage;
        
        // Track accumulated transcript for current session
        this.currentSessionTranscript = '';
        
        this.recognition.onstart = () => {
            console.log('[Speech] Recognition started');
            this.isListening = true;
            this.currentSessionTranscript = ''; // Reset transcript for new session
            this.updateVoiceUI();
            
            // Only set voice state if not in always-on mode, or if this is the first activation
            if (!this.alwaysOnMode) {
                this.setVoiceState(true);
            }
        };
        
        this.recognition.onend = () => {
            console.log('[Speech] Recognition ended');
            this.isListening = false;
            this.updateVoiceUI();
            
            // Only set voice state to false if not in always-on mode
            if (!this.alwaysOnMode) {
                this.setVoiceState(false);
            }
            
            // Send final accumulated transcript if we have any
            if (this.currentSessionTranscript && this.currentSessionTranscript.trim()) {
                const finalTranscript = this.currentSessionTranscript.trim();
                console.log('[Speech] Sending final session transcript:', finalTranscript);
                this.sendVoiceInput(finalTranscript);
                this.currentSessionTranscript = '';
            }
            
            // Auto-restart if in always-on mode OR if pause is disabled and we should be listening
            if (this.alwaysOnMode || (!this.pauseDuringSpeech && this.wasListeningBeforeTTS)) {
                const reason = this.alwaysOnMode ? 'always-on mode' : 'pause disabled during AI speech';
                console.log(`[Speech] Auto-restarting recognition in 100ms (${reason})`);
                this.isAutoRestarting = true;
                this.restartTimeout = setTimeout(() => {
                    if (!this.isListening && (this.alwaysOnMode || (!this.pauseDuringSpeech && this.wasListeningBeforeTTS))) {
                        this.startListening();
                    }
                    this.restartTimeout = null; // Clear timeout after execution
                    this.isAutoRestarting = false; // Clear auto-restart flag
                }, 100);
            }
        };
        
        this.recognition.onresult = (event) => {
            console.log('[Speech] Recognition result event:', event);
            
            // Build cumulative transcript from all results
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                
                if (result.isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Combine final and interim for display
            const displayTranscript = finalTranscript + interimTranscript;
            
            console.log('[Speech] Cumulative result:', { 
                finalTranscript: finalTranscript,
                interimTranscript: interimTranscript,
                displayTranscript: displayTranscript
            });
            
            // If AI is speaking and user starts talking, stop AI speech (natural conversation)
            if (this.isSpeaking && !this.pauseDuringSpeech && this.stopAiOnUserSpeech && displayTranscript.trim()) {
                console.log('[Speech] 🔇 User started speaking - stopping AI speech for natural conversation');
                speechSynthesis.cancel();
                this.isSpeaking = false;
                this.updateSpeakingStatus(false);
                this.hideAISpeech();
            }
            
            // Validate and display transcript
            if (displayTranscript && displayTranscript.trim() !== '') {
                // Store final transcript for sending
                if (finalTranscript) {
                    this.currentSessionTranscript = finalTranscript.trim();
                    console.log('[Speech] Final transcript set to:', this.currentSessionTranscript);
                }
                
                // Display cumulative speech (final + interim)
                this.speechDisplay.textContent = displayTranscript;
                this.speechDisplay.classList.add('active');
            } else {
                this.speechDisplay.textContent = 'Listening...';
                this.speechDisplay.classList.remove('active');
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('[Speech] Recognition error:', event.error);
            this.speechDisplay.textContent = `Speech recognition error: ${event.error}`;
            this.isListening = false;
            this.updateVoiceUI();
            
            // Handle errors in always-on mode or when pause is disabled
            if (this.alwaysOnMode || (!this.pauseDuringSpeech && this.wasListeningBeforeTTS)) {
                const reason = this.alwaysOnMode ? 'always-on mode' : 'pause disabled during AI speech';
                console.log(`[Speech] Attempting to restart recognition after error in 100ms (${reason})`);
                this.isAutoRestarting = true;
                this.restartTimeout = setTimeout(() => {
                    if (!this.isListening && (this.alwaysOnMode || (!this.pauseDuringSpeech && this.wasListeningBeforeTTS))) {
                        this.startListening();
                    }
                    this.restartTimeout = null; // Clear timeout after execution
                    this.isAutoRestarting = false; // Clear auto-restart flag
                }, 100);
            }
        };
    }

    async fetchServerConfig() {
        try {
            const response = await fetch(`${this.baseUrl}/api/config`);
            if (!response.ok) {
                throw new Error(`Config request failed with status ${response.status}`);
            }
            const data = await response.json();
            this.sttMode = data.sttMode || 'browser';
            this.whisperConfigured = !!data.whisperConfigured;
            if (typeof data.whisperProxyPath === 'string') {
            this.whisperProxyPath = data.whisperProxyPath;
            }
            if (Array.isArray(data.hostCandidates)) {
                this.hostCandidates = data.hostCandidates;
            }
            if (typeof data.httpsPort === 'number' || typeof data.httpsPort === 'string') {
                this.httpsPort = data.httpsPort;
            }
            if (typeof data.sessionAutoClaimSeconds === 'number') {
                this.autoClaimSeconds = Math.max(0, data.sessionAutoClaimSeconds);
            }
            this.updateAutoClaimUI();
            this.scheduleAutoClaimIfEligible();
            this.renderShareTargets();
        } catch (error) {
            console.error('[Config] Failed to load server config, falling back to browser STT:', error);
            this.sttMode = 'browser';
            this.whisperConfigured = false;
            this.autoClaimSeconds = 0;
            this.updateAutoClaimUI();
        }

        const whisperSupported = this.mediaRecorderSupported && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        if (this.sttMode === 'whisper' && (!this.whisperConfigured || !whisperSupported)) {
            console.warn('[Config] Whisper mode requested but not supported in browser, using Web Speech API');
            this.sttMode = 'browser';
        }

        if (this.sttMode === 'whisper') {
            await this.initializeWhisperResources();
        } else {
            this.initializeSpeechRecognition();
        }

        this.updateVoiceUI();
    }

    async initializeWhisperResources() {
        if (!this.mediaRecorderSupported) {
            console.error('[Whisper] MediaRecorder not supported in this browser');
            this.speechDisplay.textContent = 'Streaming transcription requires a modern browser with MediaRecorder support.';
            this.sttMode = 'browser';
            this.initializeSpeechRecognition();
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[Whisper] getUserMedia not available');
            this.speechDisplay.textContent = 'Microphone access is required for streaming transcription.';
            this.sttMode = 'browser';
            this.initializeSpeechRecognition();
            return;
        }

        if (this.audioStream) {
            // Already initialised
            this.setupMediaRecorder();
            return;
        }

        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[Whisper] Microphone stream acquired');
        } catch (error) {
            console.error('[Whisper] Failed to get microphone stream:', error);
            this.speechDisplay.textContent = 'Unable to access microphone for streaming transcription.';
            this.sttMode = 'browser';
            this.initializeSpeechRecognition();
            return;
        }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 2048;
            this.audioAnalyserData = new Float32Array(this.audioAnalyser.fftSize);
            source.connect(this.audioAnalyser);
            this.setupPcmCapture(source);
            console.log('[Whisper] Audio analyser initialised');
        } catch (error) {
            console.error('[Whisper] Failed to initialise audio analyser:', error);
            // We can still run without VAD but will rely on manual stop
            this.audioAnalyser = null;
        }

        this.setupMediaRecorder();
    }

    setupMediaRecorder() {
        if (!this.audioStream || this.mediaRecorder) {
            return;
        }

        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];

        const supportedType = candidates.find(type => {
            try {
                return MediaRecorder.isTypeSupported(type);
            } catch {
                return false;
            }
        }) || '';

        const options = supportedType ? { mimeType: supportedType } : undefined;
        this.mediaRecorderMimeType = supportedType || '';

        try {
            this.mediaRecorder = options ? new MediaRecorder(this.audioStream, options) : new MediaRecorder(this.audioStream);
            console.log('[Whisper] MediaRecorder initialised with type:', this.mediaRecorder.mimeType);
        } catch (error) {
            console.error('[Whisper] Failed to create MediaRecorder:', error);
            this.speechDisplay.textContent = 'Unable to start streaming transcription.';
            this.mediaRecorder = null;
            this.sttMode = 'browser';
            this.initializeSpeechRecognition();
            return;
        }

        this.mediaRecorder.addEventListener('dataavailable', (event) => {
            if (!this.collectingAudio) {
                return;
            }
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        });

        this.mediaRecorder.addEventListener('stop', () => {
            const chunkCount = this.audioChunks.length;
            this.collectingAudio = false;
            if (!this.pendingWhisperStop) {
                this.audioChunks = [];
                if (this.isListening) {
                    this.startMediaRecorderLoop();
                }
                return;
            }
            this.pendingWhisperStop = false;
            const type = this.mediaRecorderMimeType || this.mediaRecorder?.mimeType || 'audio/webm';
            const fallbackBlob = new Blob(this.audioChunks, { type });
            this.audioChunks = [];
            const finishUtterance = async () => {
                let wavBlob = null;
                try {
                    wavBlob = await this.exportRecordedWav();
                } catch (error) {
                    console.error('[Whisper] Failed to export PCM recording:', error);
                }

                if (!wavBlob || wavBlob.size === 0) {
                    if (fallbackBlob.size > 0 && chunkCount > 0) {
                        this.enqueueUtterance(fallbackBlob);
                    } else {
                        console.warn('[Whisper] No audio captured for utterance');
                        this.speechDisplay.textContent = 'No speech detected.';
                        this.speechDisplay.classList.remove('active');
                    }
                } else {
                    this.enqueueUtterance(wavBlob);
                }

                if (this.isListening) {
                    this.startMediaRecorderLoop();
                }
            };

            finishUtterance().catch((error) => {
                console.error('[Whisper] Failed to process utterance:', error);
                if (this.isListening) {
                    this.startMediaRecorderLoop();
                }
            });
        });

        this.mediaRecorder.addEventListener('error', (event) => {
            console.error('[Whisper] MediaRecorder error:', event.error);
        });
    }

    setupPcmCapture(source) {
        try {
            const bufferSize = 4096;
            this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            source.connect(this.scriptProcessor);
            this.zeroGainNode = this.audioContext.createGain();
            this.zeroGainNode.gain.value = 0;
            this.scriptProcessor.connect(this.zeroGainNode);
            this.zeroGainNode.connect(this.audioContext.destination);
            this.scriptProcessor.onaudioprocess = (event) => {
                if (!this.capturePCM) {
                    return;
                }
                const input = event.inputBuffer.getChannelData(0);
                this.pcmChunks.push(new Float32Array(input));
            };
            console.log('[Whisper] PCM capture initialised');
        } catch (error) {
            console.error('[Whisper] Failed to initialise PCM capture:', error);
            this.scriptProcessor = null;
            this.zeroGainNode = null;
        }
    }

    startMediaRecorderLoop() {
        if (!this.mediaRecorder) {
            return;
        }

        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        if (this.mediaRecorder.state === 'recording') {
            return;
        }

        this.audioChunks = [];
        this.collectingAudio = false;
        this.lastSpeechAt = 0;
        try {
            this.mediaRecorder.start(250);
            console.log('[Whisper] MediaRecorder loop started');
        } catch (error) {
            console.error('[Whisper] Failed to start MediaRecorder:', error);
            return;
        }

        if (!this.monitorSilenceRaf) {
            this.monitorWhisperSilence();
        }
    }

    monitorWhisperSilence() {
        if (this.sttMode !== 'whisper' || !this.isListening) {
            this.monitorSilenceRaf = null;
            return;
        }

        if (!this.audioAnalyser || !this.audioAnalyserData) {
            this.monitorSilenceRaf = requestAnimationFrame(() => this.monitorWhisperSilence());
            return;
        }

        this.audioAnalyser.getFloatTimeDomainData(this.audioAnalyserData);
        let sumSquares = 0;
        for (let i = 0; i < this.audioAnalyserData.length; i++) {
            const sample = this.audioAnalyserData[i];
            sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / this.audioAnalyserData.length);
        const now = performance.now();

        if (rms > this.silenceThreshold) {
            if (!this.collectingAudio) {
                console.log('[Whisper] Voice detected - starting utterance capture');
                this.collectingAudio = true;
                this.audioChunks = [];
                this.speechDisplay.textContent = 'Listening...';
                this.speechDisplay.classList.add('active');
                this.startPcmCapture();
            }
            this.lastSpeechAt = now;
        } else if (this.collectingAudio) {
            if (!this.lastSpeechAt) {
                this.lastSpeechAt = now;
            }
            if (now - this.lastSpeechAt > this.silenceDurationMs && !this.pendingWhisperStop) {
                console.log('[Whisper] Silence detected - finishing utterance');
                this.pendingWhisperStop = true;
                this.stopPcmCapture();
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    try {
                        this.mediaRecorder.requestData();
                    } catch (error) {
                        console.warn('[Whisper] requestData failed:', error);
                    }
                    this.mediaRecorder.stop();
                }
            }
        }

        this.monitorSilenceRaf = requestAnimationFrame(() => this.monitorWhisperSilence());
    }

    startWhisperListening() {
        if (!this.mediaRecorder) {
            this.setupMediaRecorder();
        }

        if (!this.mediaRecorder) {
            this.speechDisplay.textContent = 'Streaming transcription not available.';
            return;
        }

        if (this.isListening) {
            return;
        }

        this.isListening = true;
        this.pendingUtterances = [];
        this.collectingAudio = false;
        this.pendingWhisperStop = false;
        this.lastSpeechAt = 0;
        this.capturePCM = false;
        this.pcmChunks = [];
        this.setVoiceState(true);
        this.startMediaRecorderLoop();
        this.updateVoiceUI();
    }

    stopWhisperListening(pauseOnly = false) {
        if (this.isListening || pauseOnly) {
            this.isListening = false;
        }

        if (!pauseOnly && !this.alwaysOnMode) {
            this.setVoiceState(false);
        }

        this.collectingAudio = false;
        this.pendingWhisperStop = false;
        this.lastSpeechAt = 0;
        this.stopPcmCapture();
        this.pcmChunks = [];

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            try {
                this.mediaRecorder.stop();
            } catch (error) {
                console.warn('[Whisper] Failed to stop recorder:', error);
            }
        }

        if (this.monitorSilenceRaf) {
            cancelAnimationFrame(this.monitorSilenceRaf);
            this.monitorSilenceRaf = null;
        }

        if (!pauseOnly) {
            this.speechDisplay.textContent = 'Start speaking and your words will appear here...';
            this.speechDisplay.classList.remove('active');
        }

        this.updateVoiceUI();
    }

    ensureWhisperListeningActive() {
        setTimeout(() => {
            if (this.sttMode !== 'whisper') {
                return;
            }
            if (!this.isListening && (this.alwaysOnMode || this.wasListeningBeforeTTS)) {
                console.log('[Whisper] Resuming listening after AI speech');
                this.startListening();
                return;
            }
            if (this.isListening && this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
                console.log('[Whisper] MediaRecorder inactive - restarting');
                this.startMediaRecorderLoop();
            }
            if (this.isListening && !this.monitorSilenceRaf) {
                this.monitorWhisperSilence();
            }
        }, 500);

        setTimeout(() => {
            if (this.sttMode !== 'whisper' || !this.isListening) {
                return;
            }
            if (this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
                console.log('[Whisper] MediaRecorder still inactive - forcing restart');
                this.startMediaRecorderLoop();
            }
        }, 2000);
    }

    enqueueUtterance(blob) {
        if (!blob || blob.size === 0) {
            return;
        }

        this.pendingUtterances.push(blob);
        this.processUtteranceQueue().catch((error) => {
            console.error('[Whisper] Failed to process utterance queue:', error);
        });
    }

    async processUtteranceQueue() {
        if (this.isTranscribing) {
            return;
        }

        const nextBlob = this.pendingUtterances.shift();
        if (!nextBlob) {
            return;
        }

        this.isTranscribing = true;
        this.lastWhisperTranscript = '';
        this.speechDisplay.textContent = 'Transcribing with Whisper...';
        this.speechDisplay.classList.add('active');

        let wavBlob = nextBlob;
        let originalType = wavBlob.type || this.mediaRecorderMimeType || 'audio/webm';
        if (wavBlob.type !== 'audio/wav') {
            try {
                wavBlob = await this.convertBlobToWav(nextBlob);
                originalType = nextBlob.type || wavBlob.type || originalType;
            } catch (error) {
                console.error('[Whisper] Failed to convert audio to WAV, using original blob:', error);
            }
        }

        try {
            const transcriptBlob = await this.streamWhisperTranscription(wavBlob, originalType);
            if (transcriptBlob) {
                this.debugLastStream = transcriptBlob;
            }
        } catch (error) {
            console.error('[Whisper] Transcription failed:', error);
            this.speechDisplay.textContent = 'Whisper transcription failed. Check server logs and try again.';
        } finally {
            this.isTranscribing = false;
            if (this.pendingUtterances.length > 0) {
                this.processUtteranceQueue().catch((error) => {
                    console.error('[Whisper] Failed to continue utterance queue:', error);
                });
            }
        }
    }

    async streamWhisperTranscription(blob, originalType) {
        const formData = new FormData();
        const file = blob instanceof File
            ? blob
            : new File([blob], 'utterance.wav', { type: blob.type || 'audio/wav' });
        if (file.size <= 44) {
            console.warn('[Whisper] WAV appears empty, skipping');
            this.speechDisplay.textContent = 'No speech detected.';
            this.speechDisplay.classList.remove('active');
            return;
        }
        console.log('[Whisper] Uploading file', { size: file.size, type: file.type, originalType });
        formData.append('file', file, file.name);
        formData.append('response_format', 'text');
        formData.append('stream', 'true');
        formData.append('temperature', '0');
        if (this.selectedLanguage) {
            formData.append('language', this.selectedLanguage.split('-')[0]);
        }

        const response = await fetch(this.whisperProxyPath, {
            method: 'POST',
            body: formData,
            headers: {
                Accept: 'text/event-stream'
            }
        });

        if (!response.ok || !response.body) {
            throw new Error(`Whisper server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let streamEnded = false;
        const streamChunks = [];

        while (!streamEnded) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }

            if (value) {
                streamChunks.push(value);
            }

            buffer += decoder.decode(value || new Uint8Array(), { stream: true });

            let delimiter = this.findSseDelimiter(buffer);
            while (delimiter) {
                const rawEvent = buffer.slice(0, delimiter.index);
                buffer = buffer.slice(delimiter.index + delimiter.length);
                const shouldEnd = this.processWhisperEvent(rawEvent);
                if (shouldEnd) {
                    streamEnded = true;
                    try {
                        reader.cancel();
                    } catch (error) {
                        console.warn('[Whisper] Failed to cancel reader:', error);
                    }
                    break;
                }
                delimiter = this.findSseDelimiter(buffer);
            }
        }

        // Flush remaining decoder buffer
        buffer += decoder.decode();

        if (!streamEnded && buffer.trim().length > 0) {
            const shouldEnd = this.processWhisperEvent(buffer.trim());
            if (!shouldEnd) {
                // Server closed without explicit end event; treat remaining text as final
                this.handleWhisperFinal(buffer.trim());
            }
        }

        return streamChunks.length > 0
            ? new Blob(streamChunks.map(chunk => new Uint8Array(chunk)), { type: 'text/plain' })
            : null;
    }

    findSseDelimiter(buffer) {
        if (!buffer) {
            return null;
        }

        const candidates = [
            { index: buffer.indexOf('\r\n\r\n'), length: 4 },
            { index: buffer.indexOf('\n\n'), length: 2 },
            { index: buffer.indexOf('\r\r'), length: 2 }
        ].filter(item => item.index !== -1);

        if (candidates.length === 0) {
            return null;
        }

        candidates.sort((a, b) => a.index - b.index);
        return candidates[0];
    }

    processWhisperEvent(rawEvent) {
        if (!rawEvent || rawEvent.trim().length === 0) {
            return false;
        }

        const normalized = rawEvent.replace(/\r/g, '');
        const lines = normalized.split('\n');
        let eventType = 'message';
        const dataLines = [];

        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            } else if (!line.includes(':')) {
                // Chunked fallback without SSE headers
                dataLines.push(line.trim());
            }
        }

        const data = dataLines.join('\n').trim();

        if (eventType === 'end') {
            const finalText = data || this.lastWhisperTranscript;
            this.handleWhisperFinal(finalText);
            return true;
        }

        if (data.length === 0) {
            return false;
        }

        this.handleWhisperPartial(data);
        return false;
    }

    async convertBlobToWav(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
        await tempCtx.close();
        return await this.audioBufferToFile(audioBuffer);
    }

    startPcmCapture() {
        if (!this.scriptProcessor) {
            return;
        }
        this.capturePCM = true;
        this.pcmChunks = [];
    }

    stopPcmCapture() {
        this.capturePCM = false;
    }

    async exportRecordedWav() {
        if (!this.pcmChunks.length || !this.audioContext) {
            return null;
        }

        const sampleRate = this.audioContext.sampleRate;
        const totalLength = this.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const buffer = this.audioContext.createBuffer(1, totalLength, sampleRate);
        const channel = buffer.getChannelData(0);
        let offset = 0;
        for (const chunk of this.pcmChunks) {
            channel.set(chunk, offset);
            offset += chunk.length;
        }
        this.pcmChunks = [];

        return await this.audioBufferToFile(buffer);
    }

    async audioBufferToFile(audioBuffer) {
        if (typeof window.audioBufferToWav !== 'function') {
            throw new Error('audioBufferToWav library not loaded');
        }

        let workingBuffer = audioBuffer;
        if (workingBuffer.numberOfChannels > 1) {
            workingBuffer = this.downmixToMono(workingBuffer);
        }

        if (workingBuffer.sampleRate !== 16000) {
            workingBuffer = await this.resampleBuffer(workingBuffer, 16000);
        }

        const wavArrayBuffer = window.audioBufferToWav(workingBuffer, { float32: false });
        return new File([new Uint8Array(wavArrayBuffer)], 'utterance.wav', { type: 'audio/wav' });
    }

    downmixToMono(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer;
        }

        const frameCount = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const monoBuffer = new AudioBuffer({ length: frameCount, numberOfChannels: 1, sampleRate });
        const output = monoBuffer.getChannelData(0);

        const channelData = [];
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            channelData.push(audioBuffer.getChannelData(channel));
        }

        for (let i = 0; i < frameCount; i++) {
            let sum = 0;
            for (let channel = 0; channel < channelData.length; channel++) {
                sum += channelData[channel][i];
            }
            output[i] = sum / channelData.length;
        }

        return monoBuffer;
    }

    async resampleBuffer(audioBuffer, targetSampleRate) {
        const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
        const bufferSource = offlineCtx.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(offlineCtx.destination);
        bufferSource.start(0);
        return await offlineCtx.startRendering();
    }

    handleWhisperPartial(text) {
        const cleaned = this.cleanTranscript(text);
        if (!cleaned) {
            return;
        }

        this.lastWhisperTranscript = cleaned;
        this.currentSessionTranscript = cleaned;
        this.speechDisplay.textContent = cleaned;
        this.speechDisplay.classList.add('active');
    }

    handleWhisperFinal(text) {
        const cleaned = this.cleanTranscript(text || this.lastWhisperTranscript || '');
        if (!cleaned) {
            this.speechDisplay.textContent = 'No speech detected.';
            this.speechDisplay.classList.remove('active');
            return;
        }

        this.speechDisplay.textContent = cleaned;
        this.speechDisplay.classList.add('active');
        this.currentSessionTranscript = cleaned;
        this.sendVoiceInput(cleaned);
    }

    cleanTranscript(text) {
        if (!text) {
            return '';
        }

        const trimmed = text.trim();
        if (!trimmed) {
            return '';
        }

        const normalized = trimmed.toUpperCase();
        if (/^\[[A-Z_ ]+\]$/.test(normalized)) {
            return '';
        }

        // Remove bracketed placeholders anywhere in the text (both upper and lower case variants)
        const cleaned = trimmed
            .replace(/\[[^\]]*\]/g, ' ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned) {
            return '';
        }

        return cleaned;
    }
    
    initializeEventSource() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.eventSource = new EventSource(`${this.baseUrl}/events`);
        
        this.eventSource.onopen = () => {
            console.log('[SSE] Connected');
            this.isConnected = true;
            this.updateConnectionUI();
        };
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (error) {
                console.error('[SSE] Failed to parse message:', error);
            }
        };
        
        this.eventSource.onerror = () => {
            console.error('[SSE] Connection error');
            this.isConnected = false;
            this.updateConnectionUI();
            
            // Reconnect after 2 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    this.initializeEventSource();
                }
            }, 2000);
        };
    }
    
    initializeTTS() {
        // Test if speechSynthesis is available
        if ('speechSynthesis' in window) {
            console.log('[TTS] Speech synthesis available');
            this.loadVoices();
            
            // Voices may not be loaded immediately, listen for voiceschanged event
            speechSynthesis.addEventListener('voiceschanged', () => {
                this.loadVoices();
            });
        } else {
            console.warn('[TTS] Speech synthesis not available');
        }
    }
    
    setupEventListeners() {
        this.voiceBtn.addEventListener('click', () => {
            this.toggleListening();
        });
        
        this.clearBtn.addEventListener('click', () => {
            this.clearQueue();
        });
        
        this.testVoiceBtn.addEventListener('click', () => {
            this.testVoice();
        });
        
        // Speed slider event listener
        this.speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.speedValue.textContent = `${speed}x`;
            this.saveUserPreferences();
            console.log('[TTS] Speed changed to:', speed);
        });

        if (this.silenceThresholdSlider) {
            this.silenceThresholdSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!Number.isNaN(value)) {
                    this.silenceThreshold = value;
                    this.updateSilenceControlsUI();
                    this.saveUserPreferences();
                }
            });
        }

        if (this.silenceDurationInput) {
            const handleDurationChange = (e) => {
                let value = parseInt(e.target.value, 10);
                if (Number.isNaN(value)) {
                    value = this.silenceDurationMs;
                }
                value = Math.max(300, Math.min(3000, value));
                this.silenceDurationMs = value;
                this.updateSilenceControlsUI();
                this.saveUserPreferences();
            };
            this.silenceDurationInput.addEventListener('change', handleDurationChange);
            this.silenceDurationInput.addEventListener('input', handleDurationChange);
        }

        // Voice selection event listener
        this.voiceSelect.addEventListener('change', (e) => {
            const voiceURI = e.target.value;
            this.selectedVoice = this.availableVoices.find(voice => voice.voiceURI === voiceURI) || null;
            this.saveUserPreferences();
            console.log('[TTS] Voice changed to:', this.selectedVoice?.name || 'Default');
        });
        
        // Language selection event listener
        this.languageSelect.addEventListener('change', (e) => {
            this.selectedLanguage = e.target.value;
            console.log('[Speech] Language changed to:', this.selectedLanguage);
            
            // Update speech recognition language
            if (this.recognition) {
                this.recognition.lang = this.selectedLanguage;
            }
            
            this.saveUserPreferences();
        });
        
        // Always-on toggle event listener
        this.alwaysOnToggle.addEventListener('click', () => {
            this.toggleAlwaysOnMode();
        });
        
        // Pause during speech toggle event listener
        this.pauseDuringSpeechToggle.addEventListener('click', () => {
            this.togglePauseDuringSpeech();
        });
        
        // Stop AI on user speech toggle event listener
        this.stopAiOnUserSpeechToggle.addEventListener('click', () => {
            this.toggleStopAiOnUserSpeech();
        });

        if (this.rememberDeviceToggle) {
            this.rememberDeviceToggle.addEventListener('change', () => {
                if (!this.autoClaimSeconds) {
                    return;
                }
                if (this.rememberDeviceToggle.checked) {
                    const expiresAt = Date.now() + this.autoClaimSeconds * 1000;
                    this.persistAutoClaimState(expiresAt);
                    this.scheduleAutoClaimIfEligible();
                } else {
                    this.clearAutoClaimState();
                }
            });
        }
        
        // Speech controls collapse/expand event listeners
        this.speechControlsHeader.addEventListener('click', () => {
            this.toggleSpeechControls();
        });
        
        this.speechControlsToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double trigger from header click
            this.toggleSpeechControls();
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.alwaysOnMode) {
                this.requestWakeLock();
            }
        });

        window.addEventListener('beforeunload', () => {
            this.releaseWakeLock();
        });

        if (this.useHereButton) {
            this.useHereButton.addEventListener('click', async () => {
                await this.claimSessionHere();
            });
        }

        if (this.useOtherButton) {
            this.useOtherButton.addEventListener('click', () => {
                this.showShareOptions();
            });
        }

        if (this.shareToggleButton) {
            this.shareToggleButton.addEventListener('click', () => {
                this.openDeviceDrawer();
            });
        }

        if (this.closeDrawerButton) {
            this.closeDrawerButton.addEventListener('click', () => {
                this.closeDeviceDrawer();
            });
        }
    }
    
    handleServerMessage(data) {
        console.log('[SSE] Received:', data);
        
        switch (data.type) {
            case 'connected':
                console.log('[SSE] Server acknowledged connection');
                if (data.clientId) {
                    const firstAssignment = !this.clientId;
                    this.clientId = data.clientId;
                    if (firstAssignment) {
                        this.onClientIdReady();
                    }
                }
                if (typeof data.pendingCount === 'number') {
                    this.queueCount.textContent = `Queue: ${data.pendingCount}`;
                }
                this.updateStatusFromServer(data);
                this.updateConversationCountdown(data, 'connected');
                break;

            case 'sessionStatus':
                this.handleSessionStatus(data);
                break;
                
            case 'speak':
                if (this.sessionActiveHere) {
                    this.speakText(data.text);
                } else {
                    console.log('[SSE] Skipping TTS on inactive device');
                }
                break;
                
            case 'queueUpdate':
                this.updateQueueDisplay(data.recentInputs);
                this.queueCount.textContent = `Queue: ${data.pendingCount}`;
                break;
                
            case 'statusUpdate':
                this.updateStatusFromServer(data);
                this.updateConversationCountdown(data, 'status');
                break;

            case 'conversationWaiting':
                this.updateConversationCountdown(data, 'waiting');
                break;
                
            default:
                console.log('[SSE] Unknown message type:', data.type);
        }
    }
    
    async sendVoiceInput(text) {
        // Validate input before sending
        if (!text || typeof text !== 'string' || text.trim() === '' || text === 'undefined' || text.trim() === 'undefined') {
            console.warn('[API] Invalid voice input, skipping:', { text, type: typeof text, trimmed: text?.trim() });
            return;
        }

        const cleaned = this.cleanTranscript(text);
        if (!cleaned) {
            console.log('[API] Ignoring placeholder transcript:', text);
            return;
        }

        console.log('[API] Sending voice input:', cleaned);

        try {
            const response = await fetch(`${this.baseUrl}/api/voice-input`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: cleaned }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('[API] Voice input sent successfully');
                this.speechDisplay.textContent = 'Voice input sent to AI Assistant';
                this.speechDisplay.classList.remove('active');
            } else {
                console.error('[API] Failed to send voice input:', data.error);
            }
        } catch (error) {
            console.error('[API] Failed to send voice input:', error);
        }
    }
    
    async setVoiceState(active) {
        if (!this.sessionActiveHere) {
            return;
        }
        try {
            await fetch(`${this.baseUrl}/api/voice-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active }),
            });
        } catch (error) {
            console.error('[API] Failed to set voice state:', error);
        }
    }
    
    async refreshStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/status`);
            const data = await response.json();
            
            this.queueCount.textContent = `Queue: ${data.pendingInputs}`;
            this.updateQueueDisplay(data.recentInputs);
            this.updateStatusFromServer(data);
            this.updateConversationCountdown(data, 'poll');
        } catch (error) {
            console.error('[API] Failed to refresh status:', error);
        }
    }
    
    async clearQueue() {
        try {
            const response = await fetch(`${this.baseUrl}/api/clear`, {
                method: 'DELETE',
            });
            
            const data = await response.json();
            if (data.success) {
                console.log(`[API] Cleared ${data.clearedCount} items from queue`);
            }
        } catch (error) {
            console.error('[API] Failed to clear queue:', error);
        }
    }
    
    toggleListening() {
        if (!this.sessionActiveHere) {
            this.updateSessionBanner('Session is active on another device. Tap “Use This Device” to reclaim.');
            return;
        }

        if (this.alwaysOnMode && this.isListening) {
            // In always-on mode and currently listening, clicking should toggle always-on off
            this.toggleAlwaysOnMode();
            return;
        }

        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (!this.sessionActiveHere) {
            console.log('[Speech] Ignoring startListening because session is not active here');
            return;
        }

        if (this.isListening) {
            return;
        }

        if (this.sttMode === 'whisper') {
            this.startWhisperListening();
            return;
        }

        if (!this.recognition) {
            console.warn('[Speech] Recognition object missing');
            return;
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('[Speech] Failed to start recognition:', error);
        }
    }

    stopListening(pauseOnly = false) {
        if (!this.isListening && this.sttMode !== 'whisper') {
            return;
        }

        if (this.sttMode === 'whisper') {
            this.stopWhisperListening(pauseOnly);
            return;
        }

        if (!this.recognition || !this.isListening) {
            return;
        }

        // Clear any pending restart timeout
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        this.isAutoRestarting = false;

        this.recognition.stop();
    }

    async requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.log('[WakeLock] Screen wake lock not supported; using audio fallback');
            await this.enableAudioWakeLock();
            return;
        }

        if (this.wakeLockSentinel) {
            return;
        }

        try {
            this.wakeLockManuallyReleased = false;
            this.wakeLockSentinel = await navigator.wakeLock.request('screen');
            console.log('[WakeLock] Screen wake lock acquired');
            await this.disableAudioWakeLock();

            this.wakeLockSentinel.addEventListener('release', () => {
                console.log('[WakeLock] Screen wake lock released');
                this.wakeLockSentinel = null;

                if (this.alwaysOnMode && !this.wakeLockManuallyReleased && !document.hidden) {
                    this.requestWakeLock();
                }
            });
        } catch (error) {
            console.error('[WakeLock] Failed to acquire screen wake lock:', error);
            this.wakeLockSentinel = null;
            await this.enableAudioWakeLock();
        }
    }

    async releaseWakeLock() {
        if (!this.wakeLockSentinel) {
            await this.disableAudioWakeLock();
            return;
        }

        try {
            this.wakeLockManuallyReleased = true;
            await this.wakeLockSentinel.release();
        } catch (error) {
            console.error('[WakeLock] Failed to release screen wake lock:', error);
        } finally {
            this.wakeLockSentinel = null;
            setTimeout(() => {
                this.wakeLockManuallyReleased = false;
            }, 0);
            await this.disableAudioWakeLock();
        }
    }

    async enableAudioWakeLock() {
        if (this.audioWakeLockEnabled) {
            if (this.audioWakeLockContext && this.audioWakeLockContext.state === 'suspended') {
                try {
                    await this.audioWakeLockContext.resume();
                } catch (error) {
                    console.error('[WakeLock] Failed to resume audio context:', error);
                }
            }
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            console.warn('[WakeLock] Audio fallback not available');
            return;
        }

        try {
            this.audioWakeLockContext = new AudioCtx();
            this.audioWakeLockOscillator = this.audioWakeLockContext.createOscillator();
            this.audioWakeLockGain = this.audioWakeLockContext.createGain();

            this.audioWakeLockGain.gain.value = 0.0001;
            this.audioWakeLockOscillator.frequency.value = 0.5;

            this.audioWakeLockOscillator.connect(this.audioWakeLockGain);
            this.audioWakeLockGain.connect(this.audioWakeLockContext.destination);

            this.audioWakeLockOscillator.start();
            this.audioWakeLockEnabled = true;
            console.log('[WakeLock] Audio fallback started');
        } catch (error) {
            console.error('[WakeLock] Failed to start audio fallback:', error);
            this.audioWakeLockEnabled = false;
        }
    }

    async disableAudioWakeLock() {
        if (!this.audioWakeLockEnabled) {
            return;
        }

        try {
            if (this.audioWakeLockOscillator) {
                this.audioWakeLockOscillator.stop();
                this.audioWakeLockOscillator.disconnect();
            }
            if (this.audioWakeLockGain) {
                this.audioWakeLockGain.disconnect();
            }
            if (this.audioWakeLockContext) {
                await this.audioWakeLockContext.close();
            }
        } catch (error) {
            console.error('[WakeLock] Failed to stop audio fallback:', error);
        } finally {
            this.audioWakeLockOscillator = null;
            this.audioWakeLockGain = null;
            this.audioWakeLockContext = null;
            this.audioWakeLockEnabled = false;
        }
    }

    toggleAlwaysOnMode() {
        this.alwaysOnMode = !this.alwaysOnMode;
        console.log('[Speech] Always-on mode:', this.alwaysOnMode ? 'enabled' : 'disabled');
        
        // Update UI
        this.updateAlwaysOnUI();
        
        if (this.alwaysOnMode) {
            // Set voice state to active when enabling always-on mode
            this.setVoiceState(true);
            // Start listening when enabling always-on mode
            this.startListening();
            // Keep the screen awake while always-on is active
            this.requestWakeLock();
        } else {
            // Stop listening when disabling always-on mode
            this.stopListening();
            // Set voice state to inactive when disabling always-on mode
            this.setVoiceState(false);
            // Allow the screen to sleep again
            this.releaseWakeLock();
        }
        
        // Save preference
        this.saveUserPreferences();
    }
    
    updateAlwaysOnUI() {
        this.alwaysOnToggle.classList.toggle('active', this.alwaysOnMode);
        this.alwaysOnIndicator.style.display = this.alwaysOnMode ? 'inline' : 'none';
        
        // Update voice button text
        this.updateVoiceUI();
    }
    
    togglePauseDuringSpeech() {
        this.pauseDuringSpeech = !this.pauseDuringSpeech;
        console.log('[Speech] Pause during speech:', this.pauseDuringSpeech ? 'enabled' : 'disabled');
        
        // Update UI
        this.updatePauseDuringSpeechUI();
        
        // Save preference
        this.saveUserPreferences();
    }
    
    updatePauseDuringSpeechUI() {
        this.pauseDuringSpeechToggle.classList.toggle('active', this.pauseDuringSpeech);
    }

    toggleStopAiOnUserSpeech() {
        this.stopAiOnUserSpeech = !this.stopAiOnUserSpeech;
        console.log('[Speech] Stop AI on user speech:', this.stopAiOnUserSpeech ? 'enabled' : 'disabled');
        
        // Update UI
        this.updateStopAiOnUserSpeechUI();
        
        // Save preference
        this.saveUserPreferences();
    }
    
    updateStopAiOnUserSpeechUI() {
        this.stopAiOnUserSpeechToggle.classList.toggle('active', this.stopAiOnUserSpeech);
    }

    updateSilenceControlsUI() {
        if (this.silenceThresholdSlider) {
            this.silenceThresholdSlider.value = this.silenceThreshold.toFixed(3);
        }
        if (this.silenceThresholdValue) {
            this.silenceThresholdValue.textContent = this.silenceThreshold.toFixed(3);
        }
        if (this.silenceDurationInput) {
            this.silenceDurationInput.value = Math.round(this.silenceDurationMs);
        }
    }
    
    toggleSpeechControls() {
        this.speechControls.classList.toggle('collapsed');
        console.log('[UI] Speech controls:', this.speechControls.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    }
    
    ensureListeningActive() {
        if (this.sttMode === 'whisper') {
            this.ensureWhisperListeningActive();
            return;
        }

        // When pause is disabled, aggressively ensure recognition stays active
        console.log('[Speech] Ensuring recognition stays active during AI speech');
        
        // Check if recognition is actually working
        setTimeout(() => {
            if (!this.isListening && (this.alwaysOnMode || this.wasListeningBeforeTTS)) {
                console.log('[Speech] Recognition stopped during AI speech - restarting it');
                this.startListening();
            }
        }, 1000); // Check after 1 second
        
        // Also check again after 3 seconds  
        setTimeout(() => {
            if (!this.isListening && (this.alwaysOnMode || this.wasListeningBeforeTTS)) {
                console.log('[Speech] Recognition still stopped - restarting again');
                this.startListening();
            }
        }, 3000);
    }
    
    speakText(text) {
        if (!this.sessionActiveHere) {
            console.log('[TTS] Ignoring speech because this device is not active.');
            return;
        }
        if ('speechSynthesis' in window) {
            // Stop any currently playing speech to allow immediate interruption
            if (this.isSpeaking) {
                console.log('[TTS] 🔄 INTERRUPTING current speech to start new one');
                console.log('[TTS] Previous text:', this.currentSpeechText?.substring(0, 50) + '...');
                console.log('[TTS] New text:', text.substring(0, 50) + '...');
                speechSynthesis.cancel();
                this.isSpeaking = false;
                
                // Show brief interruption indicator
                this.showInterruptionIndicator();
            }
            
            // Store the current speech text and show it
            this.currentSpeechText = text;
            this.showAISpeech(text);
            
            // Only store listening state if we weren't already speaking
            // This preserves the original listening state across multiple interruptions
            if (!this.wasListeningBeforeTTS) {
                this.wasListeningBeforeTTS = this.isListening;
            }
            
            // Stop listening while speaking to avoid echo/feedback (if enabled)
            if (this.isListening && this.pauseDuringSpeech) {
                console.log('[TTS] Pausing listening during speech');
                this.stopListening(true);
            } else if (this.isListening && !this.pauseDuringSpeech) {
                console.log('[TTS] Keeping listening active during speech (pause disabled)');
                // Ensure recognition stays active - restart it if needed
                this.ensureListeningActive();
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Use the current speed from the slider
            const speed = parseFloat(this.speedSlider.value);
            utterance.rate = speed;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Use selected voice if available
            if (this.selectedVoice) {
                utterance.voice = this.selectedVoice;
                console.log('[TTS] Using voice:', this.selectedVoice.name);
            }
            
            utterance.onstart = () => {
                console.log('[TTS] Started speaking at speed:', speed);
                this.isSpeaking = true;
                this.updateSpeakingStatus(true);
            };
            
            utterance.onend = () => {
                console.log('[TTS] Finished speaking');
                this.isSpeaking = false;
                this.updateSpeakingStatus(false);
                this.hideAISpeech();
                
                // Resume listening based on pause setting and mode
                console.log('[TTS] Speech ended. Checking listening state:', {
                    isListening: this.isListening,
                    alwaysOnMode: this.alwaysOnMode,
                    pauseDuringSpeech: this.pauseDuringSpeech,
                    wasListeningBeforeTTS: this.wasListeningBeforeTTS
                });
                
                if (!this.isListening) {
                    if (this.pauseDuringSpeech && (this.wasListeningBeforeTTS || this.alwaysOnMode)) {
                        // If pausing was enabled, resume if we were listening before or in always-on mode
                        console.log('[TTS] Resuming listening after speech (pause was enabled)');
                        setTimeout(() => {
                            if (!this.isListening && (this.wasListeningBeforeTTS || this.alwaysOnMode)) {
                                this.startListening();
                            }
                        }, 500);
                    } else if (!this.pauseDuringSpeech && this.alwaysOnMode) {
                        // If pausing was disabled but we're in always-on mode, restart if somehow stopped
                        console.log('[TTS] Restarting always-on listening after speech (pause was disabled)');
                        setTimeout(() => {
                            if (!this.isListening && this.alwaysOnMode) {
                                this.startListening();
                            }
                        }, 500);
                    }
                } else if (this.alwaysOnMode && !this.pauseDuringSpeech) {
                    // If we're still listening, that's good! But make sure it stays active
                    console.log('[TTS] Recognition still active during always-on with pause disabled - good!');
                }
                
                // Reset the listening state tracker
                this.wasListeningBeforeTTS = false;
            };
            
            utterance.onerror = (event) => {
                console.error('[TTS] Speech error:', event);
                this.isSpeaking = false;
                this.updateSpeakingStatus(false);
                this.hideAISpeech();
                
                // Resume listening on error too
                if (!this.isListening) {
                    if (this.pauseDuringSpeech && (this.wasListeningBeforeTTS || this.alwaysOnMode)) {
                        console.log('[TTS] Resuming listening after TTS error (pause was enabled)');
                        setTimeout(() => {
                            if (!this.isListening) {
                                this.startListening();
                            }
                        }, 500);
                    } else if (!this.pauseDuringSpeech && this.alwaysOnMode) {
                        console.log('[TTS] Restarting always-on listening after TTS error (pause was disabled)');
                        setTimeout(() => {
                            if (!this.isListening && this.alwaysOnMode) {
                                this.startListening();
                            }
                        }, 500);
                    }
                }
                
                // Reset the listening state tracker
                this.wasListeningBeforeTTS = false;
            };
            
            speechSynthesis.speak(utterance);
        } else {
            console.warn('[TTS] Speech synthesis not available');
        }
    }
    
    updateVoiceUI() {
        console.log('[UI] updateVoiceUI called with state:', {
            isListening: this.isListening,
            alwaysOnMode: this.alwaysOnMode,
            isSpeaking: this.isSpeaking,
            pauseDuringSpeech: this.pauseDuringSpeech,
            restartTimeout: !!this.restartTimeout
        });
        if (!this.sessionActiveHere) {
            this.voiceBtn.classList.remove('listening');
            this.voiceBtnText.textContent = 'Use This Device to Talk';
            this.voiceBtn.disabled = true;
            if (this.voiceStatus) {
                this.voiceStatus.classList.remove('active');
            }
            if (this.voiceText) {
                this.voiceText.textContent = this.activeClientId ? 'Active elsewhere' : 'Awaiting device';
            }
            this.testVoiceBtn.disabled = true;
            return;
        }
        const usingWhisper = this.sttMode === 'whisper';
        const canStartWhisper = usingWhisper ? !!this.mediaRecorder : true;
        
        // If pause during speech is disabled and we're still listening, prioritize listening state
        if (this.isSpeaking && this.pauseDuringSpeech) {
            this.voiceBtn.classList.remove('listening');
            this.voiceBtnText.textContent = 'Speaking...';
            this.voiceBtn.disabled = true;
            this.voiceStatus.classList.add('active');
            this.voiceText.textContent = 'Speaking';
        } else if (this.isListening) {
            this.voiceBtn.classList.add('listening');
            if (this.alwaysOnMode) {
                this.voiceBtnText.textContent = 'Turn Off Always-On';
                this.voiceText.textContent = usingWhisper ? 'Always Listening (Whisper)' : 'Always Listening';
            } else {
                this.voiceBtnText.textContent = 'Stop Listening';
                this.voiceText.textContent = usingWhisper ? 'Whisper Listening' : 'Voice Active';
            }
            this.voiceBtn.disabled = false;
            this.voiceStatus.classList.add('active');
        } else {
            if (this.alwaysOnMode) {
                // Check if we're auto-restarting vs genuinely not listening
                if (this.isAutoRestarting && !usingWhisper) {
                    // Auto-restarting - keep showing "Always Listening" to avoid flicker
                    this.voiceBtn.classList.add('listening');
                    this.voiceBtnText.textContent = 'Turn Off Always-On';
                    this.voiceText.textContent = usingWhisper ? 'Always Listening (Whisper)' : 'Always Listening';
                    this.voiceBtn.disabled = !canStartWhisper;
                    this.voiceStatus.classList.add('active');
                } else {
                    // Genuinely not listening - show ready state
                    this.voiceBtn.classList.remove('listening');
                    this.voiceBtnText.textContent = 'Start Talking (Always-On)';
                    this.voiceText.textContent = usingWhisper ? 'Always-On Ready (Whisper)' : 'Always-On Ready';
                    this.speechDisplay.textContent = usingWhisper
                        ? 'Click "Start Talking (Always-On)" to begin Whisper streaming...'
                        : 'Click "Start Talking (Always-On)" to begin continuous listening...';
                    this.speechDisplay.classList.remove('active');
                    this.voiceBtn.disabled = !this.isConnected || !canStartWhisper;
                    this.voiceStatus.classList.remove('active');
                }
            } else {
                // Normal mode - show inactive state
                this.voiceBtn.classList.remove('listening');
                this.voiceBtnText.textContent = usingWhisper ? 'Start Talking (Whisper)' : 'Start Talking';
                this.voiceText.textContent = usingWhisper ? 'Whisper Idle' : 'Voice Inactive';
                this.speechDisplay.textContent = usingWhisper
                    ? 'Start speaking and Whisper will transcribe your words...'
                    : 'Start speaking and your words will appear here...';
                this.speechDisplay.classList.remove('active');
                const disableButton = (this.isSpeaking && this.pauseDuringSpeech)
                    ? true
                    : (!this.isConnected || !canStartWhisper);
                this.voiceBtn.disabled = disableButton;
                this.voiceStatus.classList.remove('active');
            }
        }
        
        // Update test voice button - only disable if speaking AND pausing is enabled
        this.testVoiceBtn.disabled = this.isSpeaking && this.pauseDuringSpeech;
    }
    
    updateSpeakingStatus(speaking) {
        this.isSpeaking = speaking;
        this.updateVoiceUI();
        
        if (speaking) {
            // Only override speech display if pausing is enabled or not listening
            if (this.pauseDuringSpeech || !this.isListening) {
                this.speechDisplay.textContent = 'AI Assistant is speaking...';
                this.speechDisplay.classList.add('active');
            }
        } else {
            // When speaking ends, restore speech display state if we were showing AI speech
            if (this.speechDisplay.textContent === 'AI Assistant is speaking...') {
                if (this.isListening) {
                    this.speechDisplay.textContent = 'Listening...';
                } else {
                    this.speechDisplay.textContent = 'Start speaking and your words will appear here...';
                    this.speechDisplay.classList.remove('active');
                }
            }
        }
    }
    
    showAISpeech(text) {
        // Cancel any pending hide timeout when showing new speech
        if (this.aiSpeechHideTimeout) {
            clearTimeout(this.aiSpeechHideTimeout);
            this.aiSpeechHideTimeout = null;
        }
        
        this.aiSpeechText.textContent = text;
        this.aiSpeechDisplay.style.display = 'block';
        console.log('[UI] Showing AI speech:', text);
        
        // Add a brief flash effect when speech is interrupted
        if (this.isSpeaking) {
            this.aiSpeechDisplay.style.animation = 'none';
            // Force reflow
            this.aiSpeechDisplay.offsetHeight;
            this.aiSpeechDisplay.style.animation = 'fadeIn 0.3s ease-in';
        }
    }
    
    showInterruptionIndicator() {
        // Briefly show an interruption indicator
        const header = this.aiSpeechDisplay.querySelector('.ai-speech-header');
        if (header) {
            const originalText = header.textContent;
            header.textContent = '🔄 Speech Interrupted - New message:';
            setTimeout(() => {
                header.textContent = originalText;
            }, 1500);
        }
    }
    
    hideAISpeech() {
        // Clear any pending hide timeout
        if (this.aiSpeechHideTimeout) {
            clearTimeout(this.aiSpeechHideTimeout);
        }
        
        this.aiSpeechHideTimeout = setTimeout(() => {
            // Only hide if we're not currently speaking (prevents hiding during interruptions)
            if (!this.isSpeaking) {
                this.aiSpeechDisplay.style.display = 'none';
                this.aiSpeechText.textContent = '';
                console.log('[UI] Hiding AI speech display');
            }
        }, 1000); // Keep visible for 1 second after speech ends
    }
    
    loadVoices() {
        this.availableVoices = speechSynthesis.getVoices();
        console.log('[TTS] Loaded voices:', this.availableVoices.length);
        
        if (this.availableVoices.length > 0) {
            this.populateVoiceSelect();
            this.applyVoicePreference();
        }
    }
    
    populateVoiceSelect() {
        // Clear existing options
        this.voiceSelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Default Voice';
        this.voiceSelect.appendChild(defaultOption);
        
        // Group voices by language for better organization
        const voicesByLang = {};
        this.availableVoices.forEach(voice => {
            const lang = voice.lang || 'unknown';
            if (!voicesByLang[lang]) {
                voicesByLang[lang] = [];
            }
            voicesByLang[lang].push(voice);
        });
        
        // Add voices, prioritizing English voices
        const sortedLangs = Object.keys(voicesByLang).sort((a, b) => {
            if (a.startsWith('en')) return -1;
            if (b.startsWith('en')) return 1;
            return a.localeCompare(b);
        });
        
        sortedLangs.forEach(lang => {
            const voices = voicesByLang[lang];
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' - Default' : ''}`;
                this.voiceSelect.appendChild(option);
            });
        });
        
        console.log('[TTS] Voice select populated with', this.availableVoices.length, 'voices');
    }
    
    loadUserPreferences() {
        try {
            const savedPrefs = localStorage.getItem('mcpVoicePreferences');
            if (savedPrefs) {
                const prefs = JSON.parse(savedPrefs);
                
                // Load speech speed
                if (prefs.speechSpeed !== undefined) {
                    this.speedSlider.value = prefs.speechSpeed;
                    this.speedValue.textContent = `${prefs.speechSpeed}x`;
                    console.log('[Preferences] Loaded speech speed:', prefs.speechSpeed);
                }
                
                // Load selected voice (will be applied when voices are loaded)
                if (prefs.selectedVoiceURI) {
                    this.preferredVoiceURI = prefs.selectedVoiceURI;
                    console.log('[Preferences] Will load voice:', prefs.selectedVoiceURI);
                }
                
                // Load selected language
                if (prefs.selectedLanguage) {
                    this.selectedLanguage = prefs.selectedLanguage;
                    this.languageSelect.value = prefs.selectedLanguage;
                    if (this.recognition) {
                        this.recognition.lang = this.selectedLanguage;
                    }
                    console.log('[Preferences] Loaded language:', prefs.selectedLanguage);
                }
                
                // Load always-on mode preference
                if (prefs.alwaysOnMode !== undefined) {
                    this.alwaysOnMode = prefs.alwaysOnMode;
                    this.updateAlwaysOnUI();
                    console.log('[Preferences] Loaded always-on mode:', prefs.alwaysOnMode);
                }
                
                // Load pause during speech preference
                if (prefs.pauseDuringSpeech !== undefined) {
                    this.pauseDuringSpeech = prefs.pauseDuringSpeech;
                    this.updatePauseDuringSpeechUI();
                    console.log('[Preferences] Loaded pause during speech:', prefs.pauseDuringSpeech);
                }
                
                // Load stop AI on user speech preference
                if (prefs.stopAiOnUserSpeech !== undefined) {
                    this.stopAiOnUserSpeech = prefs.stopAiOnUserSpeech;
                    this.updateStopAiOnUserSpeechUI();
                    console.log('[Preferences] Loaded stop AI on user speech:', prefs.stopAiOnUserSpeech);
                }

                if (prefs.silenceThreshold !== undefined) {
                    const value = parseFloat(prefs.silenceThreshold);
                    if (!Number.isNaN(value)) {
                        this.silenceThreshold = Math.min(0.1, Math.max(0.001, value));
                    }
                }

                if (prefs.silenceDurationMs !== undefined) {
                    const value = parseInt(prefs.silenceDurationMs, 10);
                    if (!Number.isNaN(value)) {
                        this.silenceDurationMs = Math.min(5000, Math.max(300, value));
                    }
                }
            }
        } catch (error) {
            console.error('[Preferences] Failed to load user preferences:', error);
        }
        
        // Apply voice preference when voices are available
        if (this.preferredVoiceURI && this.availableVoices.length > 0) {
            this.applyVoicePreference();
        }
    }
    
    applyVoicePreference() {
        if (this.preferredVoiceURI) {
            this.selectedVoice = this.availableVoices.find(voice => voice.voiceURI === this.preferredVoiceURI);
            if (this.selectedVoice) {
                this.voiceSelect.value = this.preferredVoiceURI;
                console.log('[Preferences] Applied voice preference:', this.selectedVoice.name);
            }
        }
    }
    
    saveUserPreferences() {
        try {
            const prefs = {
                speechSpeed: parseFloat(this.speedSlider.value),
                selectedVoiceURI: this.selectedVoice ? this.selectedVoice.voiceURI : null,
                selectedLanguage: this.selectedLanguage,
                alwaysOnMode: this.alwaysOnMode,
                pauseDuringSpeech: this.pauseDuringSpeech,
                stopAiOnUserSpeech: this.stopAiOnUserSpeech,
                silenceThreshold: this.silenceThreshold,
                silenceDurationMs: this.silenceDurationMs,
            };
            
            localStorage.setItem('mcpVoicePreferences', JSON.stringify(prefs));
            console.log('[Preferences] Saved user preferences:', prefs);
            
            // Show saved indicator
            this.showPreferencesSaved();
        } catch (error) {
            console.error('[Preferences] Failed to save user preferences:', error);
        }
    }
    
    showPreferencesSaved() {
        this.preferencesSaved.style.display = 'inline';
        this.preferencesSaved.classList.add('show');
        
        setTimeout(() => {
            this.preferencesSaved.classList.remove('show');
            setTimeout(() => {
                this.preferencesSaved.style.display = 'none';
            }, 300);
        }, 1500);
    }
    
    testVoice() {
        if (this.isSpeaking) {
            return; // Don't start new speech if already speaking
        }
        
        const testMessages = [
            "Hello! This is a test of the voice interface. Your current speech speed is " + this.speedSlider.value + "x",
            "The voice interface is working correctly. You can adjust the speed and voice settings above.",
            "This is your AI Assistant speaking. All voice settings are functioning properly.",
        ];
        
        const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
        console.log('[Test] Playing test voice message:', randomMessage);
        this.speakText(randomMessage);
    }
    
    updateConnectionUI() {
        if (!this.connectionStatus) {
            return;
        }

        this.connectionStatus.classList.remove('active', 'warning');

        if (this.isConnected) {
            this.connectionStatus.classList.remove('disconnected');
            this.connectionStatus.classList.add('connected');

            if (this.sessionActiveHere) {
                this.connectionStatus.classList.add('active');
                this.connectionText.textContent = 'Connected · This device active';
            } else if (this.activeClientId) {
                this.connectionStatus.classList.add('warning');
                this.connectionText.textContent = 'Connected · Active on another device';
            } else {
                this.connectionStatus.classList.add('warning');
                this.connectionText.textContent = 'Connected · Waiting for device';
            }

            this.testVoiceBtn.disabled = !(this.sessionActiveHere && !this.isSpeaking);
        } else {
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
            this.connectionText.textContent = 'Disconnected';
            this.testVoiceBtn.disabled = true;
            this.voiceBtn.disabled = true;
        }

        if (!this.sessionActiveHere) {
            this.voiceBtn.disabled = true;
        }
    }

    onClientIdReady() {
        if (this.useHereButton) {
            this.useHereButton.disabled = false;
        }
        this.updateOverlayFooter('Tap “Use This Device” to enable audio.');
        this.updateAutoClaimUI();
        this.scheduleAutoClaimIfEligible();
    }

    showShareOptions() {
        if (this.shareSection) {
            this.shareSection.style.display = 'block';
        }
        this.renderShareTargets();
        this.updateOverlayFooter('Scan a QR code or open a link on another device, then tap “Use This Device” there.');
    }

    openDeviceDrawer() {
        this.renderShareTargets();
        if (this.deviceDrawer) {
            this.deviceDrawer.classList.add('open');
        }
    }

    closeDeviceDrawer() {
        if (this.deviceDrawer) {
            this.deviceDrawer.classList.remove('open');
        }
    }

    updateOverlayFooter(message) {
        if (this.overlayFooter) {
            this.overlayFooter.textContent = message || '';
        }
    }

    showSessionOverlay() {
        if (!this.sessionOverlay) {
            return;
        }
        this.autoClaimAttempted = false;
        this.autoClaimState = this.loadAutoClaimState();
        this.autoClaimInFlight = false;
        this.updateAutoClaimUI();
        this.sessionOverlay.classList.remove('hidden');
        if (this.useHereButton) {
            this.useHereButton.disabled = !this.clientId;
        }
        setTimeout(() => this.scheduleAutoClaimIfEligible(), 0);
    }

    hideSessionOverlay() {
        if (this.sessionOverlay) {
            this.sessionOverlay.classList.add('hidden');
        }
        this.autoClaimAttempted = false;
    }

    handleSessionStatus(data) {
        this.activeClientId = data?.activeClientId || null;
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
        this.sessionStatusReceived = true;
        if (Array.isArray(data?.hostCandidates) && data.hostCandidates.length) {
            this.hostCandidates = data.hostCandidates;
        }
        if (typeof data?.httpsPort === 'number' || typeof data?.httpsPort === 'string') {
            this.httpsPort = data.httpsPort;
        }
        if (typeof data?.autoClaimSeconds === 'number') {
            const seconds = Math.max(0, data.autoClaimSeconds);
            if (seconds !== this.autoClaimSeconds) {
                this.autoClaimSeconds = seconds;
                this.updateAutoClaimUI();
            }
        }
        const activeSession = this.activeClientId
            ? sessions.find((session) => session.id === this.activeClientId)
            : null;

        const weAreActive = !!this.clientId && this.clientId === this.activeClientId && !!activeSession?.audioReady;
        this.sessionActiveHere = weAreActive;
        this.audioReady = !!activeSession?.audioReady && weAreActive;

        if (!activeSession || !activeSession.audioReady) {
            this.showSessionOverlay();
            this.updateSessionBanner('Waiting for a device to enable audio.');
        } else if (!weAreActive) {
            this.hideSessionOverlay();
            this.updateSessionBanner('Session is active on another device. Tap “Use This Device” to reclaim.');
            this.stopListening();
        } else {
            this.hideSessionOverlay();
            this.updateSessionBanner('');
        }

        this.updateConnectionUI();
        this.updateVoiceUI();
        this.renderShareTargets();
        this.scheduleAutoClaimIfEligible();
    }

    updateSessionBanner(message) {
        if (!this.sessionBanner) {
            return;
        }

        this.sessionBanner.innerHTML = '';
        this.sessionBanner.classList.remove('active');

        if (!message) {
            return;
        }

        const text = document.createElement('span');
        text.textContent = message;
        this.sessionBanner.appendChild(text);

        const showClaimButton = message.includes('Use This Device');
        if (showClaimButton) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Use This Device';
            button.className = 'share-toggle-btn';
            button.style.marginLeft = '12px';
            button.addEventListener('click', () => {
                this.claimSessionHere();
            });
            this.sessionBanner.appendChild(button);
        }

        this.sessionBanner.classList.add('active');
    }

    loadAutoClaimState() {
        try {
            const raw = localStorage.getItem(this.autoClaimStateKey);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.expiresAt === 'number') {
                return parsed;
            }
        } catch (error) {
            console.warn('[AutoClaim] Failed to load state:', error);
        }
        return null;
    }

    persistAutoClaimState(expiresAt) {
        if (!Number.isFinite(expiresAt)) {
            return;
        }
        const state = { expiresAt };
        this.autoClaimState = state;
        try {
            localStorage.setItem(this.autoClaimStateKey, JSON.stringify(state));
        } catch (error) {
            console.warn('[AutoClaim] Failed to persist state:', error);
        }
        if (this.rememberDeviceToggle) {
            this.rememberDeviceToggle.checked = true;
        }
    }

    clearAutoClaimState() {
        this.autoClaimState = null;
        try {
            localStorage.removeItem(this.autoClaimStateKey);
        } catch (error) {
            console.warn('[AutoClaim] Failed to clear state:', error);
        }
        if (this.rememberDeviceToggle) {
            this.rememberDeviceToggle.checked = false;
        }
    }

    formatDuration(seconds) {
        if (!seconds || seconds < 0) {
            return '';
        }
        if (seconds % 3600 === 0) {
            const hours = seconds / 3600;
            return hours === 1 ? '1 hour' : `${hours} hours`;
        }
        if (seconds >= 3600) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.round((seconds % 3600) / 60);
            if (minutes === 0) {
                return hours === 1 ? '1 hour' : `${hours} hours`;
            }
            return `${hours}h ${minutes}m`;
        }
        if (seconds % 60 === 0) {
            const minutes = seconds / 60;
            return minutes === 1 ? '1 minute' : `${minutes} minutes`;
        }
        return `${seconds} seconds`;
    }

    updateAutoClaimUI() {
        if (!this.autoClaimOption) {
            return;
        }

        if (!this.autoClaimSeconds) {
            this.autoClaimOption.style.display = 'none';
            return;
        }

        this.autoClaimOption.style.display = 'block';

        if (this.rememberDurationText) {
            this.rememberDurationText.textContent = this.formatDuration(this.autoClaimSeconds);
        }

        const state = this.loadAutoClaimState();
        const valid = !!state && typeof state.expiresAt === 'number' && state.expiresAt > Date.now();
        this.autoClaimState = valid ? state : null;

        if (!valid && this.rememberDeviceToggle) {
            this.rememberDeviceToggle.checked = true;
        }

        if (valid && this.rememberDeviceToggle) {
            this.rememberDeviceToggle.checked = true;
        }
    }

    scheduleAutoClaimIfEligible() {
        if (!this.sessionStatusReceived) {
            return;
        }
        if (this.autoClaimAttempted || this.autoClaimInFlight || this.sessionActiveHere || this.autoClaimSeconds <= 0 || this.pendingAudioReady) {
            return;
        }
        if (!this.clientId) {
            return;
        }
        const state = this.loadAutoClaimState();
        this.autoClaimState = state;
        if (!state || typeof state.expiresAt !== 'number') {
            return;
        }
        if (state.expiresAt <= Date.now()) {
            this.clearAutoClaimState();
            return;
        }
        if (this.activeClientId && this.activeClientId !== this.clientId) {
            return;
        }

        this.autoClaimAttempted = true;
        this.updateOverlayFooter('Reconnecting to this device…');
        if (this.useHereButton) {
            this.useHereButton.disabled = false;
        }
        this.claimSessionHere(true).then((success) => {
            if (!success && this.useHereButton) {
                this.useHereButton.disabled = false;
            }
        }).catch(() => {
            if (this.useHereButton) {
                this.useHereButton.disabled = false;
            }
            this.updateOverlayFooter('Automatic reconnect failed. Please tap “Use This Device”.');
        });
    }

    buildShareTargets() {
        if (!this.hostCandidates || !this.hostCandidates.length) {
            return [];
        }

        const port = this.httpsPort || window.location.port || 443;
        const targets = [];
        const seen = new Set();

        this.hostCandidates.forEach((host) => {
            if (typeof host !== 'string' || !host) {
                return;
            }
            const needsBrackets = host.includes(':') && !host.startsWith('[');
            const hostPart = needsBrackets ? `[${host}]` : host;
            const url = `https://${hostPart}:${port}`;
            if (seen.has(url)) {
                return;
            }
            seen.add(url);
            targets.push({ host, url });
        });

        return targets;
    }

    renderShareTargets() {
        const targets = this.buildShareTargets();

        if (!targets.length) {
            this.updateOverlayFooter('Waiting for shareable links…');
            return;
        }

        this.updateOverlayFooter('Tap “Use This Device” or share a link to open on another device.');
        this.populateShareGrid(this.overlayShareGrid, targets);
        this.populateShareGrid(this.drawerShareGrid, targets);

        if (this.shareSection && this.shareSection.style.display !== 'block' && !this.overlayHasRenderedHosts) {
            this.shareSection.style.display = 'block';
        }
        this.overlayHasRenderedHosts = true;
    }

    populateShareGrid(container, targets) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        targets.forEach((target) => {
            const card = document.createElement('div');
            card.className = 'share-card';

            if (window.SimpleQR) {
                try {
                    const canvas = window.SimpleQR.createCanvas(target.url, { size: 140, margin: 8 });
                    card.appendChild(canvas);
                } catch (error) {
                    console.warn('[QR] Failed to render QR code:', error);
                }
            }

            const urlEl = document.createElement('div');
            urlEl.className = 'share-url';
            urlEl.textContent = target.url;
            card.appendChild(urlEl);

            const actions = document.createElement('div');
            actions.className = 'share-actions';

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                this.copyToClipboard(target.url);
            });

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.textContent = 'Open';
            openBtn.addEventListener('click', () => {
                window.open(target.url, '_blank', 'noopener');
            });

            actions.appendChild(copyBtn);
            actions.appendChild(openBtn);
            card.appendChild(actions);

            container.appendChild(card);
        });
    }

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const tempInput = document.createElement('input');
                tempInput.value = text;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
            }
            this.updateOverlayFooter('Copied link to clipboard.');
        } catch (error) {
            console.error('[Clipboard] Failed to copy:', error);
            this.updateOverlayFooter('Copy failed. Long-press or right-click to copy.');
        }
    }

    async claimSessionHere(autoTriggered = false) {
        if (!this.clientId) {
            this.updateOverlayFooter('Still connecting… try again in a moment.');
            return false;
        }

        if (autoTriggered) {
            if (this.autoClaimInFlight) {
                return false;
            }
            this.autoClaimInFlight = true;
        } else {
            if (this.pendingAudioReady) {
                return false;
            }
            this.pendingAudioReady = true;
            if (this.useHereButton) {
                this.useHereButton.disabled = true;
            }
        }
        this.updateOverlayFooter(autoTriggered ? 'Reconnecting to this device…' : 'Enabling audio…');

        await this.resumeAudioContexts();

        let success = false;
        try {
            const label = this.buildDeviceLabel();
            const response = await fetch(`${this.baseUrl}/api/audio-ready`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clientId: this.clientId, label })
            });

            if (!response.ok) {
                throw new Error(`Audio-ready failed (${response.status})`);
            }

            this.activeClientId = this.clientId;
            this.sessionActiveHere = true;
            this.audioReady = true;
            this.updateConnectionUI();
            this.updateVoiceUI();
            this.hideSessionOverlay();
            this.updateOverlayFooter('');
            this.updateSessionBanner('');
            success = true;

            if (this.autoClaimSeconds > 0) {
                if (autoTriggered) {
                    const expiresAt = Date.now() + this.autoClaimSeconds * 1000;
                    this.persistAutoClaimState(expiresAt);
                } else if (this.rememberDeviceToggle && this.rememberDeviceToggle.checked) {
                    const expiresAt = Date.now() + this.autoClaimSeconds * 1000;
                    this.persistAutoClaimState(expiresAt);
                } else if (!autoTriggered) {
                    this.clearAutoClaimState();
                }
            }
        } catch (error) {
            console.error('[Audio] Failed to claim session:', error);
            this.updateOverlayFooter('Failed to enable audio. Check browser permissions and try again.');
            if (this.useHereButton) {
                this.useHereButton.disabled = false;
            }
            if (autoTriggered) {
                this.updateSessionBanner('Automatic reconnect failed. Tap “Use This Device” to reclaim.');
            }
        } finally {
            if (autoTriggered) {
                this.autoClaimInFlight = false;
            } else {
                this.pendingAudioReady = false;
            }
        }

        return success;
    }

    async resumeAudioContexts() {
        try {
            if (!this.audioContext && (window.AudioContext || window.webkitAudioContext)) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioCtx();
            }

            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.warn('[Audio] Failed to resume audio context:', error);
        }

        if ('speechSynthesis' in window) {
            try {
                speechSynthesis.cancel();
                speechSynthesis.resume();
            } catch (error) {
                console.warn('[Audio] Speech synthesis resume failed:', error);
            }
        }
    }

    buildDeviceLabel() {
        const ua = navigator.userAgent || '';
        if (!ua) {
            return undefined;
        }
        const parts = [];
        if (/Mobile/i.test(ua)) {
            parts.push('Mobile');
        }
        if (/Android/i.test(ua)) {
            parts.push('Android');
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
            parts.push('iOS');
        } else if (/Macintosh/i.test(ua)) {
            parts.push('macOS');
        } else if (/Windows/i.test(ua)) {
            parts.push('Windows');
        } else if (/Linux/i.test(ua)) {
            parts.push('Linux');
        }
        const browserMatch = ua.match(/(Chrome|Safari|Firefox|Edg|Brave)[\/]([\d\.]+)/i);
        if (browserMatch) {
            const name = browserMatch[1] === 'Edg' ? 'Edge' : browserMatch[1];
            parts.push(name);
        }
        return parts.join(' ');
    }

    updateConversationCountdown(data, source = 'status') {
        if (!this.timeoutIndicator) {
            return;
        }

        const waiting = typeof data.waiting === 'boolean'
            ? data.waiting
            : typeof data.conversationWaiting === 'boolean'
                ? data.conversationWaiting
                : false;

        if (!waiting) {
            this.clearConversationCountdown();
            return;
        }

        const timeoutSeconds = typeof data.timeoutSeconds === 'number'
            ? data.timeoutSeconds
            : typeof data.conversationWaitTimeout === 'number'
                ? data.conversationWaitTimeout
                : null;

        const remainingSecondsFromServer = typeof data.remainingSeconds === 'number'
            ? data.remainingSeconds
            : typeof data.conversationWaitRemaining === 'number'
                ? data.conversationWaitRemaining
                : null;

        this.conversationTimeoutSeconds = timeoutSeconds;
        this.conversationDeadline = typeof data.deadline === 'number'
            ? data.deadline
            : typeof data.conversationWaitDeadline === 'number'
                ? data.conversationWaitDeadline
                : null;

        const countdownRunning = typeof this.conversationCountdownInitial === 'number' && this.conversationCountdownStartTime !== null;

        if (typeof remainingSecondsFromServer === 'number' && countdownRunning && source !== 'waiting') {
            const elapsedSeconds = (performance.now() - this.conversationCountdownStartTime) / 1000;
            const currentRemaining = Math.max(0, this.conversationCountdownInitial - elapsedSeconds);
            if (Math.abs(currentRemaining - remainingSecondsFromServer) >= 2) {
                this.conversationCountdownInitial = remainingSecondsFromServer;
                this.conversationCountdownStartTime = performance.now();
            }
        }

        const initialSeconds = typeof remainingSecondsFromServer === 'number'
            ? remainingSecondsFromServer
            : typeof timeoutSeconds === 'number'
                ? timeoutSeconds
                : null;

        const shouldStartCountdown =
            source === 'waiting' ||
            (!countdownRunning && initialSeconds !== null) ||
            (source === 'connected' && initialSeconds !== null && !countdownRunning);

        if (shouldStartCountdown) {
            if (this.conversationCountdownInterval) {
                clearInterval(this.conversationCountdownInterval);
                this.conversationCountdownInterval = null;
            }
            this.conversationCountdownInitial = initialSeconds;
            this.conversationCountdownStartTime = initialSeconds !== null ? performance.now() : null;
        }

        this.startConversationCountdown();
    }

    startConversationCountdown() {
        if (!this.timeoutIndicator) {
            return;
        }

        this.timeoutIndicator.classList.add('active');

        if (!this.conversationCountdownInterval && typeof this.conversationCountdownInitial === 'number') {
            this.conversationCountdownInterval = setInterval(() => this.renderConversationCountdown(), 250);
        }

        this.renderConversationCountdown();
    }

    clearConversationCountdown() {
        if (this.conversationCountdownInterval) {
            clearInterval(this.conversationCountdownInterval);
            this.conversationCountdownInterval = null;
        }

        this.conversationDeadline = null;
        this.conversationTimeoutSeconds = null;
        this.conversationCountdownInitial = null;
        this.conversationCountdownStartTime = null;

        if (this.timeoutIndicator) {
            this.timeoutIndicator.textContent = '';
            this.timeoutIndicator.classList.remove('active');
        }
    }

    renderConversationCountdown() {
        if (!this.timeoutIndicator) {
            return;
        }

        if (typeof this.conversationCountdownInitial === 'number' && this.conversationCountdownStartTime !== null) {
            const elapsedSeconds = (performance.now() - this.conversationCountdownStartTime) / 1000;
            const remainingSeconds = Math.max(0, Math.ceil(this.conversationCountdownInitial - elapsedSeconds));

            this.timeoutIndicator.textContent = `${remainingSeconds}s left to respond.`;
        } else {
            this.timeoutIndicator.textContent = 'Awaiting your response...';
        }
    }

    updateStatusFromServer(data) {
        // Update voice status from server
        if (!this.sessionActiveHere) {
            this.voiceStatus.classList.remove('active');
            return;
        }

        if (data.voiceActive !== undefined) {
            if (data.voiceActive && !this.isListening) {
                this.voiceStatus.classList.add('active');
                this.voiceText.textContent = 'Voice Active (Server)';
            } else if (!data.voiceActive && !this.isListening) {
                this.voiceStatus.classList.remove('active');
                this.voiceText.textContent = 'Voice Inactive';
            }
        }
    }
    
    updateQueueDisplay(recentInputs) {
        if (!recentInputs || recentInputs.length === 0) {
            this.queueItems.innerHTML = '<div class="empty-state">No voice input yet</div>';
            return;
        }
        
        const itemsHtml = recentInputs.map(item => {
            const time = new Date(item.timestamp).toLocaleTimeString();
            return `
                <div class="queue-item">
                    <div class="queue-text">${item.text}</div>
                    <div class="queue-meta">
                        ${time}
                        <div class="queue-status status-${item.status}">${item.status}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.queueItems.innerHTML = itemsHtml;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceInterfaceClient();
});
