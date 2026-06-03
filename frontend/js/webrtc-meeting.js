class WebRTCMeeting {
  constructor(options) {
    this.roomId = options.roomId;
    this.isHost = options.isHost;
    this.displayName = options.displayName;
    this.userId = options.userId;
    this.onParticipantUpdate = options.onParticipantUpdate || (() => {});
    this.onNotification = options.onNotification || (() => {});
    this.onMeetingStarted = options.onMeetingStarted || (() => {});
    this.onMeetingEnded = options.onMeetingEnded || (() => {});

    this.peerId = null;
    this.localStream = null;
    this.peers = new Map();
    this.participants = [];
    this.ws = null;
    this.mixedRecorder = new MixedAudioRecorder();
    this.muted = false;
    this.meetingLive = false;
    this.remoteAudios = new Map();
    this.remoteStreams = new Map();
  }

  async init() {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });

    this.ws = new WebSocket(AppConfig.meetingWsUrl(this.roomId));
    await this._waitForOpen(this.ws);

    this.ws.onmessage = (ev) => this._handleSignal(JSON.parse(ev.data));
    this.ws.onclose = () => this.onNotification("Connection lost");

    this._send({
      type: "join",
      userId: this.userId,
      displayName: this.displayName,
      isHost: this.isHost,
      muted: this.muted,
    });
  }

  _waitForOpen(ws) {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error("WebSocket failed"));
    });
  }

  _send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async _handleSignal(msg) {
    switch (msg.type) {
      case "welcome":
        this.peerId = msg.peerId;
        this.participants = msg.participants || [];
        this.onParticipantUpdate(this.participants, msg.participantCount);
        for (const p of this.participants) {
          if (p.peerId !== this.peerId) {
            await this._createOffer(p.peerId);
          }
        }
        break;

      case "peer-joined":
        this.participants = msg.participants || [];
        this.onParticipantUpdate(this.participants, msg.participantCount);
        this.onNotification(`${msg.displayName} joined the meeting`);
        if (msg.peerId !== this.peerId) {
          await this._createOffer(msg.peerId);
        }
        break;

      case "peer-left":
        this.participants = msg.participants || [];
        this.onParticipantUpdate(this.participants, msg.participantCount);
        this.onNotification(`${msg.displayName} left the meeting`);
        this._removePeer(msg.peerId);
        break;

      case "offer":
        await this._handleOffer(msg);
        break;

      case "answer":
        await this._handleAnswer(msg);
        break;

      case "ice-candidate":
        await this._handleIce(msg);
        break;

      case "peer-muted":
        this.participants = msg.participants || [];
        this.onParticipantUpdate(this.participants, this.participants.length);
        break;

      case "meeting-started":
        this.meetingLive = true;
        this.onMeetingStarted(msg.startedAt);
        break;

      case "meeting-ended":
        this.meetingLive = false;
        this.onMeetingEnded(msg.endedAt);
        break;

      case "notification":
        this.onNotification(msg.message || msg.from);
        break;

      default:
        break;
    }
  }

  _peerConfig() {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }

  _getOrCreatePeer(remotePeerId) {
    if (this.peers.has(remotePeerId)) {
      return this.peers.get(remotePeerId);
    }

    const pc = new RTCPeerConnection(this._peerConfig());
    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream);
    });

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      this._attachRemoteAudio(remotePeerId, stream);
      if (this.isHost && this.meetingLive) {
        this._addRemoteToRecorder(remotePeerId, stream);
      }
      ev.track.onunmute = () => {
        if (this.isHost && this.meetingLive) {
          this._addRemoteToRecorder(remotePeerId, stream);
        }
      };
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this._send({
          type: "ice-candidate",
          targetPeerId: remotePeerId,
          candidate: ev.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this._removePeer(remotePeerId);
      }
    };

    this.peers.set(remotePeerId, pc);
    return pc;
  }

  _attachRemoteAudio(peerId, stream) {
    this.remoteStreams.set(peerId, stream);
    let audio = this.remoteAudios.get(peerId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      this.remoteAudios.set(peerId, audio);
    }
    audio.srcObject = stream;
  }

  _addRemoteToRecorder(peerId, stream) {
    if (!stream?.getAudioTracks().length) return;
    this.mixedRecorder.addStream(peerId, stream);
  }

  _backfillRemoteStreamsToRecorder() {
    for (const [peerId, stream] of this.remoteStreams) {
      this._addRemoteToRecorder(peerId, stream);
    }
  }

  async _createOffer(remotePeerId) {
    const pc = this._getOrCreatePeer(remotePeerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this._send({
      type: "offer",
      targetPeerId: remotePeerId,
      sdp: offer,
    });
  }

  async _handleOffer(msg) {
    const from = msg.fromPeerId;
    const pc = this._getOrCreatePeer(from);
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this._send({
      type: "answer",
      targetPeerId: from,
      sdp: answer,
    });
  }

  async _handleAnswer(msg) {
    const pc = this.peers.get(msg.fromPeerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
  }

  async _handleIce(msg) {
    const pc = this.peers.get(msg.fromPeerId);
    if (pc && msg.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  }

  _removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.mixedRecorder.removeStream(peerId);
    this.remoteStreams.delete(peerId);
    const audio = this.remoteAudios.get(peerId);
    if (audio) {
      audio.remove();
      this.remoteAudios.delete(peerId);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !this.muted;
    });
    this._send({ type: "mute-state", muted: this.muted });
    return this.muted;
  }

  async startMeetingRecording() {
    this.meetingLive = true;
    this.mixedRecorder.addStream("local", this.localStream);
    this._backfillRemoteStreamsToRecorder();
    await this.mixedRecorder.start();
    this._send({
      type: "meeting-started",
      startedAt: new Date().toISOString(),
    });
  }

  async stopMeetingRecording() {
    this._send({
      type: "meeting-ended",
      endedAt: new Date().toISOString(),
    });
    return this.mixedRecorder.stop();
  }

  getParticipantNames() {
    return this.participants.map((p) => p.displayName);
  }

  destroy() {
    this.peers.forEach((_, id) => this._removePeer(id));
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.mixedRecorder.destroy();
    this.remoteAudios.forEach((a) => a.remove());
    this.remoteAudios.clear();
    this.remoteStreams.clear();
    if (this.ws) this.ws.close();
  }
}
