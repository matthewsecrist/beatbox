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
  automation:
    "Lets a setting change by itself while the song plays. Add a lane, then press + in a section and type where the setting starts and where it ends up: it slides smoothly from one to the other over that section, like turning a knob during a build-up. Sections without a value keep the song's own setting. It only moves when the song (or one section) plays, not a pad or the drums on their own.",
  chord:
    'Makes one key play a whole chord: several notes that sound good together, built up from the key you press. Major sounds happy and bright, Minor sad or mysterious, and 7ths jazzy. Off plays just the one note.',
  comp_amount:
    'How hard the compressor squeezes. A little evens out the song so everything sits together; a lot flattens it into a dense, punchy wall where the quiet bits come up and the loud hits come down.',
  comp_on:
    'The compressor evens out how loud the whole song is, turning the loudest moments down and the quiet ones up, so the drums and synth sound "glued" together like a finished record. Off leaves the song as it is.',
  decay: 'After a note reaches its loudest, how quickly it drops down to the Sustain level.',
  delay_feedback:
    'How many echoes you hear. Low gives one or two quick repeats; high keeps them bouncing for a long time.',
  delay_mix: 'How loud the echoes are compared with the original sound.',
  delay_pingpong:
    'Straight keeps every echo in the middle. Ping-pong bounces them from side to side: the first echo comes from the left, the next from the right, then left again, so the sound seems to fly around your head. Best on headphones.',
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
  duck_amount:
    'How far the synth drops each time the kick hits. Off leaves it alone; a little gently makes room for the kick; a lot makes the synth nearly vanish on every kick for a big, obvious pump. Softer kicks duck it less.',
  duck_release:
    'How long the synth takes to come back after each kick, as a note length at the song tempo: 1/16 is a quick flick, 1/4 swells back just as the next four-on-the-floor kick lands, for the deepest pump.',
  filter_attack:
    'How quickly the filter opens at the start of each note. Short gives a snappy "blip"; long gives a slow "wooow".',
  filter_cutoff:
    'Where the filter starts blocking sound. With the Low type, low makes it dark and muffled, like music through a wall, and high lets everything through, bright and crisp. The other types move their own way round it.',
  filter_decay:
    'How long the filter takes to close down again after it opens at the start of a note.',
  filter_env_amount:
    'How far the filter opens by itself at the start of each note, then closes again. That makes the "wow" or "squelch" you hear in acid basses. Below zero it goes darker instead. Off means the filter stays where the Cutoff puts it.',
  filter_release: 'How long the filter takes to close all the way after you let go of the key.',
  filter_resonance:
    'Adds a whistle right at the cutoff. A little makes the sound sharper; a lot makes it sing and squeal, especially when the cutoff moves.',
  filter_sustain: 'How far open the filter stays while you keep holding the key.',
  filter_type:
    'Which part of the sound the filter keeps. Low keeps the deep part and cuts the fizz (the usual synth sound). High keeps the bright part and cuts the bass, thin and airy. Band keeps only the sound around the Cutoff, nasal like a telephone or a "wah". Notch cuts a gap out at the Cutoff, hollow and phasey when it moves.',
  filter_velocity:
    'How much softer notes open the filter less. Off, every note gets the same "wow" from the envelope however hard it\'s played. Turned up, a soft note stays darker and a hard one opens bright, like hitting a real piano or guitar harder. Set how hard each note plays in the piano roll\'s Vel lane.',
  glide:
    'How long the slide from one note to the next takes. Off means notes jump straight to their pitch.',
  glide_mode:
    'Legato only slides when you press the next key while still holding the last one, so you choose when it slides. Always slides into every note.',
  humanize:
    'Makes the drums sound played by a person instead of a machine: every hit lands a tiny bit early or late, and a little softer or harder, different each time round. A little loosens the beat up; a lot sounds like a sloppy drummer. Off keeps every hit exactly on the grid.',
  kit: "Which set of drums plays: each kit has its own kick, snare and hi-hats. 808 is deep and booming, like hip-hop and trap; 909 is punchy, like house and techno; Lo-fi is dusty and soft. Picking a kit gives every track that kit's sound again, and resets the Tune and Decay knobs on each drum. Made your own mix? Name it and press Save kit, and it shows under Saved, ready for any song.",
  lfo_depth:
    'How big the wobble is. Off means nothing moves; turn it up for a bigger wave. What the number means depends on what it moves.',
  lfo_note:
    'How long one wobble lasts, as a note length at the song tempo: 1/4 is one wobble a beat, 1/8 two, 1/16 four. Dotted notes are half as long again and triplets two thirds as long, for a bouncier, off-grid feel. Change the tempo and the wobble keeps time.',
  lfo_rate: 'How fast the wobble goes. Low is a slow wave, like breathing; high is a fast flutter.',
  lfo_sync:
    "Hz sets the wobble's speed by itself. Sync locks it to the song's beat instead, so it speeds up and slows down with the tempo (and a section's own tempo): the way a dubstep wobble or a gated pad keeps in time.",
  lfo_target:
    'What the LFO moves. Filter makes a "wub wub" wobble. Pitch makes the note wave up and down, like a singer\'s vibrato. Amp makes the volume pulse, like a tremolo.',
  master_filter:
    "A DJ filter on the whole song. Slide left and the sound gets darker and more muffled, as if it's coming through a wall, until only the bass is left; slide right and the bass drains away, leaving it thin and tinny. Sweep it slowly for build-ups and breakdowns, and drag it back to the middle (off) for the drop.",
  noise_level:
    'Mixes in white noise: the "shhh" of a radio between stations. A little adds breath to a flute or air to a pad; a lot makes wind, sweeps and risers. With the oscillators turned down and a short envelope, it plays hi-hats on the keys.',
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
  panel_duck:
    "Sidechain makes the synth duck out of the way every time the kick drum hits, then swell back up, so the whole song pumps and breathes with the beat. It's the classic house and trance sound, and it keeps the kick punchy instead of buried under pads and bass. It follows the drums' kick wherever it plays: the drums' own Play, the song, and beats you preview in the Loop Browser.",
  panel_envelope:
    'The envelope shapes how loud each note is over time: how it starts, how it holds while you keep the key down, and how it fades away when you let go.',
  panel_filter:
    'The filter is like a tone knob. Usually it lets the low, deep part of the sound through and blocks the high, fizzy part, so it can make a sound bright and sharp or dark and muffled. Its Type can flip that round, or keep or cut just a slice of the sound.',
  panel_glide:
    'Glide makes each note slide up or down into the next one, like a trombone or a singer swooping between notes, instead of jumping straight there.',
  panel_lfo:
    'An LFO is like an invisible hand that keeps turning a knob back and forth, slowly or quickly. It makes sounds wobble, wave or shimmer on their own.',
  panel_master:
    'The last stop before your speakers, for the whole song: a compressor that glues everything together, a DJ filter for sweeps, then a limiter that is always on and stops the loudest peaks from distorting when lots of sounds, echoes and drive pile up.',
  panel_osc:
    'An oscillator is the part that actually makes the sound: it vibrates really fast, like a guitar string. The synth has two, and you hear them mixed together.',
  panel_pitch_env:
    'The pitch envelope bends each note at its start: the note begins higher (or lower) and quickly slides onto its real pitch. A big, fast bend makes a laser "pew" or a zap; a small one on a low note gives the booming drop of an 808 kick or bass.',
  panel_reverb:
    'The reverb makes it sound like the music is playing in a room, a hall or a huge cave, with the sound bouncing off the walls and ringing on after each note.',
  panel_sends:
    'Sends choose how much of each instrument goes into the echo and the room sound. Off keeps that instrument dry; turn one up to put it in the effect. The synth sends cover the loop pads too.',
  panel_sub_noise:
    'Two more sounds to mix in with the oscillators: a deep sub underneath for weight, and noise on top for breath and hiss. Both are off until you turn them up.',
  pitch_env_amount:
    'How far off each note starts, in semitones (12 is an octave). Above zero it starts high and swoops down; below zero it starts low and swoops up. Off keeps notes on pitch.',
  pitch_env_decay:
    'How long each note takes to slide from where the Amount starts it onto its real pitch. Short is a snappy zap or click; long is a slow, falling swoop.',
  release:
    'How long a note keeps ringing after you let go of the key. Short stops right away; long fades out like an echo in a big hall.',
  reverb_mix:
    'How loud the room sound is compared with the original. High sounds far away and dreamy; low sounds close and dry.',
  reverb_size:
    'How big the room sounds: small is a bedroom, big is a cathedral that rings for seconds.',
  section_bpm:
    "How fast this section goes, in beats per minute. Leave it empty to play it at the song tempo. Slow a bridge right down, or speed up a final chorus: when the song gets there, everything switches to this speed on the section's first beat, and back afterwards.",
  step_accent:
    'Click a lit square to make that hit extra loud and punchy (it gets a red dot). Accents on the big beats help the rhythm stand out.',
  step_hits:
    'Click a square to turn a drum hit on or off. The lit squares play when the beat reaches them, from left to right.',
  step_lock:
    "Gives one hit its own Tune and Decay, just for that square: click a square to pick it (it plays), then move the sliders. Tune the toms on each step to play a melody, give a long 808 kick a different note on each hit for a bassline, or cut a single open hi-hat short. Locked squares get a blue dot; Clear gives the hit back its track's own settings from the Kit tab.",
  step_probability:
    "The chance that a hit plays each time round: click a lit square to go from 100% (always) to 75, 50 and 25%. Lower chances make the beat change a little every time, like a real drummer who doesn't play exactly the same thing twice.",
  step_ratchet:
    'Squeezes 2, 3 or 4 quick hits into one square instead of one, like a tiny drum roll. Click a lit square to go through them. Great for trap hi-hats and build-ups.',
  step_velocity:
    'How hard each drum is hit: click a lit square to go from 100% (loud) to 75, 50 and 25% (soft). Quiet "ghost" hits between the loud ones make a beat feel groovy and human. Softer squares look dimmer.',
  sub_level:
    'Adds a pure, deep tone one octave below Osc 1, following its notes. It makes a bass heavier and fuller, the kind of low end you feel more than hear, without making it any buzzier.',
  sustain:
    'How loud a note stays while you keep holding the key. At 0% it fades out even if you hold on, like a piano or a bell.',
  swing:
    'Makes the beat bounce instead of marching straight. At 50% every step is evenly spaced; turn it up and every second step lands a little late, for a skippy, shuffly groove like hip-hop or jazz.',
  synth_delay: 'How much of the synth (and the loop pads) goes into the echo.',
  synth_filter:
    'Opens or closes the filter on every synth sound at once, the keys and all the loop pads, by up to 4 octaves each way. 0 leaves each sound as it is; below 0 makes them darker and more muffled, above 0 brighter. Ramp it up over a section for a build-up that opens the sound, or down for a breakdown.',
  synth_reverb: 'How much of the synth (and the loop pads) goes into the room sound (the reverb).',
  tap_tempo:
    'Tap this button along with the beat, four or more times, and the song tempo follows your taps. Stop for two seconds and the next tap starts counting again. Handy when you know how fast a song should feel but not its number.',
  tempo:
    'How fast the whole song goes, in beats per minute (BPM): about 80 is a slow nod, 120 a dance, 170 a sprint. The drums, loops and arpeggiator all follow it.',
  volume: 'How loud the synth is overall, loops included.'
} as const

// The help for a setting or panel: `osc1_level` and `osc2_level` share `osc_level`.
export function help(key: string): string | undefined {
  const general = key.replace(/^(osc|lfo)[12]($|_)/, '$1$2')
  return general in HELP ? HELP[general as keyof typeof HELP] : undefined
}
