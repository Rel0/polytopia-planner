#!/bin/sh
# Installs / updates the contribution service on the VPS (run from the repo: sh server/contrib/install.sh).
# Copies server.py + the systemd unit, adds the rate limit and the /api/contrib location to nginx (once), tests and reloads.
set -e
cd "$(dirname "$0")/../.."
. ./deploy.env
SSH="ssh -i $DEPLOY_KEY_DIR/polytopia_vps -o BatchMode=yes -o ConnectTimeout=10 -o UserKnownHostsFile=$DEPLOY_KEY_DIR/known_hosts $DEPLOY_HOST"
tar -C server/contrib -czf - server.py polytopia-contrib.service nginx-contrib.conf | $SSH '
  set -e
  mkdir -p /opt/polytopia-contrib && tar -C /opt/polytopia-contrib -xzf - 2>/dev/null
  cp /opt/polytopia-contrib/polytopia-contrib.service /etc/systemd/system/
  cp /opt/polytopia-contrib/nginx-contrib.conf /etc/nginx/conf.d/polytopia-contrib.conf
  SITE=/etc/nginx/sites-available/polytopiaplanner.com
  if ! grep -q "location /api/contrib" $SITE; then
    cp $SITE $SITE.bak-contrib
    python3 - "$SITE" <<PY
import sys
p = sys.argv[1]; s = open(p).read()
loc = """    # opt-in training contributions -> local service (no client address passed on)
    location /api/contrib {
        limit_req zone=contrib burst=10 nodelay;
        client_max_body_size 6m;
        proxy_pass http://127.0.0.1:8091;
        proxy_set_header X-Forwarded-For \"\";
        proxy_set_header X-Real-IP \"\";
    }

    location / { try_files \$uri \$uri/ =404; }"""
s = s.replace("    location / { try_files \$uri \$uri/ =404; }", loc, 1)
open(p, "w").write(s)
PY
  fi
  systemctl daemon-reload
  systemctl enable --now polytopia-contrib >/dev/null 2>&1
  systemctl restart polytopia-contrib
  nginx -t && systemctl reload nginx
  sleep 1; systemctl is-active polytopia-contrib'
