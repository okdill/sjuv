import express from "express";
import { createServer } from "node:http";
import { hostname } from "node:os";
import fetch from "node-fetch"; // for public IP detection
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

// Listen on dual-stack (::)
server.listen(port, "::", async () => {
  const address = server.address();
  console.log("Listening on:");

  // Local / hostname
  console.log(`\thttp://localhost:${address.port} (localhost)`);
  console.log(`\thttp://${hostname()}:${address.port} (hostname)`);

  // IPv4 all interfaces
  console.log(`\thttp://0.0.0.0:${address.port} (all IPv4)`);

  // IPv6 all interfaces
  console.log(`\thttp://[::]:${address.port} (all IPv6)`);

  // Public IP detection
  try {
    const pub4 = await fetch("https://ifconfig.me/ip").then(r => r.text());
    console.log(`\thttp://${pub4}:${address.port} (public IPv4)`);

    const pub6 = await fetch("https://ifconfig.co/ip").then(r => r.text());
    if (pub6.includes(":")) console.log(`\thttp://[${pub6}]:${address.port} (public IPv6)`);
  } catch (err) {
    console.log("\tUnable to detect public IPs automatically.");
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
