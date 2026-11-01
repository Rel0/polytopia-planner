#!/bin/sh
# Builds dist/ and uploads it to the VPS (https://polytopiaplanner.com, nginx, /var/www/polytopiaplanner.com).
# Files on the server that are no longer in dist/ get removed. Usage: ./deploy.sh
set -e
cd "$(dirname "$0")"
[ -f deploy.env ] || { echo "deploy.env missing – copy deploy.env.example"; exit 1; }
. ./deploy.env
KEY=$DEPLOY_KEY_DIR
SSH="ssh -i $KEY/polytopia_vps -o BatchMode=yes -o ConnectTimeout=10 -o UserKnownHostsFile=$KEY/known_hosts $DEPLOY_HOST"
DIR=/var/www/polytopiaplanner.com

./release.sh
# .htaccess is for Apache hosting only – nginx has the same rules in /etc/nginx/sites-available/polytopiaplanner.com
COPYFILE_DISABLE=1 tar -C dist --exclude .htaccess --exclude .DS_Store -czf - . | $SSH "
  set -e
  rm -rf $DIR.new && mkdir -p $DIR.new && tar -C $DIR.new -xzf - 2>/dev/null
  chown -R www-data:www-data $DIR.new
  rm -rf $DIR.old && mv $DIR $DIR.old && mv $DIR.new $DIR && rm -rf $DIR.old"
code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://polytopiaplanner.com/)
echo "deployed – https://polytopiaplanner.com answers $code"
