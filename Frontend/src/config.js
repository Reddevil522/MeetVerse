let envUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Fix for local network testing (e.g. accessing via mobile device on the same WiFi)
// If the configured URL is localhost but the user accesses the site via a LAN IP,
// dynamically route backend requests to the LAN IP on port 8000.
if (envUrl.includes("localhost") && window.location.hostname !== "localhost") {
    envUrl = `http://${window.location.hostname}:8000`;
}

export const server_url = envUrl;
