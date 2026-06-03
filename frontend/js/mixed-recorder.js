/**
 * Mixes multiple MediaStreams into one recording using Web Audio API.
 */
class MixedAudioRecorder {
  constructor() {
    this.audioContext = null;
    this.destination = null;
    this.sources = new Map();
    this.mediaRecorder = null;
    this.chunks = [];
    this.startedAt = null;
  }

  _ensureContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.destination = this.audioContext.createMediaStreamDestination();
    }
  }

  addStream(peerId, stream) {
    this._ensureContext();
    if (this.sources.has(peerId)) {
      this.removeStream(peerId);
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    const source = this.audioContext.createMediaStreamSource(
      new MediaStream(audioTracks)
    );
    source.connect(this.destination);
    this.sources.set(peerId, source);
  }

  removeStream(peerId) {
    const source = this.sources.get(peerId);
    if (source) {
      try {
        source.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.sources.delete(peerId);
    }
  }

  async start() {
    this._ensureContext();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    if (this.mediaRecorder?.state === "recording") return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.destination.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(1000);
    this.startedAt = Date.now();
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(this._buildBlob());
        return;
      }
      this.mediaRecorder.onstop = () => resolve(this._buildBlob());
      this.mediaRecorder.stop();
    });
  }

  _buildBlob() {
    const type = this.mediaRecorder?.mimeType || "audio/webm";
    const blob = new Blob(this.chunks, { type });
    const durationSeconds = this.startedAt
      ? (Date.now() - this.startedAt) / 1000
      : 0;
    return { blob, durationSeconds };
  }

  destroy() {
    for (const peerId of [...this.sources.keys()]) {
      this.removeStream(peerId);
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.destination = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
