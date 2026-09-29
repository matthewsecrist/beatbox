// Plain-English explanations shown by the ⓘ next to the synth's Sound settings,
// the Chord/Arp bar, the drum machine's step edit buttons and the Effects panel.
// Written for curious beginners (kids included): what you'll hear, not how it
// works inside.
//
// Keys are setting names, with the oscillator or LFO number left out (`osc_level`
// covers osc1_level and osc2_level); drum step edit buttons are `step_<mode>`, and
// panels `panel_<name>`, so a panel never shares a key with a setting. The lint
// rules keep the keys sorted.

export const HELP = {
  arp: 'The arpeggiator plays the notes you hold one at a time instead of all together, in a pattern: Up goes low to high, Down high to low, Up-Down climbs and comes back, and Random jumps around. It keeps in time with the song.',
  arp_rate:
    'How fast the arpeggiator plays its notes, in note lengths: 1/4 is one note per beat, 1/8 two, 1/16 four, 1/32 eight. T (triplet) fits three notes where there would be two, for a rolling, galloping feel.',
  attack:
    'How quickly a note gets loud. Short is instant, like hitting a drum; long fades in slowly, like a violin swelling up.',
  chord:
    'Makes one key play a whole chord: several notes that sound good together, built up from the key you press. Major sounds happy and bright, Minor sad or mysterious, and 7ths jazzy. Off plays just the one note.',
  decay: 'After a note reaches its loudest, how quickly it drops down to the Sustain level.',
  delay_feedback:
    'How many echoes you hear. Low gives one or two quick repeats; high keeps them bouncing for a long time.',
  delay_mix: 'How loud the echoes are compared with the original sound.',
  delay_time:
    'How far apart the echoes are, in note lengths: 1/16 is quick and close together, 1/2 is slow and far apart. Dotted times land a bit off the beat for a bouncy, galloping echo.',
  drive:
    'Pushes the sound so hard that it breaks up, like turning a guitar amp all the way up. A little adds warmth and grit; a lot makes it fuzzy and buzzy. Off keeps it clean. Turn the filter Cutoff down to tame the fizz.',
  drive_mix:
    'How much of the crunched sound you hear, blended with the clean one. 100% is all crunch. Lower keeps the clean sound underneath, so a bass stays deep and solid while the grit sits on top.',
  drive_type:
    'The kind of crunch. Soft is smooth and warm. Tube is warm too, but thicker, like an old amplifier. Hard is sharp and aggressive. Fold is wild and metallic, and it keeps changing as you turn up the Amount.',
  drums_delay:
    'How much of the drums goes into the echo. Most songs keep this low or off so the beat stays tight.',
  drums_euclid:
    'Spreads a number of hits as evenly as it can over a number of steps, the way drummers around the world have for centuries: 3 hits over 8 steps is the "tresillo" of Latin music, 5 over 8 a Cuban "cinquillo". Rotate slides them later. The pattern repeats to fill the bar, and Apply writes it into the track you picked.',
  drums_level: 'How loud the drums are overall, compared with the synth and the loops.',
  drums_reverb:
    'How much of the drums goes into the room sound (the reverb). A little makes them sound less dry, like a real drum kit in a room.',
  drums_sound:
    'Which drum sound this track plays. Each kit starts every track with its own, but you can pick any sound from any kit, like an 808 kick with a 909 snare, or a bongo on the Tom track. Changing it plays the new sound so you can hear it.',
  drums_tracks:
    'More drums to play: rim shot, snap, shaker, conga, cowbell, wood block, ride and crash. Adding one gives it a row in the grid; it stays once you give it some hits, and the × hides it again while it has none.',
  filter_attack:
    'How quickly the filter opens at the start of each note. Short gives a snappy "blip"; long gives a slow "wooow".',
  filter_cutoff:
    'Where the filter starts blocking sound. Low makes it dark and muffled, like music through a wall. High lets everything through, bright and crisp.',
  filter_decay:
    'How long the filter takes to close down again after it opens at the start of a note.',
  filter_env_amount:
    'How far the filter opens by itself at the start of each note, then closes again. That makes the "wow" or "squelch" you hear in acid basses. Below zero it goes darker instead. Off means the filter stays where the Cutoff puts it.',
  filter_release: 'How long the filter takes to close all the way after you let go of the key.',
  filter_resonance:
    'Adds a whistle right at the cutoff. A little makes the sound sharper; a lot makes it sing and squeal, especially when the cutoff moves.',
  filter_sustain: 'How far open the filter stays while you keep holding the key.',
  glide:
    'How long the slide from one note to the next takes. Off means notes jump straight to their pitch.',
  glide_mode:
    'Legato only slides when you press the next key while still holding the last one, so you choose when it slides. Always slides into every note.',
  kit: "Which set of drums plays: each kit has its own kick, snare and hi-hats. 808 is deep and booming, like hip-hop and trap; 909 is punchy, like house and techno; Lo-fi is dusty and soft. Picking a kit gives every track that kit's sound again, and resets the Tune and Decay knobs on each drum. Made your own mix? Name it and press Save kit, and it shows under Saved, ready for any song.",
  lfo_depth:
    'How big the wobble is. Off means nothing moves; turn it up for a bigger wave. What the number means depends on what it moves.',
  lfo_rate: 'How fast the wobble goes. Low is a slow wave, like breathing; high is a fast flutter.',
  lfo_target:
    'What the LFO moves. Filter makes a "wub wub" wobble. Pitch makes the note wave up and down, like a singer\'s vibrato. Amp makes the volume pulse, like a tremolo.',
  osc_detune:
    'Pushes this oscillator a tiny bit out of tune. When the two oscillators are slightly apart, they rub against each other and sound thick and shimmery, like a choir instead of one singer.',
  osc_level: 'How loud this oscillator is. Turn one all the way down to hear the other on its own.',
  osc_octave:
    'Moves this oscillator up or down by whole octaves. An octave up is the same note but higher, like a kid singing along with a grown-up.',
  osc_wave:
    'The shape of the vibration, which changes the character of the sound. Sine is soft and pure, like a whistle. Tri (triangle) is a bit brighter, like a flute. Saw is buzzy and bold, like a trumpet or a big synth. Square is hollow and beepy, like an old video game.',
  panel_delay:
    'The delay is an echo: it plays back what you hear a little later, again and again, like shouting in a canyon. The echoes line up with the beat.',
  panel_drive:
    'Drive is distortion: it crunches the sound from the oscillators before it reaches the filter, adding a rough, buzzing edge. It makes basses growl and cut through, even on small speakers.',
  panel_envelope:
    'The envelope shapes how loud each note is over time: how it starts, how it holds while you keep the key down, and how it fades away when you let go.',
  panel_filter:
    'The filter is like a tone knob. It lets the low, deep part of the sound through and blocks the high, fizzy part, so it can make a sound bright and sharp or dark and muffled.',
  panel_glide:
    'Glide makes each note slide up or down into the next one, like a trombone or a singer swooping between notes, instead of jumping straight there.',
  panel_lfo:
    'An LFO is like an invisible hand that keeps turning a knob back and forth, slowly or quickly. It makes sounds wobble, wave or shimmer on their own.',
  panel_osc:
    'An oscillator is the part that actually makes the sound: it vibrates really fast, like a guitar string. The synth has two, and you hear them mixed together.',
  panel_reverb:
    'The reverb makes it sound like the music is playing in a room, a hall or a huge cave, with the sound bouncing off the walls and ringing on after each note.',
  panel_sends:
    'Sends choose how much of each instrument goes into the echo and the room sound. Off keeps that instrument dry; turn one up to put it in the effect. The synth sends cover the loop pads too.',
  release:
    'How long a note keeps ringing after you let go of the key. Short stops right away; long fades out like an echo in a big hall.',
  reverb_mix:
    'How loud the room sound is compared with the original. High sounds far away and dreamy; low sounds close and dry.',
  reverb_size:
    'How big the room sounds: small is a bedroom, big is a cathedral that rings for seconds.',
  step_accent:
    'Click a lit square to make that hit extra loud and punchy (it gets a red dot). Accents on the big beats help the rhythm stand out.',
  step_hits:
    'Click a square to turn a drum hit on or off. The lit squares play when the beat reaches them, from left to right.',
  step_probability:
    "The chance that a hit plays each time round: click a lit square to go from 100% (always) to 75, 50 and 25%. Lower chances make the beat change a little every time, like a real drummer who doesn't play exactly the same thing twice.",
  step_ratchet:
    'Squeezes 2, 3 or 4 quick hits into one square instead of one, like a tiny drum roll. Click a lit square to go through them. Great for trap hi-hats and build-ups.',
  step_velocity:
    'How hard each drum is hit: click a lit square to go from 100% (loud) to 75, 50 and 25% (soft). Quiet "ghost" hits between the loud ones make a beat feel groovy and human. Softer squares look dimmer.',
  sustain:
    'How loud a note stays while you keep holding the key. At 0% it fades out even if you hold on, like a piano or a bell.',
  swing:
    'Makes the beat bounce instead of marching straight. At 50% every step is evenly spaced; turn it up and every second step lands a little late, for a skippy, shuffly groove like hip-hop or jazz.',
  synth_delay: 'How much of the synth (and the loop pads) goes into the echo.',
  synth_reverb: 'How much of the synth (and the loop pads) goes into the room sound (the reverb).',
  tempo:
    'How fast the whole song goes, in beats per minute (BPM): about 80 is a slow nod, 120 a dance, 170 a sprint. The drums, loops and arpeggiator all follow it.',
  volume: 'How loud the synth is overall, loops included.'
} as const

// The help for a setting or panel: `osc1_level` and `osc2_level` share `osc_level`.
export function help(key: string): string | undefined {
  const general = key.replace(/^(osc|lfo)[12]($|_)/, '$1$2')
  return general in HELP ? HELP[general as keyof typeof HELP] : undefined
}
