#!/bin/bash

echo "Testing Speech Interruption Functionality..."
echo ""

BASE_URL="https://localhost:5114"

echo "🎤 Sending first long speech (should start speaking)..."
curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is the first speech message that should be interrupted. It is intentionally long to give enough time for the interruption test. The speech synthesis should stop immediately when the second message arrives, demonstrating proper interruption handling. This message contains approximately fifty words to ensure adequate testing duration for the interruption functionality."}' | jq -r '.message'

echo ""
echo "⏱️  Waiting 2 seconds for speech to start..."
sleep 2

echo ""
echo "🔄 Sending interrupting speech (should stop first and start this one)..."
curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "INTERRUPTION: This second message should immediately stop the first speech and start speaking this text instead. The browser should cancel the previous utterance and begin this one right away."}' | jq -r '.message'

echo ""
echo "⏱️  Waiting 3 seconds for second speech..."
sleep 3

echo ""
echo "🔄 Sending third interrupting speech..."
curl -k -s -X POST "$BASE_URL/api/test-speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "FINAL INTERRUPTION: This third and final message should interrupt the second speech, demonstrating that multiple interruptions work correctly."}' | jq -r '.message'

echo ""
echo "✅ Test complete! Check the browser to verify:"
echo "   1. First speech started"
echo "   2. Second speech interrupted first speech immediately"
echo "   3. Third speech interrupted second speech immediately"
echo "   4. Only the final speech should complete fully"