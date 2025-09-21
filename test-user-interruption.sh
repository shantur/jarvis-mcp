#!/bin/bash

echo "🎙️ TESTING USER INTERRUPTION FEATURE"
echo "===================================="
echo ""
echo "This test verifies that AI speech stops when user starts speaking"
echo ""
echo "🔧 MANUAL SETUP REQUIRED:"
echo "   1. ✅ Turn ON 'Keep Microphone Always On'"
echo "   2. ❌ Turn OFF 'Pause Listening During AI Speech'"
echo "   3. ✅ Keep ON 'Stop AI When User Speaks' (default)"
echo "   4. 🎤 Test that speech recognition is working"
echo ""
echo "📋 TEST PROCEDURE:"
echo "   1. Script will send a long AI message"
echo "   2. While AI is speaking, start talking"
echo "   3. AI speech should stop immediately"
echo "   4. Your speech should be recognized"
echo ""

BASE_URL="https://localhost:5114"

echo "⏱️ Waiting 10 seconds for setup..."
sleep 10

echo ""
echo "$(date '+%H:%M:%S') - 🎤 Sending LONG AI message..."
echo "   👂 Listen for AI to start speaking"
echo "   🗣️  Then start talking to test interruption"
echo ""

curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a very long AI message that you should interrupt by speaking. I will keep talking for quite a while to give you plenty of time to test the user interruption feature. The moment you start speaking, this AI speech should stop immediately and your speech recognition should take over. This demonstrates natural conversation flow where the AI listens when the user wants to speak, just like in real human conversations. Keep talking to test that the interruption works properly and that speech recognition continues to function normally after the interruption occurs."}' | jq -r '.message'

echo ""
echo "✅ EXPECTED BEHAVIOR:"
echo "   1. AI starts speaking the long message"
echo "   2. When you speak, AI stops immediately"
echo "   3. Your speech is recognized and displayed"
echo "   4. Speech recognition continues working normally"
echo ""
echo "❌ IF BUG EXISTS:"
echo "   - AI continues speaking even when you talk"
echo "   - No interruption occurs"
echo "   - User speech is not prioritized"
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