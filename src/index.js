import { resolve } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import express from "express";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();
const proxyAssetPrefixes = ["/uv/", "/libcurl/", "/baremux/"];

// Match Truffled's Wisp networking profile for media/CDN connections.
wisp.options.dns_method = "resolve";
wisp.options.dns_servers = ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4"];
wisp.options.dns_result_order = "ipv4first";
wisp.options.allow_udp = true;
wisp.options.timeout = 30000;

app.use((req, res, next) => {
	if (proxyAssetPrefixes.some((prefix) => req.path.startsWith(prefix))) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
	}
	next();
});

// Load our publicPath first and prioritize it over UV.
app.use(express.static("./public"));
// Load vendor files last.
// The vendor's uv.config.js won't conflict with our uv.config.js inside the publicPath directory.
app.use("/uv/", express.static(uvPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/eruda/", express.static(resolve("node_modules/eruda")));

// Error for everything else
app.use((req, res) => {
	res.status(404);
	res.sendFile(resolve("./public/404.html"));
});

const server = createServer();

server.on("request", (req, res) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
	res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
	app(req, res);
});
server.on("upgrade", (req, socket, head) => {
	if (req.url.startsWith("/wisp/")) {
		try {
			wisp.routeRequest(req, socket, head);
		} catch (error) {
			console.error("Wisp upgrade error:", error);
			socket.destroy();
		}
		return;
	} 
	socket.end();
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
