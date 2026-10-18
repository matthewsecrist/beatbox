import type { SynthParams } from '../types.js'

import { arpQuestion, effectQuestion, endingQuestion } from './arrange.js'
import {
  type Beat,
  chordQuestion,
  higherQuestion,
  inKeyQuestion,
  intervalQuestion,
  type Question,
  scaleQuestion,
  spellChordQuestion,
  stepAboveQuestion
} from './theory.js'

// The Learn section's lessons, in order. Each is a list of blocks: text, an
// interactive widget, a beat to build, or a quiz (made fresh each time it starts).
export type Block =
  | { body: string[]; heading?: string; kind: 'text' }
  | { goal: string; kind: 'rhythm'; target: Beat }
  | { kind: 'quiz'; questions: () => Question[] }
  | {
      kind:
        | 'arp'
        | 'chords'
        | 'fx'
        | 'intervals'
        | 'keyboard'
        | 'melody'
        | 'scales'
        | 'sketch'
        | 'sound'
    }

export interface Lesson {
  blocks: Block[]
  // The music basics, or making music with Beatbox's tools.
  part: 'basics' | 'making'
  slug: string
  summary: string
  title: string
  // Where to put it into practice in the workstation.
  tryIt: string
}

// A bare sawtooth with the filter wide open.
const BRIGHT: Partial<SynthParams> = { filter_cutoff: 9000, filter_resonance: 1, osc2_level: 0 }

// A short, plain note, so an effect's tail is easy to hear after it.
const PLAIN: Partial<SynthParams> = {
  decay: 0.25,
  filter_cutoff: 3000,
  osc1_wave: 'triangle',
  osc2_level: 0,
  release: 0.15,
  sustain: 0
}

const times = (n: number, make: () => Question): Question[] => Array.from({ length: n }, make)

// Kick, snare and hat on a bar of 16ths: steps 0, 4, 8 and 12 are the four beats.
const ROCK: Beat = { chat: [0, 2, 4, 6, 8, 10, 12, 14], kick: [0, 8], snare: [4, 12] }
const FOUR_ON_THE_FLOOR: Beat = { chat: [2, 6, 10, 14], kick: [0, 4, 8, 12], snare: [4, 12] }

