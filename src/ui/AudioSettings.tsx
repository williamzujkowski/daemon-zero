/** Score and spoken-transmission preferences, kept apart from the narrative text they affect. */
import { music, useMusic } from '../app/musicSession';
import { Pressable, Text, View } from './PhaseTheme';
import { theme } from './theme';

const STEP = 10;

/** One switch. Its accessible name starts with the visible text (#111), then says what it gates. */
function Toggle({ id, word, gates, on, loaded, onPress }: { id: string; word: string; gates: string; on: boolean; loaded: boolean; onPress: () => void }) {
  const visible = '[ ' + word + ' ' + (on ? 'ON' : 'OFF') + ' ]';
  return <Pressable testID={id + '-toggle'} accessibilityRole="switch" accessibilityLabel={visible + ' ' + gates}
    aria-checked={on} accessibilityState={{ checked: on, disabled: !loaded }} disabled={!loaded}
    style={theme.button} onPress={onPress}><Text style={theme.text}>{visible}</Text></Pressable>;
}

/** One level row. Both rows share the step, so the two levels can be matched by counting presses. */
function Level({ id, name, value, loaded, onChange }: { id: string; name: string; value: number; loaded: boolean; onChange: (next: number) => void }) {
  const low = !loaded || value === 0, high = !loaded || value === 100;
  const change = ' ' + name.toLowerCase() + ' volume by ' + String(STEP) + ' percent';
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
    <Pressable testID={id + '-quieter'} accessibilityRole="button" accessibilityLabel={'[ − ] Lower' + change}
      disabled={low} accessibilityState={{ disabled: low }}
      style={theme.button} onPress={() => { onChange(value - STEP); }}><Text style={theme.text}>[ − ]</Text></Pressable>
    <Text testID={id + '-volume'} accessibilityLabel={name + ' volume ' + String(value) + ' percent'} style={theme.text}>{name} volume {value}%</Text>
    <Pressable testID={id + '-louder'} accessibilityRole="button" accessibilityLabel={'[ + ] Raise' + change}
      disabled={high} accessibilityState={{ disabled: high }}
      style={theme.button} onPress={() => { onChange(value + STEP); }}><Text style={theme.text}>[ + ]</Text></Pressable>
  </View>;
}

export default function AudioSettings() {
  // Subscribed here, on a page that exists only while MENU > Audio is open, so a level change
  // re-renders this page and never the terminal behind it.
  const audio = useMusic();
  const available = audio.trackPhase !== null;
  const status = !audio.enabled ? 'Music is off.' : !available ? 'Music is stopped for this run.'
    : audio.playing ? (audio.volume === 0 ? 'Playing, muted at 0%.' : 'Playing phase ' + String(audio.trackPhase) + ' score.')
    : !audio.activated ? 'Music is paused. Resume to start listening.' : 'Music is loading or paused.';
  const speech = !audio.speechEnabled ? 'Speech is off. READ is hidden.'
    : audio.speechVolume === 0 ? 'READ is offered, muted at 0%.' : 'READ is offered on transmissions that have a recording.';
  return <View testID="menu-audio-page" style={{ gap: 14 }}>
    <Text style={theme.text}>Optional instrumental score. Music starts only when you enable or resume it.</Text>
    <Toggle id="music" word="MUSIC" gates="Instrumental score only" on={audio.enabled} loaded={audio.loaded} onPress={() => { music.toggle(); }} />
    <Text testID="music-status" accessibilityLiveRegion="polite" style={theme.text}>{status}</Text>
    {audio.enabled && available && !audio.playing && <Pressable testID="music-resume" accessibilityRole="button"
      accessibilityLabel="[ RESUME MUSIC ] Resume music" style={theme.button} onPress={() => { music.resume(); }}><Text style={theme.text}>[ RESUME MUSIC ]</Text></Pressable>}
    <Level id="music" name="Music" value={audio.volume} loaded={audio.loaded} onChange={(next) => { music.setVolume(next); }} />
    <Text style={theme.text}>Spoken transmissions. Nothing is read aloud until you press READ; the score quiets while one plays.</Text>
    <Toggle id="speech" word="SPEECH" gates="Spoken transmissions only" on={audio.speechEnabled} loaded={audio.loaded} onPress={() => { music.toggleSpeech(); }} />
    <Text testID="speech-status" accessibilityLiveRegion="polite" style={theme.text}>{speech}</Text>
    <Level id="speech" name="Speech" value={audio.speechVolume} loaded={audio.loaded} onChange={(next) => { music.setSpeechVolume(next); }} />
    {audio.status !== '' && <Text testID="music-error" accessibilityRole="alert" style={theme.text}>{audio.status}</Text>}
    {audio.storageNotice !== '' && <Text testID="music-storage-notice" accessibilityRole="alert" style={theme.text}>{audio.storageNotice}</Text>}
    <Text style={theme.muted}>The score follows the current phase. Device mute and volume still apply. Backgrounding pauses music; saved preferences remain separate from game saves.</Text>
  </View>;
}
