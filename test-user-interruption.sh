#!/bin/bash

echo "🎙️ TESTING USER BUTTON INTERRUPTION FEATURE"
echo "==========================================="
echo ""
echo "This test verifies that AI speech stops when user presses 'Start Talking' button"
echo ""
echo "🔧 MANUAL SETUP REQUIRED:"
echo "   1. ❌ Turn OFF 'Keep Microphone Always On' (Non-Always-On mode)"
echo "   2. ✅ Keep ON 'Stop AI When User Speaks' (must be enabled)"
echo "   3. Either setting for 'Pause Listening During AI Speech'"
echo "   4. 🎤 Test that speech recognition is working"
echo ""
echo "📋 TEST PROCEDURE:"
echo "   1. Script will send a long AI message"
echo "   2. While AI is speaking, click 'Start Talking' button"
echo "   3. AI speech should stop immediately"
echo "   4. Microphone should activate without feedback"
echo "   5. AI text should remain visible on screen"
echo ""

BASE_URL="https://localhost:5114"

echo "⏱️ Waiting 10 seconds for setup..."
sleep 10

echo ""
echo "$(date '+%H:%M:%S') - 🎤 Sending LONG AI message..."
echo "   👂 Listen for AI to start speaking"
echo "   🖱️  Then click 'Start Talking' button to test interruption"
echo ""

curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a very long AI message that you should interrupt by speaking. I will keep talking for quite a while to give you plenty of time to test the user interruption feature. The moment you start speaking, this AI speech should stop immediately and your speech recognition should take over. This demonstrates natural conversation flow where the AI listens when the user wants to speak, just like in real human conversations. Keep talking to test that the interruption works properly and that speech recognition continues to function normally after the interruption occurs."}' | jq -r '.message'

echo ""
echo "✅ EXPECTED BEHAVIOR:"
echo "   1. AI starts speaking the long message"
echo "   2. When you click 'Start Talking', AI stops immediately"
echo "   3. Microphone activates for your input"
echo "   4. AI text remains visible on screen"
echo "   5. No audio feedback or echo issues"
echo "   6. Your speech is recognized normally"
echo ""
echo "❌ IF BUG EXISTS:"
echo "   - AI continues speaking when button is pressed"
echo "   - Audio feedback/echo occurs"
echo "   - AI text disappears prematurely"
echo ""

echo "⏱️ Waiting 10 seconds to test..."
sleep 10

echo ""
echo "$(date '+%H:%M:%S') - 🔄 Second test (if needed)..."
curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "Second interruption test message. Try speaking during this message too to verify the feature works consistently."}' | jq -r '.message'

echo ""
echo "🎯 Test complete! Check that user speech interrupts AI speech naturally."