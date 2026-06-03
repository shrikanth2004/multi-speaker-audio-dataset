/** Trigger a one-time browser download; nothing is sent to the server. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function meetingRecordingFilename(roomCode, roomId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const id = (roomCode || roomId || "meeting").replace(/\s+/g, "");
  return `meeting-${id}-${stamp}.webm`;
}
