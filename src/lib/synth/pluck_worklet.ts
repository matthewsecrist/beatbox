import { PluckedString } from './pluck_dsp.js'

// AudioWorklet globals are not included in TypeScript's DOM library.
declare const sampleRate: number
declare const currentTime: number
declare const registerProcessor: (name: string, processor: typeof StringProcessor) => void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

class StringProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        automationRate: 'a-rate',
        defaultValue: 440,
        maxValue: 24000,
        minValue: 8,
        name: 'frequency'
      },
      {
        automationRate: 'a-rate',
        defaultValue: 0,
        maxValue: 9600,
        minValue: -9600,
        name: 'detune'
      },
      { automationRate: 'k-rate', defaultValue: 0.5, maxValue: 1, minValue: 0, name: 'brightness' },
      { automationRate: 'k-rate', defaultValue: 2, maxValue: 10, minValue: 0.1, name: 'decay' }
    ]
  }

  private readonly start: number
  private stop: number
  private readonly string = new PluckedString(
    sampleRate,
    Math.floor(Math.random() * 2147483647) + 1
  )

  constructor(options: { processorOptions: { start: number } }) {
    super()
    this.start = options.processorOptions.start
    // A held, naturally decayed note must not keep a processor and LFOs forever.
    this.stop = this.start + 20.1
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === 'number') this.stop = Math.min(this.stop, event.data)
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0]?.[0]
    if (!output) return true
    const frequency = parameters.frequency
    const detune = parameters.detune
    const brightness = parameters.brightness?.[0] ?? 0.5
    const decay = parameters.decay?.[0] ?? 2
    for (let i = 0; i < output.length; i++) {
      const t = currentTime + i / sampleRate
      if (t >= this.stop || (t >= this.start && this.string.silent)) {
        output.fill(0, i)
        this.port.postMessage('ended')
        return false
      }
      if (t < this.start) {
        output[i] = 0
        continue
      }
      const f = frequency?.[frequency.length === 1 ? 0 : i] ?? 440
      const cents = detune?.[detune.length === 1 ? 0 : i] ?? 0
      output[i] = this.string.sample(f * 2 ** (cents / 1200), brightness, decay)
    }
    return true
  }
}

registerProcessor('beatbox-plucked-string', StringProcessor)
