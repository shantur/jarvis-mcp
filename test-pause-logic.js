#!/usr/bin/env node

// Test the pause during speech logic
console.log('Testing Pause During Speech Logic...\n');

class MockVoiceClient {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.pauseDuringSpeech = true;
        this.wasListeningBeforeTTS = false;
        this.alwaysOnMode = false;
        this.speechDisplay = { textContent: '', classList: { add: () => {}, remove: () => {} } };
        this.voiceBtn = { disabled: false };
        this.testVoiceBtn = { disabled: false };
    }

    // Mock the key logic from updateVoiceUI
    updateVoiceUI() {
        // If pause during speech is disabled and we're still listening, prioritize listening state
        if (this.isSpeaking && this.pauseDuringSpeech) {
            console.log('  UI: Speaking mode (buttons disabled)');
            this.voiceBtn.disabled = true;
        } else if (this.isListening) {
            console.log('  UI: Listening mode (buttons enabled)');
            this.voiceBtn.disabled = false;
        } else {
            console.log('  UI: Inactive mode');
            this.voiceBtn.disabled = false;
        }
        
        // Update test voice button - only disable if speaking AND pausing is enabled
        this.testVoiceBtn.disabled = this.isSpeaking && this.pauseDuringSpeech;
    }

    // Mock the speakText logic
    startSpeaking() {
        console.log('  Starting AI speech...');
        this.wasListeningBeforeTTS = this.isListening;
        
        if (this.isListening && this.pauseDuringSpeech) {
            console.log('  Pausing speech recognition');
            this.isListening = false;
        } else if (this.isListening && !this.pauseDuringSpeech) {
            console.log('  Continuing speech recognition');
        }
        
        this.isSpeaking = true;
        this.updateVoiceUI();
    }

    // Mock the speech end logic
    finishSpeaking() {
        console.log('  Finishing AI speech...');
        this.isSpeaking = false;
        
        // Resume listening if it was active before TTS or if in always-on mode (and if pausing was enabled)
        if (this.pauseDuringSpeech && (this.wasListeningBeforeTTS || this.alwaysOnMode) && !this.isListening) {
            console.log('  Resuming speech recognition');
            this.isListening = true;
        }
        
        this.updateVoiceUI();
    }

    getButtonStates() {
        return {
            voiceBtn: this.voiceBtn.disabled ? 'DISABLED' : 'ENABLED',
            testBtn: this.testVoiceBtn.disabled ? 'DISABLED' : 'ENABLED',
            listening: this.isListening,
            speaking: this.isSpeaking
        };
    }
}

// Test scenarios
function runTest(description, setupFn) {
    console.log(`\n🧪 Test: ${description}`);
    const client = new MockVoiceClient();
    setupFn(client);
    
    console.log('Initial state:', client.getButtonStates());
    client.startSpeaking();
    console.log('During speech:', client.getButtonStates());
    client.finishSpeaking();
    console.log('After speech:', client.getButtonStates());
}

// Scenario 1: Pause enabled, listening active
runTest('Pause enabled + listening active', (client) => {
    client.pauseDuringSpeech = true;
    client.isListening = true;
});

// Scenario 2: Pause disabled, listening active  
runTest('Pause disabled + listening active', (client) => {
    client.pauseDuringSpeech = false;
    client.isListening = true;
});

// Scenario 3: Pause disabled, always-on mode
runTest('Pause disabled + always-on mode', (client) => {
    client.pauseDuringSpeech = false;
    client.isListening = true;
    client.alwaysOnMode = true;
});

// Scenario 4: Pause enabled, not listening
runTest('Pause enabled + not listening', (client) => {
    client.pauseDuringSpeech = true;
    client.isListening = false;
});

console.log('\n✅ Expected Results:');
console.log('• Pause enabled + listening: Should pause recognition, disable buttons during speech');
console.log('• Pause disabled + listening: Should continue recognition, keep buttons enabled');
console.log('• Pause disabled + always-on: Should continue recognition, keep buttons enabled');
console.log('• Pause enabled + not listening: No change in recognition state');