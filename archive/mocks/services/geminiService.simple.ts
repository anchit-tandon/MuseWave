// Frontend-safe geminiService - returns mock data in browser
// Real Gemini API calls should happen on backend only

import type { MusicPlan, VideoStyle } from '../../lib/types';

// Simple mock responses for browser usage
export const enhancePrompt = async (context: any) => {
    // In browser: return creative mock data
    const prompts = [
        'A hypnotic journey through digital consciousness with glitching 808s and celestial pads',
        'Cinematic techno odyssey blending orchestral strings with industrial percussion',
        'Ethereal downtempo exploration featuring kalimbas over deep sub-bass',
        'High-energy drum & bass fusion where liquid melodies dance over breakneck breaks'
    ];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    if (context.prompt && context.prompt.trim()) {
        return { prompt: `${context.prompt}, with cascading arpeggios and atmospheric textures perfect for late-night drives` };
    }
    
    return { prompt: randomPrompt };
};

export const suggestGenres = async (context: any) => {
    const allGenres = ['techno', 'house', 'ambient', 'drum & bass', 'dubstep', 'trance', 'trap', 'future bass'];
    const shuffled = allGenres.sort(() => 0.5 - Math.random());
    return { genres: shuffled.slice(0, 3) };
};

export const suggestArtists = async (context: any) => {
    const artists = ['Fred again..', 'Anyma', 'Bicep', 'Peggy Gou', 'Four Tet', 'Skrillex', 'Amelie Lens'];
    const shuffled = artists.sort(() => 0.5 - Math.random());
    return { artists: shuffled.slice(0, 3) };
};

export const suggestLanguages = async (context: any) => {
    return { languages: ['English', 'Spanish', 'French'] };
};

export const suggestInstruments = async (context: any) => {
    return { instruments: ['Analog Synths', 'Drum Machines', 'Sampler', 'FM Synthesis'] };
};

export const enhanceLyrics = async (context: any) => {
    const lyrics = `Verse 1:
${context.prompt || 'Dancing through the digital night'}
Echoes in the fading light

Chorus:
We are the sound, we are the beat
Moving together, feel the heat

Bridge:
In this moment, we are free
Lost in the music, you and me`;
    
    return { lyrics };
};

export async function generateMusicPlan(fullPrompt: any, creativitySeed: number): Promise<MusicPlan> {
    // Return mock plan for browser
    const mockPlan: MusicPlan = {
        title: fullPrompt.musicPrompt?.substring(0, 30) || 'Generated Track',
        genre: fullPrompt.genres[0] || 'electronic',
        bpm: 120 + Math.floor(Math.random() * 20),
        key: ['C', 'D', 'E', 'F', 'G', 'A'][Math.floor(Math.random() * 6)] + [' Major', ' Minor'][Math.floor(Math.random() * 2)],
        overallStructure: 'Intro - Verse - Chorus - Breakdown - Drop - Outro',
        vocalStyle: 'Ethereal lead with electronic harmonies',
        lyrics: fullPrompt.lyrics || '',
        randomSeed: creativitySeed,
        sections: [
            {
                name: 'Intro',
                sectionType: 'intro',
                durationBars: 8,
                chordProgression: ['Cm7', 'Abmaj7'],
                drumPattern: { kick: [1], snare: [], hihat: [0.5, 1, 1.5] },
                synthLine: { pattern: 'pads', timbre: 'warm' },
                leadMelody: [],
                effects: { reverb: 0.4, compressionThreshold: -12, stereoWidth: 0.6 },
                lyrics: null
            },
            {
                name: 'Verse',
                sectionType: 'verse',
                durationBars: 16,
                chordProgression: ['Cm7', 'Abmaj7', 'Fm7', 'Bb7'],
                drumPattern: { kick: [1, 1.5], snare: [2], hihat: [0.5, 1, 1.5, 2] },
                synthLine: { pattern: 'arpeggio-up', timbre: 'glassy' },
                leadMelody: [
                    { note: 'C5', duration: 0.5, ornamentation: 'light' },
                    { note: 'D5', duration: 0.5, ornamentation: 'light' }
                ],
                effects: { reverb: 0.5, compressionThreshold: -10, stereoWidth: 0.85 },
                lyrics: fullPrompt.lyrics || null
            },
            {
                name: 'Chorus',
                sectionType: 'chorus',
                durationBars: 16,
                chordProgression: ['Abmaj7', 'Fm7', 'Cm7', 'Bb7'],
                drumPattern: { kick: [1, 1.5], snare: [2], hihat: [0.5, 1, 1.5, 2] },
                synthLine: { pattern: 'arpeggio-up', timbre: 'bright' },
                leadMelody: [
                    { note: 'C5', duration: 0.5, ornamentation: 'heavy' },
                    { note: 'G5', duration: 0.5, ornamentation: 'heavy' }
                ],
                effects: { reverb: 0.6, compressionThreshold: -10, stereoWidth: 0.9 },
                lyrics: fullPrompt.lyrics || null
            },
            {
                name: 'Outro',
                sectionType: 'outro',
                durationBars: 8,
                chordProgression: ['Cm7', 'Abmaj7'],
                drumPattern: { kick: [1], snare: [], hihat: [0.5, 1] },
                synthLine: { pattern: 'pads', timbre: 'warm' },
                leadMelody: [],
                effects: { reverb: 0.7, compressionThreshold: -8, stereoWidth: 0.95 },
                lyrics: null
            }
        ],
        stems: { vocals: !!fullPrompt.lyrics, drums: true, bass: true, instruments: true },
        cuePoints: { introEnd: 32, dropStart: 64, outroStart: 96 }
    } as unknown as MusicPlan;
    
    return mockPlan;
}

export async function auditMusicPlan(plan: MusicPlan, originalRequest: any) {
    return {
        lyricsSung: true,
        isUnique: true,
        styleFaithful: true,
        djStructure: true,
        masteringApplied: true,
        passed: true,
        feedback: 'Plan looks good!'
    };
}

export async function generateCreativeAssets(musicPlan: MusicPlan, videoStyles: VideoStyle[], lyrics: string) {
    return {
        lyricsAlignment: lyrics ? [
            { time: '0s-20s', line: lyrics.split('\n')[0] || lyrics },
            { time: '20s-40s', line: lyrics.split('\n')[1] || '' }
        ] : [],
        videoStoryboard: Object.fromEntries(
            videoStyles.map(style => [style, `${style} visuals for ${musicPlan.title}`])
        )
    };
}
