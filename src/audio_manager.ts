export class AudioManager {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
  dataArray: Uint8Array | null;
  isActive: boolean;
  stream: MediaStream | null;

  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.isActive = false;
    this.stream = null;
  }

  async start() {
    if (this.isActive) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isActive = true;
      console.log("Audio analysis started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert(
        "Could not access microphone. Please ensure you have granted permission.",
      );
    }
  }

  stop() {
    if (!this.isActive) return;
    
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
  }

  getAudioData() {
    if (!this.isActive || !this.analyser || !this.dataArray) {
      return { low: 0, mid: 0, high: 0, level: 0 };
    }

    this.analyser.getByteFrequencyData(this.dataArray as any);
    
    // Split into 3 bands
    const binCount = this.analyser.frequencyBinCount;
    const lowBound = Math.floor(binCount * 0.1);
    const midBound = Math.floor(binCount * 0.5);
    
    let low = 0,
      mid = 0,
      high = 0;
    
    for (let i = 0; i < binCount; i++) {
      const val = this.dataArray[i] / 255.0;
      if (i < lowBound) low += val;
      else if (i < midBound) mid += val;
      else high += val;
    }
    
    low /= lowBound;
    mid /= midBound - lowBound;
    high /= binCount - midBound;
    
    const level = (low + mid + high) / 3;

    return { low, mid, high, level };
  }
}
