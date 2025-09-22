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
        this.speechControls = document.getElementById('speechControls');
        this.speechControlsHeader = document.getElementById('speechControlsHeader');
        this.speechControlsToggle = document.getElementById('speechControlsToggle');
        
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
        
        this.initializeSpeechRecognition();
        this.initializeEventSource();
        this.setupEventListeners();
        this.initializeTTS();
        this.loadUserPreferences();
        
        // Auto-refresh status every 5 seconds
        setInterval(() => this.refreshStatus(), 5000);
    }
    
    initializeSpeechRecognition() {
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
        
        // Speech controls collapse/expand event listeners
        this.speechControlsHeader.addEventListener('click', () => {
            this.toggleSpeechControls();
        });
        
        this.speechControlsToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double trigger from header click
            this.toggleSpeechControls();
        });
    }
    
    handleServerMessage(data) {
        console.log('[SSE] Received:', data);
        
        switch (data.type) {
            case 'connected':
                console.log('[SSE] Server acknowledged connection');
                break;
                
            case 'speak':
                this.speakText(data.text);
                break;
                
            case 'queueUpdate':
                this.updateQueueDisplay(data.recentInputs);
                this.queueCount.textContent = `Queue: ${data.pendingCount}`;
                break;
                
            case 'statusUpdate':
                this.updateStatusFromServer(data);
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
        
        console.log('[API] Sending voice input:', text);
        
        try {
            const response = await fetch(`${this.baseUrl}/api/voice-input`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text.trim() }),
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
        if (!this.recognition) return;
        
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
        if (!this.recognition || this.isListening) return;
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('[Speech] Failed to start recognition:', error);
        }
    }
    
    stopListening() {
        if (!this.recognition || !this.isListening) return;
        
        // Clear any pending restart timeout
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
        this.isAutoRestarting = false;
        
        this.recognition.stop();
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
        } else {
            // Stop listening when disabling always-on mode
            this.stopListening();
            // Set voice state to inactive when disabling always-on mode
            this.setVoiceState(false);
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
    
    toggleSpeechControls() {
        this.speechControls.classList.toggle('collapsed');
        console.log('[UI] Speech controls:', this.speechControls.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    }
    
    ensureListeningActive() {
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
                this.recognition.stop();
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
                this.voiceText.textContent = 'Always Listening';
            } else {
                this.voiceBtnText.textContent = 'Stop Listening';
                this.voiceText.textContent = 'Voice Active';
            }
            this.voiceBtn.disabled = false;
            this.voiceStatus.classList.add('active');
        } else {
            if (this.alwaysOnMode) {
                // Check if we're auto-restarting vs genuinely not listening
                if (this.isAutoRestarting) {
                    // Auto-restarting - keep showing "Always Listening" to avoid flicker
                    this.voiceBtn.classList.add('listening');
                    this.voiceBtnText.textContent = 'Turn Off Always-On';
                    this.voiceText.textContent = 'Always Listening';
                    this.voiceBtn.disabled = false;
                    this.voiceStatus.classList.add('active');
                } else {
                    // Genuinely not listening - show ready state
                    this.voiceBtn.classList.remove('listening');
                    this.voiceBtnText.textContent = 'Start Always-On';
                    this.voiceText.textContent = 'Always-On Ready';
                    this.speechDisplay.textContent = 'Click "Start Always-On" to begin continuous listening...';
                    this.speechDisplay.classList.remove('active');
                    this.voiceBtn.disabled = !this.isConnected;
                    this.voiceStatus.classList.remove('active');
                }
            } else {
                // Normal mode - show inactive state
                this.voiceBtn.classList.remove('listening');
                this.voiceBtnText.textContent = 'Start Listening';
                this.voiceText.textContent = 'Voice Inactive';
                this.speechDisplay.textContent = 'Start speaking and your words will appear here...';
                this.speechDisplay.classList.remove('active');
                this.voiceBtn.disabled = (this.isSpeaking && this.pauseDuringSpeech) ? true : !this.isConnected;
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
        if (this.isConnected) {
            this.connectionStatus.classList.remove('disconnected');
            this.connectionStatus.classList.add('connected');
            this.connectionText.textContent = 'Connected';
            this.voiceBtn.disabled = false;
            this.testVoiceBtn.disabled = false;
        } else {
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
            this.connectionText.textContent = 'Disconnected';
            this.voiceBtn.disabled = true;
            this.testVoiceBtn.disabled = true;
        }
    }
    
    updateStatusFromServer(data) {
        // Update voice status from server
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