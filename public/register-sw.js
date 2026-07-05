"use strict";
/**
 * Distributed with Ultraviolet and compatible with most configurations.
 */
const stockSW = "/uv/sw.js";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	const registration = await navigator.serviceWorker.register(stockSW, {
		scope: self.__uv$config.prefix,
	});

	if (registration.active || registration.waiting) return registration;

	const worker = registration.installing;
	if (!worker) return registration;

	await new Promise((resolve, reject) => {
		const timeoutId = setTimeout(resolve, 10000);

		worker.addEventListener("statechange", () => {
			if (worker.state === "activated") {
				clearTimeout(timeoutId);
				resolve();
			} else if (worker.state === "redundant") {
				clearTimeout(timeoutId);
				reject(new Error("Service worker became redundant during registration."));
			}
		});
	});

	return registration;
}
