#!/usr/bin/env python3
# Polytopia Planner – receives voluntary training contributions (opt-in in the app). Standard library only.
# POST /api/contrib         {id, version, size:[w,h], grid:{…}, image:'data:image/jpeg;base64,…', tiles:[…], units:[…]}
#                           → stored as <STATE>/<id>.json (a newer version of the same screenshot replaces it)
# POST /api/contrib/delete  {ids:[…]} → removes those contributions (the app keeps the ids it sent on the device)
# No IP address, no cookie, no log of requests is kept here (nginx passes no client address).
import json, os, re, base64, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = os.environ.get('STATE_DIRECTORY', '/var/lib/polytopia-contrib')
PORT = int(os.environ.get('PORT', '8091'))
MAX_BODY = 6 * 1024 * 1024
MAX_TOTAL = 5 * 1024 ** 3          # stop accepting at 5 GB
ID = re.compile(r'^[a-f0-9]{16,40}$')

def total_size():
    return sum(e.stat().st_size for e in os.scandir(STATE) if e.is_file())

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass   # no request log
    def reply(self, code, obj=None):
        body = json.dumps(obj or {}).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > MAX_BODY: return self.reply(413, {'error': 'size'})
            d = json.loads(self.rfile.read(n))
            if not isinstance(d, dict): return self.reply(400, {'error': 'format'})
            if self.path == '/api/contrib/delete':
                ids = [i for i in (d.get('ids') or []) if isinstance(i, str) and ID.match(i)][:500]
                for i in ids:
                    try: os.remove(os.path.join(STATE, i + '.json'))
                    except FileNotFoundError: pass
                return self.reply(200, {'deleted': len(ids)})
            if self.path != '/api/contrib': return self.reply(404)
            cid, img = d.get('id'), d.get('image')
            if not (isinstance(cid, str) and ID.match(cid)): return self.reply(400, {'error': 'id'})
            if not (isinstance(img, str) and img.startswith('data:image/jpeg;base64,')): return self.reply(400, {'error': 'image'})
            raw = base64.b64decode(img.split(',', 1)[1], validate=True)
            if raw[:3] != b'\xff\xd8\xff': return self.reply(400, {'error': 'image'})
            for k in ('tiles', 'units'):
                if not isinstance(d.get(k, []), list) or len(d.get(k, [])) > 3000: return self.reply(400, {'error': k})
            if total_size() > MAX_TOTAL: return self.reply(507, {'error': 'full'})
            keep = {k: d.get(k) for k in ('id', 'version', 'size', 'grid', 'image', 'tiles', 'units', 'app')}
            keep['received'] = time.strftime('%Y-%m-%d')   # the day only
            tmp = os.path.join(STATE, cid + '.tmp')
            with open(tmp, 'w') as f: json.dump(keep, f)
            os.replace(tmp, os.path.join(STATE, cid + '.json'))
            return self.reply(200, {'ok': True})
        except Exception:
            return self.reply(400, {'error': 'bad request'})

if __name__ == '__main__':
    os.makedirs(STATE, exist_ok=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
