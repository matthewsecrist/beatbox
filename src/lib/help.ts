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
  chorus_depth:
    'How far the chorus copies drift out of tune. A little gives a gentle shimmer; a lot makes a seasick, wobbly warble. As a flanger, it sets how far the swoosh sweeps.',
  chorus_flanger:
    'Chorus adds copies of the sound that drift slightly in and out of tune, so one instrument sounds like several playing together, wide and shimmery. Flanger is the same idea made shorter and fed back on itself: a metallic, swooshing sweep, like a jet plane flying over.',
  chorus_mix: 'How loud the chorus copies are, on top of the sound itself.',
  chorus_rate:
    'How fast the chorus drifts. Slow is a lazy, gentle swirl; fast is a quick wobble. As a flanger, slow gives a long jet-plane swoosh.',
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
  drums_bars:
    "How long this pattern is: 1 to 4 bars. Use more for a groove that changes before it repeats, like a snare pickup at the end of every second bar. Longer, it repeats the bars it has, so you can change just the new ones; shorter, it drops the bars at the end. The Bar buttons above the grid pick which bar you're editing. A section always starts its pattern from bar 1.",
  drums_chorus:
    'How much of the drums goes into the chorus. Usually off; as a flanger, a little makes hi-hats and cymbals swoosh.',
  drums_crush:
    "Makes the drums crunchy and lo-fi, like an old sampler or a video game console. Off is clean; turn it up and the sound gets grainier and fizzier, down to a harsh 2-bit buzz at the top. A little suits the Lo-fi kit. It's the drums' own: the echo and room sound get the crunch too.",
  drums_delay:
    'How much of the drums goes into the echo. Most songs keep this low or off so the beat stays tight.',
  drums_eq_high:
    'Turns the top of the drums up or down: the sizzle of the hi-hats and cymbals and the snap of the snare. Up is crisper; down is softer and duller, like an old record.',
  drums_eq_low:
    'Turns the bottom of the drums up or down: the boom of the kick and the body of the toms. Up hits you in the chest; down makes room for a big bass.',
  drums_eq_mid:
    'Turns the middle of the drums up or down: the crack of the snare and the knock of the toms and congas. Down sounds scooped and hollow; up pushes the drums forward.',
  drums_euclid:
    'Spreads a number of hits as evenly as it can over a number of steps, the way drummers around the world have for centuries: 3 hits over 8 steps is the "tresillo" of Latin music, 5 over 8 a Cuban "cinquillo". Rotate slides them later. The pattern repeats to fill every bar, and Apply writes it into the track you picked.',
  drums_fill:
    "Every pattern has a fill: one more bar that a section can play last instead, for a drum fill into the next section (turn Fill on in the arrangement). Pattern shows the pattern, Fill its fill. A fill starts as the same as its pattern's last bar; change it (a snare roll, a tom run, a crash) and it becomes its own. Reset makes it the same again. While the drums play on their own, they loop whichever one you're editing.",
  drums_grid:
    'How many squares a bar has in this pattern. 1/16 is 16, four to a beat, for most beats. 1/16 triplets fits six in a beat, for rolling trap hi-hats and fast drum rolls; 1/8 triplets fits three, for a shuffle, a 12/8 blues or a swung, loping groove. Pick it before you start: it only changes while the pattern is empty, so no hit ever moves. To switch a pattern with hits, Clear it first.',
  drums_length:
    'How many squares this track plays before it starts over. Every track plays the whole pattern by default; a shorter one loops on its own and drifts against the others, like hi-hats over 12 squares against a kick over 16, so the beat changes from bar to bar before it lines up again. Squares past the end are dimmed and stay silent. Everything starts over when a new pattern or section starts.',
  drums_level: 'How loud the drums are overall, compared with the synth and the loops.',
  drums_pan:
    'Where the whole drum kit sits between the left and right speakers. C is the middle; turning it one way fades the other side out. Each drum also has its own Pan in the Kit tab.',
  drums_reverb:
    'How much of the drums goes into the room sound (the reverb). A little makes them sound less dry, like a real drum kit in a room.',
  drums_sound:
    'Which drum sound this track plays. Each kit starts every track with its own, but you can pick any sound from any kit, like an 808 kick with a 909 snare, or a bongo on the Tom track. Changing it plays the new sound so you can hear it.',
  drums_tracks:
    'More drums to play: rim shot, snap, shaker, conga, cowbell, wood block, ride and crash. Adding one gives it a row in the grid; it stays once you give it some hits, and the × hides it again while it has none.',
  drums_voice_pan:
    'Where this drum sits between the left and right speakers. Real drum kits are spread out: hi-hats a little to one side, toms from one side to the other, kick and snare in the middle. Double-click to centre it again.',
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
  fx_chorus_depth:
    "How far this sound's chorus copies drift out of tune: a little shimmers, a lot warbles. As a flanger, how far the swoosh sweeps.",
  fx_chorus_flanger:
    "Chorus makes this sound wide and shimmery, like several instruments playing together. Flanger gives it a metallic, sweeping swoosh instead, like a jet plane. It's part of the sound, so presets and loop pads keep their own.",
  fx_chorus_mix:
    "How much of this sound's own chorus you hear. Off has none. Unlike the song's chorus, it belongs to the sound, so a preset or a loop pad brings it along.",
  fx_chorus_rate:
    "How fast this sound's chorus drifts. Slow is a lazy swirl; fast is a quick wobble.",
  fx_crush:
    "Makes this sound crunchy and lo-fi, like an old video game console or a cheap sampler. Off is clean; turn it up and it gets grainier and fizzier, down to a harsh 2-bit buzz at the top. It's part of the sound, so presets and loop pads keep their own.",
  fx_delay_feedback:
    'How many echoes of this sound you hear. Low gives one or two quick repeats; high keeps them bouncing for a long time.',
  fx_delay_mix:
    "How loud this sound's own echoes are. Off has none. Unlike the song's delay, it belongs to the sound, so a preset or a loop pad brings its echo with it.",
  fx_delay_time:
    "How far apart this sound's echoes are, in note lengths at the song tempo: 1/16 is quick and close together, 1/2 slow and far apart. Dotted times land a bit off the beat for a bouncy echo.",
  fx_reverb_mix:
    "How much of this sound's own room sound you hear. Off has none. It belongs to the sound, so a preset or a loop pad brings its room with it.",
  fx_reverb_size:
    "How big this sound's room is: small is a bedroom, big is a cathedral that rings for seconds.",
  glide:
    'How long the slide from one note to the next takes. Off means notes jump straight to their pitch.',
  glide_mode:
    'Legato only slides when you press the next key while still holding the last one, so you choose when it slides. Always slides into every note.',
  humanize:
    'Makes the drums sound played by a person instead of a machine: every hit lands a tiny bit early or late, and a little softer or harder, different each time round. A little loosens the beat up; a lot sounds like a sloppy drummer. Off keeps every hit exactly on the grid.',
  kit: "Which set of drums plays: each kit has its own kick, snare and hi-hats. 808 is deep and booming, like hip-hop and trap; 909 is punchy, like house and techno; Lo-fi is dusty and soft. Picking a kit gives every track that kit's sound again, and resets the Tune, Decay and Pan knobs on each drum. Made your own mix? Name it and press Save kit, and it shows under Saved, ready for any song.",
  lfo_depth:
    'How big the wobble is. Off means nothing moves; turn it up for a bigger wave. What the number means depends on what it moves.',
  lfo_note:
    'How long one wobble lasts, as a note length at the song tempo: 1/4 is one wobble a beat, 1/8 two, 1/16 four. Dotted notes are half as long again and triplets two thirds as long, for a bouncier, off-grid feel. Change the tempo and the wobble keeps time.',
  lfo_rate: 'How fast the wobble goes. Low is a slow wave, like breathing; high is a fast flutter.',
  lfo_sync:
    "Hz sets the wobble's speed by itself. Sync locks it to the song's beat instead, so it speeds up and slows down with the tempo (and a section's own tempo): the way a dubstep wobble or a gated pad keeps in time.",
  lfo_target:
    'What the LFO moves. Filter makes a "wub wub" wobble. Pitch makes the note wave up and down, like a singer\'s vibrato. Amp makes the volume pulse, like a tremolo.',
  master_crush:
    'How crunchy the whole-song bitcrusher is: 12-bit is a light, gritty edge, 2-bit a harsh buzz, like an old game console or a cheap sampler. Mix sets how much of it you hear.',
  master_crush_mix:
    'How much of the crunched sound replaces the clean one: off is all clean, 100% all crunched. Ramp it up across a section to grind the build-up, or down for a clean drop.',
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
  pad_once:
    "A pad normally loops: it plays its notes over and over until you stop it. Click the arrow in a pad's corner (it turns into a 1) and the pad plays once instead, then stops by itself: right for a riser, a crash of sound or a one-off effect. In the arrangement it plays once from the start of each section it's in, and stays quiet for the rest.",
  panel_chorus:
    'The chorus makes a sound wider and richer by adding copies of it that drift slightly in and out of tune, like a choir instead of one singer. Switched to Flanger, it makes a swooshing, jet-plane sweep instead. Each instrument has its own send to it.',
  panel_crush:
    "The bitcrusher makes the whole song sound like it's coming out of an old computer or game console: it rounds the sound off into a few steps, adding grit and fizz. The synth's sounds (in FX) and the drums (in Kit) have their own too.",
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
  panel_mix:
    "The instrument's place in the mix. Pan sets where it sits between the left and right speakers, so instruments spread out instead of crowding the middle. The EQ is a tone control with three knobs, like on a stereo: Low for the deep bass, Mid for the middle and High for the bright top. Double-click a knob to put it back.",
  panel_osc:
    'An oscillator is the part that actually makes the sound: it vibrates really fast, like a guitar string. The synth has two, and you hear them mixed together.',
  panel_pitch_env:
    'The pitch envelope bends each note at its start: the note begins higher (or lower) and quickly slides onto its real pitch. A big, fast bend makes a laser "pew" or a zap; a small one on a low note gives the booming drop of an 808 kick or bass.',
  panel_pluck:
    'A short burst starts a vibrating string, then it rings and fades naturally. Brightness changes its tone and Ring time changes how long it lasts. The filter, envelope, pitch controls and effects still shape it. For a clear pluck, keep Attack short and Sustain high.',
  panel_reverb:
    'The reverb makes it sound like the music is playing in a room, a hall or a huge cave, with the sound bouncing off the walls and ringing on after each note.',
  panel_sends:
    'Sends choose how much of each instrument goes into the echo, the room sound and the chorus. Off keeps that instrument dry; turn one up to put it in the effect. The synth sends cover the loop pads too.',
  panel_sound_chorus:
    "This sound's own chorus: it spreads the sound wide and makes it shimmer, or swoosh as a flanger. It's part of the sound, like Drive, so presets and loop pads bring it with them.",
  panel_sound_crush:
    "This sound's own bitcrusher: it makes it sound like it's coming out of an old computer or game console, rounding the sound off into a few steps for grit and fizz. Great for chiptune leads and lo-fi keys.",
  panel_sound_delay:
    "This sound's own echo, on top of the song's shared one. It's part of the sound, so presets and loop pads keep their own echo.",
  panel_sound_reverb:
    "This sound's own room sound, on top of the song's shared reverb. It's part of the sound, so presets and loop pads keep their own room.",
  panel_sub_noise:
    'Two more sounds to mix in with the oscillators: a deep sub underneath for weight, and noise on top for breath and hiss. Both are off until you turn them up.',
  pitch_env_amount:
    'How far off each note starts, in semitones (12 is an octave). Above zero it starts high and swoops down; below zero it starts low and swoops up. Off keeps notes on pitch.',
  pitch_env_decay:
    'How long each note takes to slide from where the Amount starts it onto its real pitch. Short is a snappy zap or click; long is a slow, falling swoop.',
  pluck_brightness:
    'How bright the string sounds. Low is soft and rounded, like a gently plucked nylon string; high is crisp and twangy, with more bite.',
  pluck_decay:
    'How long the string rings while you hold a note, in seconds. Short is tight and muted; long lets it shimmer. Letting go still uses the Amp Release to damp the note, and Brightness also changes how quickly the high part fades.',
  release:
    'How long a note keeps ringing after you let go of the key. Short stops right away; long fades out like an echo in a big hall.',
  reverb_mix:
    'How loud the room sound is compared with the original. High sounds far away and dreamy; low sounds close and dry.',
  reverb_size:
    'How big the room sounds: small is a bedroom, big is a cathedral that rings for seconds.',
  roll_bend:
    "Bends one loop note without needing another note to slide to. Pick Bend, select a note, and set its bend in or out. The white line shows its pitch. Press Play to hear it; the live keyboard doesn't change.",
  roll_bend_duration:
    'How many beats the bend takes, following the tempo. In starts when the note starts; Out finishes when it ends. If the two times are longer than the note, both shrink together to fit.',
  roll_bend_in:
    'Where this note starts before sliding onto its written pitch, in semitones (12 is an octave). Negative starts below and scoops up; positive starts above and falls down. 0 turns the bend in off.',
  roll_bend_out:
    'Where this note ends after sliding away from its written pitch, in semitones (12 is an octave). Negative dives down; positive climbs up. 0 turns the bend out off.',
  section_bpm:
    "How fast this section goes, in beats per minute. Leave it empty to play it at the song tempo. Slow a bridge right down, or speed up a final chorus: when the song gets there, everything switches to this speed on the section's first beat, and back afterwards.",
  section_fill:
    "Plays this section's drum pattern with its fill on the last bar: a drum fill that leads into the next section, like a drummer's roll before the chorus. Off keeps the pattern all the way through. Write the fill on the drums' Steps tab: pick the pattern, then Fill.",
  section_pad_start:
    "Which bar of this pad's loop to start from when it begins in this section. 1 plays from the beginning; 5 skips straight to the second half of an eight-bar loop. It wraps back to bar 1 at the end, or stops there if the pad plays once. A pad carried over from the previous section keeps its place instead: this setting doesn't restart it.",
  sound_mode:
    'Synth uses the two oscillators, sub and noise. Plucked string starts a vibrating string that rings and fades on its own, without guitar-body or strumming effects. Each preset and loop pad keeps its own choice; switching back keeps your oscillator settings.',
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
    'Makes the beat bounce instead of marching straight. At 50% every step is evenly spaced; turn it up and every second step lands a little late, for a skippy, shuffly groove like hip-hop or jazz. It only swings patterns on the 1/16 grid: triplets already bounce.',
  synth_chorus:
    'How much of the synth (and the loop pads) goes into the chorus. Turn it up to make pads and keys wide and shimmery.',
  synth_delay: 'How much of the synth (and the loop pads) goes into the echo.',
  synth_eq_high:
    'Turns the top of the synth (and the loop pads) up or down: the fizz and air. Up is brighter and crisper; down is warmer and darker.',
  synth_eq_low:
    'Turns the bottom of the synth (and the loop pads) up or down: the bass and warmth. Down cleans up a muddy mix when the drums carry the low end.',
  synth_eq_mid:
    'Turns the middle of the synth (and the loop pads) up or down, where most notes live. Up pushes it forward; down tucks it behind the drums.',
  synth_filter:
    'Opens or closes the filter on every synth sound at once, the keys and all the loop pads, by up to 4 octaves each way. 0 leaves each sound as it is; below 0 makes them darker and more muffled, above 0 brighter. Ramp it up over a section for a build-up that opens the sound, or down for a breakdown.',
  synth_pan:
    'Where the synth (and the loop pads) sits between the left and right speakers. C is the middle; turning it one way fades the other side out.',
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
