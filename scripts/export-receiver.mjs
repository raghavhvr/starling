// Tiny local receiver for the data export: the browser POSTs table dumps here
// and they land in scripts/data/*.json. Run alongside the export, then stop.
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
mkdirSync(dataDir, { recursive: true });

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { name, rows } = JSON.parse(body);
        if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error("bad name");
        writeFileSync(join(dataDir, `${name}.json`), JSON.stringify(rows, null, 1));
        console.log(`saved ${name}: ${rows.length} rows`);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, name, count: rows.length }));
      } catch (e) {
        res.writeHead(400);
        res.end(String(e));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(8899, "127.0.0.1", () => console.log("export receiver on http://127.0.0.1:8899"));
