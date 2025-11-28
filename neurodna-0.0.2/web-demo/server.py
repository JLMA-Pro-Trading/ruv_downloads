#!/usr/bin/env python3
"""
Simple HTTP server for the Neural DNA WASM demo.
Serves with proper CORS headers for WASM modules.
"""

import http.server
import socketserver
import os
from http import HTTPStatus

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for WASM
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        
        # Proper MIME types
        if self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
        elif self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
            
        super().end_headers()
    
    def do_GET(self):
        # Handle parent directory access for pkg
        if self.path.startswith('/pkg/'):
            self.path = '/..' + self.path
        return super().do_GET()

def main():
    PORT = 8080
    
    print(f"🚀 Starting Neural DNA demo server on http://localhost:{PORT}")
    print("📁 Serving from:", os.getcwd())
    print("\nMake sure to build WASM first: cd .. && ./build-wasm.sh")
    print("\nPress Ctrl+C to stop the server\n")
    
    with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✋ Server stopped")

if __name__ == "__main__":
    main()