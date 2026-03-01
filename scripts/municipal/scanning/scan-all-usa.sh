#!/bin/bash

# Scan all USA municipalities with URLs
# This will process all 1000+ cities at once

echo "🇺🇸 Starting USA Municipal Scanner"
echo "=================================="
echo ""
echo "This will scan all USA municipalities with minutes URLs"
echo "Logs will be saved to the logs/ directory"
echo ""
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Run the scanner without province filter to get all USA municipalities
npx tsx scripts/scan-municipal-minutes.ts

echo ""
echo "✅ Scan complete!"
echo "Check the logs/ directory for:"
echo "  - scan-*.log (full scan log)"
echo "  - no-minutes-*.log (URLs that didn't return meeting documents)"
