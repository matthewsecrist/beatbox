import workletUrl from './pluck_worklet.ts?worker&url'

const preparations = new WeakMap<BaseAudioContext, Promise<void>>()
const prepared = new WeakSet<BaseAudioContext>()

export interface PluckSource {
  brightness: AudioParam
  decay: AudioParam
  detune: AudioParam
  frequency: AudioParam
  node: AudioWorkletNode
  onended: (() => void) | null
  stop(at: number): void
}

export function createPluck(ctx: BaseAudioContext, at: number): PluckSource {
  if (!prepared.has(ctx))
    throw new Error('Synth is not ready: await synth.ready() before playing notes')
  const node = new AudioWorkletNode(ctx, 'beatbox-plucked-string', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { start: at }
  })
  const param = (name: string): AudioParam => {
    const value = node.parameters.get(name)
    if (!value) throw new Error(`Missing plucked-string parameter: ${name}`)
    return value
  }
  const source: PluckSource = {
    brightness: param('brightness'),
    decay: param('decay'),
    detune: param('detune'),
    frequency: param('frequency'),
    node,
    onended: null,
    stop(time) {
      node.port.postMessage(time)
    }
  }
  node.port.onmessage = () => source.onended?.()
  node.onprocessorerror = () => source.onended?.()
  return source
}

export function preparePluck(ctx: BaseAudioContext): Promise<void> {
  const existing = preparations.get(ctx)
  if (existing) return existing
  const loading = ctx.audioWorklet.addModule(workletUrl).then(
    () => {
      prepared.add(ctx)
    },
    (error: unknown) => {
      preparations.delete(ctx)
      throw error
    }
  )
  preparations.set(ctx, loading)
  return loading
}
