/**
 * Decodes committed audio files with ffmpeg for the offline asset checks. ffmpeg is a tool on
 * the machine, not a dependency of the package: `hasFfmpeg()` lets a spec skip, loudly, where it
 * is missing (docs/TESTING.md, "Audio signal measurement").
 */
import { execFileSync, spawnSync } from 'node:child_process';

export interface Probe { codec: string; sampleRate: number; channels: number; seconds: number }
export interface Decoded {
  sampleRate: number; channels: Float32Array[];
  /** Whatever the decoder complained about; a clean file leaves it empty. */
  warnings: string;
  /** Integrated loudness in LUFS, by ffmpeg's EBU R128 meter, to its one decimal place. */
  lufs: number;
}

const MAX_BUFFER = 256 * 1024 * 1024;

export function hasFfmpeg(): boolean {
  return ['ffmpeg', 'ffprobe'].every((tool) => spawnSync(tool, ['-version'], { stdio: 'ignore' }).status === 0);
}

/** The first audio stream's format, as ffprobe reads it from the container. */
export function probe(file: string): Probe {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const parsed = JSON.parse(out) as { streams: { codec_name: string; sample_rate: string; channels: number }[]; format: { duration: string } };
  const stream = parsed.streams[0];
  if (!stream) throw new Error('No audio stream in ' + file);
  return { codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: stream.channels, seconds: Number(parsed.format.duration) };
}

/**
 * Every sample of the file as 32-bit floats at its own rate, one array per channel, with the
 * file's loudness from the same pass. Floats, so a decoder overshoot above full scale is seen
 * rather than clamped. The meter passes samples through untouched.
 */
export function decode(file: string, format: Probe = probe(file)): Decoded {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-loglevel', 'level+info', '-i', file, '-map', 'a:0',
    '-af', 'ebur128=framelog=verbose', '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', String(format.sampleRate), '-'], { maxBuffer: MAX_BUFFER });
  const log = run.stderr.toString();
  if (run.status !== 0) throw new Error('ffmpeg could not decode ' + file + ': ' + log);
  const integrated = /I:\s+(-?[\d.]+) LUFS/.exec(log);
  if (!integrated?.[1]) throw new Error('ffmpeg reported no loudness for ' + file);
  const all = new Float32Array(run.stdout.buffer, run.stdout.byteOffset, Math.floor(run.stdout.byteLength / 4));
  const frames = Math.floor(all.length / format.channels);
  const split = Array.from({ length: format.channels }, (_, channel) => {
    const out = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) out[frame] = all[frame * format.channels + channel] ?? 0;
    return out;
  });
  const warnings = log.split('\n').filter((line) => /^\[[^\]]*\] \[(warning|error|fatal)\]|^\[(warning|error|fatal)\]/.test(line)).join('\n');
  return { sampleRate: format.sampleRate, channels: split, warnings, lufs: Number(integrated[1]) };
}
