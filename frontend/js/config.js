const AppConfig = {
  get apiBase() {
    return typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "";
  },
  get apiOrigin() {
    const base = this.apiBase;
    if (base) {
      try {
        return new URL(base).origin;
      } catch {
        return base.replace(/\/$/, "");
      }
    }
    return window.location.origin;
  },
  wsBase() {
    const base = this.apiBase;
    if (base) {
      const url = new URL(base);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.origin;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  },
  meetingWsUrl(roomId) {
    return `${this.wsBase()}/ws/meeting/${roomId}`;
  },
};
