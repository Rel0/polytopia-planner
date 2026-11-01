# Local dev server for testing on a phone in the same Wi-Fi.
# Like `python3 -m http.server`, but tells browsers not to cache, so every reload shows the latest files.
# Usage: python3 serve.py [port]
import http.server, os, socket, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


print(f'Polytopia Planner: http://{lan_ip()}:{PORT}  (Ctrl+C to stop)')
http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
