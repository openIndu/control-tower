import { connect } from "node:net";
import { createServer } from "node:http";

// Minimal CONNECT-only allowlist forward proxy (spec/005 section 2.6's
// "出站网络只放行白名单主机"). Deliberately has no dependency beyond
// node:http/node:net -- this is the one thing standing between the agent
// container and the internet, so it stays small enough to read in full.
//
// Only HTTPS via CONNECT is supported. The agent carrier has no legitimate
// reason to make a plain HTTP request (the Anthropic API is HTTPS-only),
// so a bare HTTP request is refused outright rather than inspected.
export function parseAllowedHosts(raw) {
  return (raw ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export function isAllowedHost(hostname, allowedHosts) {
  return allowedHosts.includes(hostname);
}

export function createEgressProxy(allowedHosts) {
  const server = createServer((_req, res) => {
    res.writeHead(405, { "content-type": "text/plain" });
    res.end("plain HTTP is not proxied; HTTPS via CONNECT only\n");
  });

  server.on("connect", (req, clientSocket, head) => {
    const [hostname, portRaw] = req.url.split(":");
    const port = Number(portRaw) || 443;
    if (!isAllowedHost(hostname, allowedHosts)) {
      clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      clientSocket.destroy();
      return;
    }
    const upstream = connect(port, hostname, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const allowedHosts = parseAllowedHosts(process.env.ALLOWED_HOSTS);
  const port = Number(process.env.PROXY_PORT ?? 8080);
  const server = createEgressProxy(allowedHosts);
  server.listen(port, () => {
    console.log(`egress proxy listening on :${port}, allowing: ${allowedHosts.join(", ") || "(none)"}`);
  });
}
