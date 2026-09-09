// trnfetch: Chrome-impersonated GET. Usage: trnfetch <url>
// Prints the response body to stdout; errors go to stderr with non-zero exit.
// TLS fingerprint = real Chrome via uTLS; HTTP/2 via x/net over the uTLS conn.
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"

	utls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: trnfetch <url>")
		os.Exit(2)
	}
	url := os.Args[1]

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	tr := &http2.Transport{
		DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
			raw, err := dialer.DialContext(ctx, network, addr)
			if err != nil {
				return nil, err
			}
			host, _, _ := net.SplitHostPort(addr)
			uconn := utls.UClient(raw, &utls.Config{ServerName: host}, utls.HelloChrome_Auto)
			if err := uconn.HandshakeContext(ctx); err != nil {
				raw.Close()
				return nil, err
			}
			return uconn, nil
		},
	}
	client := &http.Client{Transport: tr, Timeout: 25 * time.Second}
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "req:", err)
		os.Exit(2)
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-EG,en;q=0.7")
	req.Header.Set("Origin", "https://tracker.gg")
	req.Header.Set("Referer", "https://tracker.gg/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36")
	res, err := client.Do(req)
	if err != nil {
		fmt.Fprintln(os.Stderr, "do:", err)
		os.Exit(1)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		fmt.Fprintln(os.Stderr, "read:", err)
		os.Exit(1)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		fmt.Fprintf(os.Stderr, "HTTP %d: %s\n", res.StatusCode, string(body[:min(200, len(body))]))
		os.Exit(1)
	}
	os.Stdout.Write(body)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
