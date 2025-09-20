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
        this.alwaysOnToggle = document.getElementById('alwaysOnToggle');
        this.alwaysOnIndicator = document.getElementById('alwaysOnIndicator');
        
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
        
        // Speech session tracking
        this.currentSessionTranscript = '';
        this.speechTimeout = null;
        this.speechTimeoutDuration = 2000; // 2 seconds of silence before sending
        
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
        this.recognition.lang = 'en-US';
        
        // Track accumulated transcript for current session
        this.currentSessionTranscript = '';
        
        this.recognition.onstart = () => {
            console.log('[Speech] Recognition started');
            this.isListening = true;
            this.currentSessionTranscript = ''; // Reset transcript for new session
            this.updateVoiceUI();
            this.setVoiceState(true);
        };
        
        this.recognition.onend = () => {
            console.log('[Speech] Recognition ended');
            this.isListening = false;
            this.updateVoiceUI();
            this.setVoiceState(false);
            
            // Send final accumulated transcript if we have any
            if (this.currentSessionTranscript && this.currentSessionTranscript.trim()) {
                const finalTranscript = this.currentSessionTranscript.trim();
                console.log('[Speech] Sending final session transcript:', finalTranscript);
                this.sendVoiceInput(finalTranscript);
                this.currentSessionTranscript = '';
            }
            
            // Auto-restart if in always-on mode and not speaking
            if (this.alwaysOnMode && !this.isSpeaking) {
                console.log('[Speech] Auto-restarting recognition in always-on mode');
                this.restartTimeout = setTimeout(() => {
                    this.startListening();
                }, 1000); // Longer delay for non-continuous mode
            }
        };
        
        this.recognition.onresult = (event) => {
            console.log('[Speech] Recognition result event:', event);
            
            // In non-continuous mode, just take the last result
            if (event.results.length > 0) {
                const lastResult = event.results[event.results.length - 1];
                const transcript = lastResult[0].transcript;
                
                console.log('[Speech] Last result:', { 
                    isFinal: lastResult.isFinal, 
                    transcript: transcript,
                    transcriptType: typeof transcript 
                });
                
                // Validate transcript before using it
                if (transcript && typeof transcript === 'string' && transcript !== 'undefined' && transcript.trim() !== '') {
                    if (lastResult.isFinal) {
                        this.currentSessionTranscript = transcript.trim();
                        console.log('[Speech] Final transcript set to:', this.currentSessionTranscript);
                    }
                    
                    // Display current speech
                    this.speechDisplay.textContent = transcript;
                    this.speechDisplay.classList.add('active');
                } else {
                    console.warn('[Speech] Invalid transcript:', { transcript, type: typeof transcript });
                    this.speechDisplay.textContent = 'Listening...';
                    this.speechDisplay.classList.remove('active');
                }
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('[Speech] Recognition error:', event.error);
            this.speechDisplay.textContent = `Speech recognition error: ${event.error}`;
            this.isListening = false;
            this.updateVoiceUI();
            
            // Handle errors in always-on mode
            if (this.alwaysOnMode && !this.isSpeaking) {
                console.log('[Speech] Attempting to restart recognition after error in always-on mode');
                this.restartTimeout = setTimeout(() => {
                    if (this.alwaysOnMode && !this.isListening && !this.isSpeaking) {
                        this.startListening();
                    }
                }, 2000); // Longer delay for error recovery
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
        
        // Always-on toggle event listener
        this.alwaysOnToggle.addEventListener('click', () => {
            this.toggleAlwaysOnMode();
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
        
        if (this.alwaysOnMode) {
            // In always-on mode, clicking the button should toggle always-on off
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
        
        this.recognition.stop();
    }
    
    toggleAlwaysOnMode() {
        this.alwaysOnMode = !this.alwaysOnMode;
        console.log('[Speech] Always-on mode:', this.alwaysOnMode ? 'enabled' : 'disabled');
        
        // Update UI
        this.updateAlwaysOnUI();
        
        if (this.alwaysOnMode) {
            // Start listening when enabling always-on mode
            this.startListening();
        } else {
            // Stop listening when disabling always-on mode
            this.stopListening();
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
    
    speakText(text) {
        if ('speechSynthesis' in window) {
            // Store the current speech text and show it
            this.currentSpeechText = text;
            this.showAISpeech(text);
            
            // Stop listening while speaking to avoid echo/feedback
            this.wasListeningBeforeTTS = this.isListening;
            if (this.isListening) {
                console.log('[TTS] Pausing listening during speech');
                this.recognition.stop();
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
                
                // Resume listening if it was active before TTS or if in always-on mode
                if ((this.wasListeningBeforeTTS || this.alwaysOnMode) && !this.isListening) {
                    console.log('[TTS] Resuming listening after speech');
                    setTimeout(() => {
                        if (!this.isListening && (this.wasListeningBeforeTTS || this.alwaysOnMode)) {
                            this.startListening();
                        }
                    }, 500); // Small delay to avoid immediate pickup of TTS tail
                }
            };
            
            utterance.onerror = (event) => {
                console.error('[TTS] Speech error:', event);
                this.isSpeaking = false;
                this.updateSpeakingStatus(false);
                this.hideAISpeech();
                
                // Resume listening on error too
                if ((this.wasListeningBeforeTTS || this.alwaysOnMode) && !this.isListening) {
                    console.log('[TTS] Resuming listening after TTS error');
                    setTimeout(() => {
                        if (!this.isListening) {
                            this.recognition.start();
                        }
                    }, 500);
                }
            };
            
            speechSynthesis.speak(utterance);
        } else {
            console.warn('[TTS] Speech synthesis not available');
        }
    }
    
    updateVoiceUI() {
        if (this.isSpeaking) {
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
            this.voiceBtn.classList.remove('listening');
            if (this.alwaysOnMode) {
                this.voiceBtnText.textContent = 'Turn Off Always-On';
                this.voiceText.textContent = 'Always-On (Restarting...)';
            } else {
                this.voiceBtnText.textContent = 'Start Listening';
                this.voiceText.textContent = 'Voice Inactive';
                this.speechDisplay.textContent = 'Start speaking and your words will appear here...';
                this.speechDisplay.classList.remove('active');
            }
            this.voiceBtn.disabled = this.isSpeaking ? true : !this.isConnected;
            this.voiceStatus.classList.remove('active');
        }
        
        // Update test voice button
        this.testVoiceBtn.disabled = this.isSpeaking;
    }
    
    updateSpeakingStatus(speaking) {
        this.isSpeaking = speaking;
        this.updateVoiceUI();
        
        if (speaking) {
            this.speechDisplay.textContent = 'AI Assistant is speaking...';
            this.speechDisplay.classList.add('active');
        }
    }
    
    showAISpeech(text) {
        this.aiSpeechText.textContent = text;
        this.aiSpeechDisplay.style.display = 'block';
        console.log('[UI] Showing AI speech:', text);
    }
    
    hideAISpeech() {
        setTimeout(() => {
            this.aiSpeechDisplay.style.display = 'none';
            this.aiSpeechText.textContent = '';
            console.log('[UI] Hiding AI speech display');
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
                
                // Load always-on mode preference
                if (prefs.alwaysOnMode !== undefined) {
                    this.alwaysOnMode = prefs.alwaysOnMode;
                    this.updateAlwaysOnUI();
                    console.log('[Preferences] Loaded always-on mode:', prefs.alwaysOnMode);
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
                alwaysOnMode: this.alwaysOnMode,
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