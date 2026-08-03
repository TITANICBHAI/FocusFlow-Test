export type RecordingState = 'idle' | 'recording' | 'processing';

function getBestMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
}

export function parseDurationMs(durationStr: string): number {
  const match = durationStr.match(/(\d+)/);
  const secs = match ? parseInt(match[1], 10) : 30;
  return secs * 1000;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function startCapture(
  onStateChange: (state: RecordingState) => void,
  onDone: (blob: Blob, filename: string) => void,
  videoTitle: string,
  durationMs: number
): Promise<() => void> {
  let stream: MediaStream;

  try {
    stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
      preferCurrentTab: true,
    } as any);
  } catch {
    onStateChange('idle');
    return () => {};
  }

  const mimeType = getBestMimeType();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    onStateChange('processing');
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const safe = videoTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(blob, `focusflow-${safe}.webm`);
    setTimeout(() => onStateChange('idle'), 400);
  };

  stream.getVideoTracks()[0].onended = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  recorder.start(100);
  onStateChange('recording');

  const autoStop = setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, durationMs + 1500);

  return () => {
    clearTimeout(autoStop);
    if (recorder.state !== 'inactive') recorder.stop();
  };
}
