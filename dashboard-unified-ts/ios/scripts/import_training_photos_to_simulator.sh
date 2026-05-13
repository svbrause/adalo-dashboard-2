#!/usr/bin/env bash
# Imports front-facing training JPGs into the booted iOS Simulator Photos library
# so "Choose a selfie" in the app can pick them.
#
# Usage:
#   ./ios/scripts/import_training_photos_to_simulator.sh [SOURCE_DIR] [DEVICE_UDID_OR_booted]
#
# Default source matches the local training dataset path used in this repo.
set -euo pipefail

DEFAULT_SRC="${HOME}/Documents/test-modal-larger-dataset-august/my_project_cursor/training_data_v3/images/front"
SRC="${1:-$DEFAULT_SRC}"
DEVICE="${2:-booted}"

if ! xcrun simctl help addmedia &>/dev/null; then
  echo "xcrun simctl addmedia not available (need Xcode)." >&2
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "Source folder not found: $SRC" >&2
  echo "Pass the path to your front images folder as the first argument." >&2
  exit 1
fi

# simctl addmedia accepts multiple paths but very long argv can fail; batch.
batch=()
count=0
while IFS= read -r -d '' f; do
  batch+=("$f")
  count=$((count + 1))
  if ((${#batch[@]} >= 40)); then
    xcrun simctl addmedia "$DEVICE" "${batch[@]}"
    batch=()
  fi
done < <(find "$SRC" -maxdepth 1 \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

if ((${#batch[@]} > 0)); then
  xcrun simctl addmedia "$DEVICE" "${batch[@]}"
fi

echo "Imported $count image(s) into simulator ($DEVICE) from:"
echo "  $SRC"
echo "Open Photos in the simulator to confirm, then use Scan → Choose a selfie."
