// A Karplus–Strong delay loop with a one-pole loss filter and a fractional
// all-pass delay. The filter's phase is subtracted from the requested period.
export class PluckedString {
  get silent(): boolean {
    return this.initialized && this.quiet > this.rate * 0.05
  }
  private allpass = 0
  private apInput = 0
  private apOutput = 0
  private readonly buffer: Float32Array
  private delay = 1
  private feedback = 0
  private head = 0
  private initialized = false
  private lastBrightness = -1
  private lastDecay = -1
  private lastFrequency = 0
  private low = 0
  private pole = 0
  private quiet = 0

  private seed: number

  constructor(
    private readonly rate: number,
    seed = 1
  ) {
    this.buffer = new Float32Array(Math.ceil(rate / 8) + 4)
    this.seed = seed || 1
  }

  sample(frequency: number, brightness: number, decay: number): number {
    frequency = Math.max(8, Math.min(this.rate * 0.4, frequency))
    brightness = Math.max(0, Math.min(1, brightness))
    decay = Math.max(0.1, Math.min(10, decay))
    if (
      frequency !== this.lastFrequency ||
      brightness !== this.lastBrightness ||
      decay !== this.lastDecay
    ) {
      this.tune(frequency, brightness, decay)
    }
    if (!this.initialized) {
      // Seed exactly one period, centered to avoid a lingering DC component.
      let mean = 0
      for (let i = this.buffer.length - this.delay; i < this.buffer.length; i++) {
        this.seed ^= this.seed << 13
        this.seed ^= this.seed >>> 17
        this.seed ^= this.seed << 5
        const noise = (this.seed >>> 0) / 2147483648 - 1
        this.buffer[i] = noise
        mean += noise
      }
      mean /= this.delay
      for (let i = this.buffer.length - this.delay; i < this.buffer.length; i++)
        this.buffer[i] = (this.buffer[i] ?? 0) - mean
      this.initialized = true
    }
    let read = this.head - this.delay
    if (read < 0) read += this.buffer.length
    const input = this.buffer[read] ?? 0
    this.low = (1 - this.pole) * input + this.pole * this.low
    const output = this.allpass * this.low + this.apInput - this.allpass * this.apOutput
    this.apInput = this.low
    this.apOutput = output
    this.buffer[this.head] = output * this.feedback
    this.head++
    if (this.head === this.buffer.length) this.head = 0
    if (Math.abs(output) < 0.00001) this.quiet++
    else this.quiet = 0
    return output
  }

  private tune(frequency: number, brightness: number, decay: number): void {
    const omega = (2 * Math.PI * frequency) / this.rate
    const loss = Math.exp(-Math.log(1000) / (frequency * decay))
    const q = loss * loss
    const a = 1 - q
    const b = 2 - 2 * q * Math.cos(omega)
    // Limit damping so the fundamental can achieve the requested RT60 without
    // feedback exceeding unity (which would make DC unstable).
    const cap = (2 * a) / (b + Math.sqrt(Math.max(0, b * b - 4 * a * a)))
    this.pole = Math.min(0.96, cap * 0.999) * (1 - brightness) ** 2
    const r = this.pole
    const phase = Math.atan2(r * Math.sin(omega), 1 - r * Math.cos(omega))
    const period = this.rate / frequency - phase / omega
    this.delay = Math.max(1, Math.floor(period))
    const fraction = period - this.delay
    // Exact all-pass phase at the fundamental, rather than a linear delay approximation.
    this.allpass = Math.sin((omega * (1 - fraction)) / 2) / Math.sin((omega * (1 + fraction)) / 2)
    const magnitude = (1 - r) / Math.sqrt(1 - 2 * r * Math.cos(omega) + r * r)
    this.feedback = Math.min(1, loss / magnitude)
    this.lastFrequency = frequency
    this.lastBrightness = brightness
    this.lastDecay = decay
  }
}
