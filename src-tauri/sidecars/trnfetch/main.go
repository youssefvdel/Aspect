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
	"path/filepath"
	"strings"
	"time"

	utls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

func getCookieFile() string {
	if appData := os.Getenv("LOCALAPPDATA"); appData != "" {
		dir := filepath.Join(appData, "Recon")
		_ = os.MkdirAll(dir, 0755)
		return filepath.Join(dir, "trn_cookies.txt")
	}
	return filepath.Join(os.TempDir(), "recon_trn_cookies.txt")
}

func loadCookie() string {
	b, err := os.ReadFile(getCookieFile())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func saveCookie(c string) {
	if c != "" {
		_ = os.WriteFile(getCookieFile(), []byte(c), 0644)
	}
}

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
			// Real modern Chrome TLS fingerprint
			uconn := utls.UClient(raw, &utls.Config{ServerName: host}, utls.HelloChrome_120)
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

	// Full Chrome 133 headers matching real browser navigation / fetch
	req.Header.Set("accept", "application/json, text/plain, */*")
	req.Header.Set("accept-language", "en-US,en;q=0.9")
	req.Header.Set("origin", "https://tracker.gg")
	req.Header.Set("referer", "https://tracker.gg/")
	req.Header.Set("sec-ch-ua", `"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"`)
	req.Header.Set("sec-ch-ua-mobile", "?0")
	req.Header.Set("sec-ch-ua-platform", `"Windows"`)
	req.Header.Set("sec-fetch-dest", "empty")
	req.Header.Set("sec-fetch-mode", "cors")
	req.Header.Set("sec-fetch-site", "same-site")
	req.Header.Set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36")

	// Pass existing Cloudflare bot-management / session cookies
	if cookie := loadCookie(); cookie != "" {
		req.Header.Set("cookie", cookie)
	}

	res, err := client.Do(req)
	if err != nil {
		fmt.Fprintln(os.Stderr, "do:", err)
		os.Exit(1)
	}
	defer res.Body.Close()

	// Persist set-cookie updates (e.g. __cf_bm, __cflb)
	var newCookies []string
	for _, v := range res.Header["Set-Cookie"] {
		parts := strings.Split(v, ";")
		if len(parts) > 0 {
			newCookies = append(newCookies, strings.TrimSpace(parts[0]))
		}
	}
	if len(newCookies) > 0 {
		saveCookie(strings.Join(newCookies, "; "))
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, 16<<20))
	if err != nil {
		fmt.Fprintln(os.Stderr, "read:", err)
		os.Exit(1)
	}

	if res.StatusCode < 200 || res.StatusCode > 299 {
		fmt.Fprintf(os.Stderr, "HTTP %d: %s\n", res.StatusCode, string(body[:min(300, len(body))]))
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
