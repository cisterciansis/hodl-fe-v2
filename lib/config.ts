const isDevMode =
    process.env.NEXT_PUBLIC_DEV_MODE;

const LOCAL_API_URL = "http://127.0.0.1:8000";
const LOCAL_WS_URL = "ws://127.0.0.1:8000/ws";

const PROD_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";

// Reason: HTTP requests go through Next.js rewrite proxy (/api/backend/*) to avoid
// CORS blocks. WebSocket connections bypass CORS and connect directly.
export const API_URL = isDevMode ? LOCAL_API_URL : "/api/backend";
export const WS_BASE_URL = isDevMode ? LOCAL_WS_URL : PROD_WS_URL;

export const getWebSocketNewUrl = (params?: { ss58?: string }): string => {
    const normalized = WS_BASE_URL.replace(/\/(?:book|new)\/?$/, "");
    const base = `${normalized}/new`;
    if (params?.ss58?.trim()) {
      const q = new URLSearchParams({ ss58: params.ss58.trim() }).toString();
      return `${base}?${q}`;
    }
    return base;
};

export const getWebSocketTapUrl = (params?: { ss58?: string }): string => {
    const normalized = WS_BASE_URL.replace(/\/(?:book|new)\/?$/, "").replace(/\/tap\/?$/, "");
    const base = `${normalized}/tap`;
    if (params?.ss58?.trim()) {
      const q = new URLSearchParams({ ss58: params.ss58.trim() }).toString();
      return `${base}?${q}`;
    }
    return base;
};

export const DEV_MODE = isDevMode;

if (typeof window !== "undefined") {
    console.log(`[Config] Dev Mode: ${isDevMode}`);
    console.log(`[Config] API URL: ${API_URL}`);
    console.log(`[Config] WebSocket URL: ${WS_BASE_URL}`);
}