// Written for teenagers starting from zero: short paragraphs, everyday words,
// and every new term explained the first time it shows up.
export const LESSONS: Lesson[] = [
  {
    blocks: [
      {
        body: [
          'Every song you’ve ever bopped your head to has a beat: the steady pulse you tap your foot or nod along to. It’s the heartbeat of the track, and everything else lines up with it.',
          'How fast the beat goes is called the tempo, measured in BPM (beats per minute). A chill lo-fi track might sit around 75 BPM, a lot of hip hop around 90, house music around 124, and drum & bass races along at about 174.'
        ],
        heading: 'Feel the beat',
        kind: 'text'
      },
      {
        body: [
          'Beats come in groups called bars. Nearly every pop, hip hop and dance song has 4 beats in a bar, so you count “1, 2, 3, 4, 1, 2, 3, 4…” over and over.',
          'A drum machine chops each beat into 4 smaller steps, so one bar is a row of 16 steps. In the grid below, the numbers 1–4 along the top mark the beats, and “&” is halfway between two beats.'
        ],
        heading: 'Bars and steps',
        kind: 'text'
      },
      {
        body: [
          'Time to make your first beat! Tap the squares to turn drums on and off, and press Play to hear it loop. The kick is the deep “boom”, the snare is the sharp “crack” and the hi-hat is the tight “tss”.',
          'This one is the classic rock and pop beat: kick on beats 1 and 3, snare on beats 2 and 4, and the hi-hat on every “&” and every beat.'
        ],
        heading: 'Build a beat',
        kind: 'text'
      },
      {
        goal: 'Kick on beats 1 and 3, snare on beats 2 and 4, hi-hat on every other step (8 hits).',
        kind: 'rhythm',
        target: ROCK
      },
      {
        body: [
          'That snare on 2 and 4 has a name: the backbeat. Clap along to almost any song on your playlist and you’ll find yourself clapping on 2 and 4.',
          'Try the Tempo slider while it plays. The pattern stays the same, but slow it down and it feels laid-back; speed it up and it gets hyped.'
        ],
        heading: 'The backbeat',
        kind: 'text'
      },
      {
        body: [
          'Dance music (house, disco, a lot of EDM) puts the kick on every single beat. DJs call this “four on the floor”. Put the hi-hat on the “&”s in between and you get that “boom-tss, boom-tss” sound that makes people move.'
        ],
        heading: 'Four on the floor',
        kind: 'text'
      },
      {
        goal: 'Kick on all 4 beats, snare on beats 2 and 4, hi-hat only on the “&”s.',
        kind: 'rhythm',
        target: FOUR_ON_THE_FLOOR
      },
      {
        kind: 'quiz',
        questions: () => [
          {
            answer: '4',
            choices: ['2', '3', '4', '8'],
            explain: 'Almost all the music you hear has 4 beats in each bar: “1, 2, 3, 4”.',
            prompt: 'How many beats are in one bar of most pop and hip hop songs?'
          },
          {
            answer: '16',
            choices: ['4', '8', '12', '16'],
            explain: '4 beats, each split into 4 steps: 16 steps in a bar.',
            prompt: 'How many steps does a drum machine usually have in one bar?'
          },
          {
            answer: 'Beats per minute',
            choices: [
              'Bass per measure',
              'Beats per minute',
              'Bars per minute',
              'Bass power meter'
            ],
            explain: 'BPM counts how many beats go by in a minute. Higher means faster.',
            prompt: 'What does BPM stand for?'
          },
          {
            answer: '2 and 4',
            choices: ['1 and 3', '2 and 4', 'Every beat', 'Only beat 1'],
            explain:
              'The snare on 2 and 4 is the backbeat, in almost every pop, rock and hip hop song.',
            prompt: 'In a backbeat, which beats does the snare play on?'
          },
          {
            answer: 'Every beat',
            choices: ['1 and 3', '2 and 4', 'Every beat', 'Only beat 1'],
            explain: '“Four on the floor” means the kick hits on all four beats.',
            prompt: 'In a four-on-the-floor dance beat, where does the kick go?'
          }
        ]
      }
    ],
    part: 'basics',
    slug: 'rhythm',
    summary: 'What a beat is, what BPM means, and how to build your first drum patterns.',
    title: 'Beats and rhythm',
    tryIt:
      'Click Drums under Tracks and open the Steps tab. Program one of the beats you just made, then turn up Swing to make the hi-hats bounce.'
  },
  {
    blocks: [
      {
        body: [
          'Sing a really low note, then a really high one. That “how high or low” is called pitch. Sound is just air wiggling back and forth: the faster it wiggles, the higher the pitch.',
          'Here’s the wild part: almost all the music you know is made from just 12 different notes, used again and again higher and lower.'
        ],
        heading: 'What is a note?',
        kind: 'text'
      },
      {
        body: [
          'A piano keyboard shows those 12 notes really clearly. The white keys are named with the letters A to G. The black keys are “in between” notes. Each one borrows a neighbour’s name with a sharp (♯, meaning a bit higher) or a flat (♭, a bit lower). The black key just after C is C♯.',
          'Want to find your way around? Look at the black keys: they come in groups of 2 and 3. C is always the white key just to the left of a group of 2.',
          'Play around below. Notice how the notes get higher as you go right.'
        ],
        heading: 'Finding your way on the keyboard',
        kind: 'text'
      },
      { kind: 'keyboard' },
      {
        body: [
          'After B, the letters start again at C. That new C sounds like the first one, just higher. The jump from one C to the next is called an octave, and it covers all 12 notes.',
          'The little number after a note’s name tells you which octave it’s in. C4 is “middle C”, right in the middle of a piano; C5 is the next C up. Try playing C4 and C5 together: they blend almost like one note.'
        ],
        heading: 'Octaves',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [
          ...times(3, higherQuestion),
          {
            answer: '12',
            choices: ['7', '8', '12', '16'],
            explain: '7 white keys plus 5 black keys: 12 notes, then the pattern repeats.',
            prompt: 'How many different notes are there before the pattern repeats?'
          },
          {
            answer: 'Just left of a group of 2 black keys',
            choices: [
              'Just left of a group of 2 black keys',
              'Just left of a group of 3 black keys',
              'On a black key'
            ],
            explain: 'Find a pair of black keys: the white key just left of them is always C.',
            prompt: 'Where is C on a keyboard?'
          }
        ]
      }
    ],
    part: 'basics',
    slug: 'notes',
    summary: 'Pitch, the 12 notes, how to find them on a keyboard, and octaves.',
    title: 'Notes and the keyboard',
    tryIt:
      'Play the keyboard at the bottom of the workstation: click the keys, or use your computer keyboard. The octave buttons move it up and down.'
  },
  {
    blocks: [
      {
        body: [
          'The distance between two notes is called an interval. Think of it like the gap between two stairs.',
          'The smallest gap is a half step: from one key to the very next key, black or white. Two half steps make a whole step. So C to C♯ is a half step, and C to D is a whole step.',
          'One sneaky thing: E to F and B to C are half steps too, because there’s no black key between them.'
        ],
        heading: 'Half steps and whole steps',
        kind: 'text'
      },
      {
        body: [
          'Bigger intervals get names from counting letters. C up to E is a “3rd” (C, D, E: three letters). C up to G is a “5th”. Each one has its own vibe: the 5th sounds strong and powerful, the major 3rd sounds happy, the tritone sounds creepy.',
          'Below, press a key to pick a starting note, then try each interval button to hear it.'
        ],
        heading: 'Naming intervals',
        kind: 'text'
      },
      { kind: 'intervals' },
      {
        body: [
          'A trick musicians use is to link each interval to a tune you know. A perfect 5th is the first two notes of the Star Wars theme (and of “Twinkle Twinkle Little Star”). An octave is the first two notes of “Somewhere Over the Rainbow”. The creepy tritone is all over horror movie soundtracks.',
          'Fun fact: the “power chords” in rock and metal are just a note plus the 5th above it.'
        ],
        heading: 'Hearing intervals',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [...times(3, stepAboveQuestion), ...times(4, () => intervalQuestion())]
      }
    ],
    part: 'basics',
    slug: 'intervals',
    summary: 'Half steps, whole steps, and what different gaps between notes sound like.',
    title: 'Steps and intervals',
    tryIt:
      'In the keyboard bar at the bottom of the workstation, set Chord to Power (5th). Now every key plays a note plus its 5th: instant rock riffs.'
  },
  {
    blocks: [
      {
        body: [
          'A scale is a set of notes that sound good together, played in order like a ladder. Most songs stick to the notes of one scale, which is why the melody, the bass and the chords all fit.',
          'The first note of the scale is called the root. It feels like “home”: songs often end on it because it sounds finished.'
        ],
        heading: 'What is a scale?',
        kind: 'text'
      },
      {
        body: [
          'Scales are built from a pattern of half and whole steps. The major scale goes: whole, whole, half, whole, whole, whole, half. Start on C and that gives you all the white keys, no black ones.',
          'Change the pattern and you change the mood. The major scale sounds bright and happy. The minor scale sounds darker and more emotional, and loads of trap, pop and film music uses it. The pentatonic scale only has 5 notes, and it’s really hard to play a wrong note with it, so it’s great for making up melodies.',
          'Pick a root and a scale below. Its notes light up: play them on the keys or press Play scale.'
        ],
        heading: 'Major, minor and more',
        kind: 'text'
      },
      { kind: 'scales' },
      {
        body: [
          'When people say a song is “in the key of A minor”, they mean it mostly uses the A minor scale. Once you know the key, you know which notes will sound right for a melody or a bass line.'
        ],
        heading: 'Keys',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [...times(4, scaleQuestion), ...times(3, inKeyQuestion)]
      }
    ],
    part: 'basics',
    slug: 'scales',
    summary:
      'How scales are built, why major sounds happy and minor sounds dark, and what a key is.',
    title: 'Scales and keys',
    tryIt:
      'Open a loop pad’s piano roll and draw a melody using only the notes of one scale. Then make a bass line from the same notes.'
  },
  {
    blocks: [
      {
        body: [
          'A chord is three or more notes played at the same time. The most common kind uses three notes: the root, the note a 3rd above it and the note a 5th above it. Musicians call that a triad.',
          'The middle note decides the mood. If it’s 4 half steps above the root, you get a major chord, which sounds happy and bright. If it’s only 3 half steps up, you get a minor chord, which sounds sad or moody. Just one half step changes the whole feeling!',
          'Try both on any root below and listen for the difference.'
        ],
        heading: 'Building a chord',
        kind: 'text'
      },
      { kind: 'chords' },
      {
        body: [
          'If you build a chord on every note of a scale, using only notes from that scale, you get the chords that belong to that key. Musicians number them with Roman numerals: capital letters for major chords, small letters for minor.',
          'Here’s a secret: a huge number of hit songs use just four of these chords, I, V, vi and IV. In C that’s C, G, Am and F. Tap them in that order in the chord buttons above. Sound familiar? Now try other orders and see what moods you can make.'
        ],
        heading: 'The chords in a key',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [...times(4, chordQuestion), ...times(3, spellChordQuestion)]
      }
    ],
    part: 'basics',
    slug: 'chords',
    summary: 'How chords are built, major vs minor, and the four chords behind tons of hit songs.',
    title: 'Chords',
    tryIt:
      'In the keyboard bar, set Chord to Major or Minor so each key plays a whole chord. Record a loop of C, G, Am and F, and you’ve got the start of a song.'
  },
  {
    blocks: [
      {
        body: [
          'Play the same note on a piano and on a guitar and you can still tell which is which. That difference is called timbre (you say it “TAM-ber”): the colour or texture of a sound.',
          'Synthesizers make their sounds from simple shapes called waveforms. A sine wave is smooth and soft, like a whistle. A triangle is a little brighter. A square sounds hollow and buzzy, like old video game music. A sawtooth is the brightest and buzziest, the starting point for a lot of EDM leads and basses.'
        ],
        heading: 'What makes sounds different?',
        kind: 'text'
      },
      {
        body: [
          'A filter changes how bright a sound is. Turn the Cutoff down and the sound gets darker and more muffled, like music from a party next door. Turn it up and it gets bright and clear again. Sweeping it is the classic EDM build-up trick.',
          'Attack is how long a note takes to fade in, and Release is how long it rings after you let go. A short attack sounds plucky and punchy; a long one swells in slowly, like a dreamy pad.',
          'Try every wave, then play with the sliders while you hold down a key.'
        ],
        heading: 'Shaping a sound',
        kind: 'text'
      },
      { kind: 'sound' },
      {
        kind: 'quiz',
        questions: () => [
          {
            answer: 'Sine',
            choices: ['Sawtooth', 'Sine', 'Square'],
            explain: 'A sine wave is the purest, smoothest sound there is.',
            prompt: 'Which waveform sounds the smoothest and softest?'
          },
          {
            answer: 'The second',
            choices: ['The first', 'The second'],
            explain:
              'The second one had its cutoff turned way down, so it sounded darker and muffled.',
            play: [[45], [45]],
            prompt: 'You’ll hear the same note twice. Which one has the filter turned down?',
            sounds: [BRIGHT, { ...BRIGHT, filter_cutoff: 400 }]
          },
          {
            answer: 'A long attack',
            choices: ['A long attack', 'A short release', 'A high cutoff'],
            explain: 'Attack is how long a note takes to fade in, so a long one makes it swell.',
            prompt: 'What makes a sound fade in slowly?'
          },
          {
            answer: 'Turn the cutoff down',
            choices: ['Turn the cutoff up', 'Turn the cutoff down', 'Make the release shorter'],
            explain: 'Turning the cutoff down filters out the high, bright part of the sound.',
            prompt: 'Your bass sounds way too bright and harsh. What should you do?'
          }
        ]
      }
    ],
    part: 'basics',
    slug: 'sound',
    summary: 'Waveforms, filters and envelopes: why some sounds are bright, dark, short or long.',
    title: 'Sound and timbre',
    tryIt:
      'Open the synth’s Osc, Filter and Amp tabs and try the same controls. Or press Browse presets… to hear what a fully designed sound can do.'
  },
  {
    blocks: [
      {
        body: [
          'Beatbox’s keyboard bar (at the bottom of the workstation) has two buttons that make you sound way more skilled than you are: Chord and Arp.',
          'Chord turns every key into a whole chord. Press one key and Beatbox adds the other notes for you. Major sounds happy, Minor sounds moody, 7th sounds bluesy and jazzy, Sus2 and Sus4 sound open and floaty (like they’re waiting for something), and Power is the chunky rock-guitar sound.'
        ],
        heading: 'One finger, whole chords',
        kind: 'text'
      },
      {
        body: [
          'Arp is short for arpeggiator. Instead of playing a chord’s notes all at once, it plays them one at a time, in a pattern, locked to the tempo. Up climbs the notes, Down falls, Up-Down bounces, and Random keeps surprising you.',
          'Rate sets how fast it goes: 1/4 plays one note per beat, 1/8 two, 1/16 four. The “T” rates (like 1/8T) are triplets: three notes per beat, for a rolling, galloping feel.',
          'Try it below: pick a chord and an arp, press Play, then change things while it runs. Press the C – G – Am – F button to let it move through a chord progression by itself.'
        ],
        heading: 'Arpeggios',
        kind: 'text'
      },
      { kind: 'arp' },
      {
        body: [
          'Chord + Arp together turns one finger into a full synth part. That’s the sound of a lot of trance, synthwave and video game music.',
          'Fast rates sound great at slow tempos, but at a fast tempo 1/16 can turn into a blur. Try 1/8 there instead.',
          'Arps love a little echo. In the next lesson you’ll find out how to add it.',
          'When you record a loop with Chord or Arp on, Beatbox keeps the notes that played, so you can edit them in the piano roll afterwards.'
        ],
        heading: 'Getting the most out of it',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [
          ...times(3, arpQuestion),
          {
            answer: 'Plays the notes one at a time',
            choices: ['Plays the notes one at a time', 'Makes every note louder', 'Adds an echo'],
            explain:
              'An arpeggiator takes the notes you hold and plays them one after another, in time.',
            prompt: 'What does the Arp do?'
          },
          {
            answer: '1/16',
            choices: ['1/4', '1/8', '1/16'],
            explain: '1/16 plays four notes every beat, 1/8 two and 1/4 just one.',
            prompt: 'Which Arp rate is the fastest?'
          },
          {
            answer: 'Power',
            choices: ['Major', 'Sus4', 'Power'],
            explain:
              'Power (5th) plays a note with the 5th and octave above it: the classic rock guitar chord.',
            prompt: 'Which Chord setting gives you a chunky rock-guitar sound?'
          }
        ]
      }
    ],
    part: 'making',
    slug: 'chord-and-arp',
    summary:
      'Play whole chords with one finger and turn them into arpeggios that move with the beat.',
    title: 'Chord and Arp',
    tryIt:
      'In the keyboard bar, set Chord to Minor and Arp to Up at 1/16, then hold a key. Record it into a loop pad and change the synth sound to Pluck or Glass Pluck.'
  },
  {
    blocks: [
      {
        body: [
          'Effects change a sound after it’s made, a bit like filters on a photo. A plain synth can sound like it’s in a cathedral, an echoing canyon or an old game console, just by adding effects.',
          'Each synth sound has its own effects on the FX tab, and the whole song shares some more in Song settings.'
        ],
        heading: 'What are effects?',
        kind: 'text'
      },
      {
        body: [
          'Reverb makes a sound feel like it’s in a room. A little sounds natural, and a lot sounds huge and far away. Room size sets how big the space is.',
          'Echo (also called delay) repeats the sound, in time with the beat. Echo repeats sets how many times it comes back.',
          'Chorus plays slightly wobbly copies of the sound to make it wider and shimmery.',
          'Drive pushes the sound until it distorts, for grit and attitude, like a guitar amp turned up.',
          'Bitcrusher makes the sound crunchy and lo-fi, like an old video game.',
          'Press Play, then try the starting points and move the sliders while it loops. The drums stay dry so you can compare.'
        ],
        heading: 'The main effects',
        kind: 'text'
      },
      { kind: 'fx' },
      {
        body: [
          'Less is more. Turn an effect up until you can clearly hear it, then back it off a little. If everything has lots of reverb, the whole song turns to mush.',
          'Keep the bass and kick dry, with little or no reverb, so they stay punchy. Reverb and echo sound best on leads, pads, snares and vocals.',
          'Leave space for echoes. A melody with gaps lets the repeats fill them in, which sounds amazing. A busy melody plus echo gets messy.',
          'Use effects to make things different. A dry, close verse makes a big reverb-y chorus feel even bigger.',
          'For one shared reverb that makes everything sound like it’s in the same room, use the sends in Song settings.'
        ],
        heading: 'How to use them well',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [
          effectQuestion('reverb', { fx_reverb_mix: 0.7, fx_reverb_size: 4 }, PLAIN),
          effectQuestion(
            'echo',
            { fx_delay_feedback: 0.5, fx_delay_mix: 0.6, fx_delay_time: '1/8' },
            PLAIN
          ),
          {
            answer: 'The bass',
            choices: ['The bass', 'A pad', 'A lead melody'],
            explain: 'Reverb on the bass makes the low end muddy. Keep it dry and punchy.',
            prompt: 'Which part should usually get the least reverb?'
          },
          {
            answer: 'Repeats the sound in time',
            choices: ['Repeats the sound in time', 'Makes it crunchy', 'Makes it quieter'],
            explain: 'Echo (delay) plays the sound again, and again, locked to the beat.',
            prompt: 'What does echo (delay) do?'
          },
          {
            answer: 'Bitcrusher',
            choices: ['Chorus', 'Reverb', 'Bitcrusher'],
            explain:
              'The bitcrusher squashes the sound down to fewer levels, like old game consoles did.',
            prompt: 'Which effect makes a sound like an old video game?'
          }
        ]
      }
    ],
    part: 'making',
    slug: 'effects',
    summary:
      'Reverb, echo, chorus, drive and bitcrusher: what each one does, and how not to overdo it.',
    title: 'Effects',
    tryIt:
      'Open the synth’s FX tab and add a little echo and reverb to your lead. Then open Song settings and turn up the reverb send on the drums just a touch.'
  },
  {
    blocks: [
      {
        body: [
          'The melody is the part you hum after the song ends. The good news: you don’t need years of lessons to write one. A few simple tricks go a long way.',
          'Use the notes of one scale. The grid below only has notes from the C major pentatonic scale, the “no wrong notes” scale from the Scales lesson, so anything you draw will fit.'
        ],
        heading: 'Writing a melody',
        kind: 'text'
      },
      {
        body: [
          'Repeat yourself. A hook is a short idea (just a few notes) that comes back again and again. Repeat it, then change the ending the second time.',
          'Leave gaps. Rests (silence) give a melody room to breathe, and they make the notes you do play hit harder.',
          'Mostly take small steps. Moving to the next note up or down sounds smooth and singable. Save the big jumps for special moments.',
          'Rhythm matters as much as the notes. Try the same notes with a different rhythm and it becomes a whole new tune.',
          'End on home. Finishing on C (the amber rows) makes a melody sound complete. Ending anywhere else makes it sound like a question.',
          'Draw a melody below and press Play. Stuck? Try Example, or Surprise me for a random idea you can tweak.'
        ],
        heading: 'Tricks that always work',
        kind: 'text'
      },
      { kind: 'melody' },
      {
        body: [
          'The bass connects the drums to the chords. The simplest bass line that works is just the root note of each chord (the note the chord is named after), played low.',
          'Play bass notes at the same moment as the kick drum and they lock together into one big, punchy groove. That’s what the backing bass here does. Switch it off and on to hear the difference.',
          'Keep it simple and low. The bass is felt as much as heard, and a busy bass line fights with the melody.'
        ],
        heading: 'Bass lines',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [
          ...times(3, endingQuestion),
          {
            answer: 'A short idea that keeps coming back',
            choices: [
              'A short idea that keeps coming back',
              'The loudest drum',
              'The last note of a song'
            ],
            explain: 'A hook is a short, catchy idea repeated so it sticks in your head.',
            prompt: 'What is a hook?'
          },
          {
            answer: 'The root of each chord, with the kick',
            choices: [
              'The root of each chord, with the kick',
              'Random high notes',
              'The same notes as the melody'
            ],
            explain: 'Root notes locked to the kick make a solid, simple bass line.',
            prompt: 'What’s an easy bass line that always works?'
          },
          {
            answer: 'Rests (silence)',
            choices: ['Rests (silence)', 'More notes', 'Bigger jumps'],
            explain: 'Gaps give a melody room to breathe and make the notes you play stand out.',
            prompt: 'What makes a melody easier to remember?'
          }
        ]
      }
    ],
    part: 'making',
    slug: 'melody',
    summary: 'Simple tricks for catchy melodies, and bass lines that lock in with the drums.',
    title: 'Melodies and bass lines',
    tryIt:
      'Open an empty loop pad’s piano roll and draw a 2-bar hook using only the notes of one scale. Then put a bass line on a second pad using the root of each chord.'
  },
  {
    blocks: [
      {
        body: [
          'A loop that sounds good is a great start, but a song needs to go somewhere. Most songs are built from a few sections, each with its own job:',
          'Intro: eases you in, usually with just a few parts. Verse: tells the story and builds up. Chorus (called the drop in EDM): the big, catchy moment everyone waits for. Breakdown or bridge: strips things back for a breather or a twist. Outro: winds it down.',
          'A really common shape is: intro, verse, chorus, verse, chorus, breakdown, chorus, outro.'
        ],
        heading: 'The parts of a song',
        kind: 'text'
      },
      {
        body: [
          'The secret to a song that keeps people listening is energy that rises and falls. If everything plays all the time, nothing feels big, because there’s nothing to compare it to.',
          'The easiest way to control energy is layering: adding and removing parts. Start with a few, add more as you build to the chorus, pull them out in the breakdown, then bring everything back for the final chorus.',
          'Try it: switch parts on and off in each section, watch the energy bars, and press Play my song. Then press Check my song for tips.'
        ],
        heading: 'Energy: build it up, drop it down',
        kind: 'text'
      },
      { kind: 'sketch' },
      {
        body: [
          'Think in blocks of 8 bars. Most sections are 4, 8 or 16 bars long, which is why songs feel so predictable (in a good way).',
          'Change something every 8 bars, even a small thing: a new drum pattern, a part dropping out, a filter opening up. Ears get bored of exact repeats.',
          'Hook them fast. Get to something catchy within the first 20 seconds or so.',
          'Steal like an artist. Pick a song you love, listen to how it’s built, which parts come in when, and copy the shape (not the notes) in your own song.',
          'Finish songs! A finished song that’s just okay teaches you more than ten perfect loops. You can always make the next one better.'
        ],
        heading: 'Tips from producers',
        kind: 'text'
      },
      {
        kind: 'quiz',
        questions: () => [
          {
            answer: 'The chorus',
            choices: ['The intro', 'The verse', 'The chorus'],
            explain: 'The chorus (or drop) is the big, catchy peak of the song.',
            prompt: 'Which section usually has the most energy?'
          },
          {
            answer: 'Fewer parts',
            choices: ['Fewer parts', 'More parts', 'Exactly the same parts'],
            explain: 'A breakdown pulls parts out, so the music has somewhere to build back up to.',
            prompt: 'Compared with the chorus, a breakdown usually has…'
          },
          {
            answer: 'Nothing feels big',
            choices: ['Nothing feels big', 'It sounds more exciting', 'It gets quieter'],
            explain: 'Big moments only feel big next to quieter ones. Contrast is everything.',
            prompt: 'What happens if every part plays all the way through?'
          },
          {
            answer: '8 bars',
            choices: ['3 bars', '8 bars', '13 bars'],
            explain: 'Sections are usually 4, 8 or 16 bars long. 8 is the most common.',
            prompt: 'What’s a very common length for a song section?'
          },
          {
            answer: 'Add or remove parts',
            choices: ['Add or remove parts', 'Change the key every bar', 'Turn the tempo up'],
            explain:
              'Layering (adding and removing parts) is the simplest way to build energy and drop it.',
            prompt: 'What’s the easiest way to change a song’s energy?'
          }
        ]
      }
    ],
    part: 'making',
    slug: 'song',
    summary:
      'Intro, verse, chorus and more: how to build energy and turn a loop into a whole song.',
    title: 'Making a song',
    tryIt:
      'Press + Section next to Tracks to add sections, name them (Intro, Verse, Chorus…), and switch on which loop pads and drum pattern play in each: start small, add more for the chorus, take some out for a breakdown. Then press Play song.'
  }
]

export const getLesson = (slug: string): Lesson | undefined => LESSONS.find((l) => l.slug === slug)
