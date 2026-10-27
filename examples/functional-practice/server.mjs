import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { pathToFileURL } from "node:url";

export async function startPracticeServer(port = 0) {
  const html = await readFile(new URL("./checkout.html", import.meta.url));
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET" || !["/", "/checkout"].includes(url.pathname)) {
      response.writeHead(404).end("Not part of the owned practice fixture."); return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startPracticeServer(4180);
  console.log(`Open ${fixture.origin}/checkout in your browser. Press Ctrl+C to stop.`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await fixture.close(); process.exit(0); });
}
