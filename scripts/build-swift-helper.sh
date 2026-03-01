#!/bin/bash
set -e
cd "$(dirname "$0")/../swift-helper"
swift build -c release
echo "FnKeyMonitor built at .build/release/FnKeyMonitor"
