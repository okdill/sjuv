import express from "express";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { createBareServer } from "@tomphttp/bare-server-node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import wisp from "wisp-server-node";

// Setup Bare server
const bare = createBareServer("/bare/");
const app = express();

// Static routes
app.use(express.static("public"));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/bareasmodule/", express.static(bareModulePath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/scram/", express.static("scramjet"));

// Create HTTP server
const server = createServer();

// Handle requests
server.on("request", (req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// Handle upgrades (WebSocket / WISP)
server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else if (req.url.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else socket.end();
});

// Port
let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

// Listen on both IPv4 and IPv6
server.listen(port, "::", () => {
  const address = server.address();

  console.log("Listening on:");

  // IPv4
  console.log(`\thttp://0.0.0.0:${address.port} (all IPv4)`);
  
  // IPv6
  console.log(`\thttp://[::]:${address.port} (all IPv6)`);

  // Hostname (local)
  console.log(`\thttp://${hostname()}:${address.port} (hostname)`);

  // If IPv4-mapped IPv6 is present
  if (address.family === "IPv6") {
    const ipv4 = address.address.replace("::ffff:", "");
    console.log(`\thttp://${ipv4}:${address.port} (IPv4-mapped)`);
  }
});

// Graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close();
  bare.close();
  process.exit(0);
}
