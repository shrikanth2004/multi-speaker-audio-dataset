const API = {
  async request(path, options = {}) {
    const headers = {
      ...Auth.authHeaders(),
      ...(options.headers || {}),
    };
    const res = await fetch(`${AppConfig.apiBase}${path}`, {
      ...options,
      headers,
    });
    if (res.status === 401) {
      Auth.logout();
      throw new Error("Unauthorized");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || "Request failed");
    }
    return data;
  },

  createRoom() {
    return this.request("/api/meetings/create", { method: "POST" });
  },

  getRoom(id) {
    return this.request(`/api/meetings/${encodeURIComponent(id)}`);
  },

  startMeeting(roomId) {
    return this.request(`/api/meetings/${roomId}/start`, { method: "POST" });
  },

  endMeeting(roomId) {
    return this.request(`/api/meetings/${roomId}/end`, { method: "POST" });
  },

};
