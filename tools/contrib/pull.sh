#!/bin/sh
# Fetches the training contributions from the VPS and turns them into a dataset for tools/tilemodel.
# usage: sh tools/contrib/pull.sh <out dir>   → <out dir>/raw/*.json, <out dir>/img/*.jpg, <out dir>/dataset.json + counts
set -e
cd "$(dirname "$0")/../.."
. ./deploy.env
OUT=${1:-/tmp/polytopia-contrib}
mkdir -p "$OUT/raw"
ssh -i $DEPLOY_KEY_DIR/polytopia_vps -o BatchMode=yes -o UserKnownHostsFile=$DEPLOY_KEY_DIR/known_hosts $DEPLOY_HOST \
  'cd /var/lib/polytopia-contrib 2>/dev/null && tar -czf - --exclude="*.tmp" . || tar -czf - -T /dev/null' | tar -C "$OUT/raw" -xzf -
python3 -I tools/contrib/to_dataset.py "$OUT"
