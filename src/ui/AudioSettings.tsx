/** Optional score controls remain separate from narrative waveform/transmission text. */
import { music, useMusic } from '../app/musicSession';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

export default function AudioSettings() {
  const audio = useMusic();
  const available = useGame((game) => game.currentPhase === 0 && game.ending === null);
  const status = !audio.enabled ? 'Music is off.' : !available ? 'No music track is available here yet.'
    : audio.playing ? (audio.volume === 0 ? 'Playing, muted at 0%.' : 'Playing Awareness Loop.')
    : !audio.activated ? 'Music is paused. Resume to start listening.' : 'Music is loading or paused.';
  return <View testID="menu-audio-page" style={{ gap: 14 }}>
    <Text style={theme.text}>Optional instrumental score. No spoken transmissions. Music starts only when you enable or resume it.</Text>
    <Pressable testID="music-toggle" accessibilityRole="switch" accessibilityLabel="Music enabled"
      aria-checked={audio.enabled} accessibilityState={{ checked: audio.enabled, disabled: !audio.loaded }} disabled={!audio.loaded}
      style={theme.button} onPress={() => { music.toggle(); }}><Text style={theme.text}>[ MUSIC {audio.enabled ? 'ON' : 'OFF'} ]</Text></Pressable>
    <Text testID="music-status" accessibilityLiveRegion="polite" style={theme.text}>{status}</Text>
    {audio.enabled && available && !audio.playing && <Pressable testID="music-resume" accessibilityRole="button"
      accessibilityLabel="Resume music" style={theme.button} onPress={() => { music.resume(); }}><Text style={theme.text}>[ RESUME MUSIC ]</Text></Pressable>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Pressable testID="music-quieter" accessibilityRole="button" accessibilityLabel="Lower music volume by 10 percent"
        disabled={!audio.loaded || audio.volume === 0} accessibilityState={{ disabled: !audio.loaded || audio.volume === 0 }}
        style={theme.button} onPress={() => { music.setVolume(audio.volume - 10); }}><Text style={theme.text}>[ − ]</Text></Pressable>
      <Text testID="music-volume" accessibilityLabel={'Music volume ' + String(audio.volume) + ' percent'} style={theme.text}>Volume {audio.volume}%</Text>
      <Pressable testID="music-louder" accessibilityRole="button" accessibilityLabel="Raise music volume by 10 percent"
        disabled={!audio.loaded || audio.volume === 100} accessibilityState={{ disabled: !audio.loaded || audio.volume === 100 }}
        style={theme.button} onPress={() => { music.setVolume(audio.volume + 10); }}><Text style={theme.text}>[ + ]</Text></Pressable>
    </View>
    {audio.status !== '' && <Text testID="music-error" accessibilityRole="alert" style={theme.text}>{audio.status}</Text>}
    {audio.storageNotice !== '' && <Text testID="music-storage-notice" accessibilityRole="alert" style={theme.text}>{audio.storageNotice}</Text>}
    <Text style={theme.muted}>Only the opening phase has a track. Device mute and volume still apply. Backgrounding pauses music; saved preferences remain separate from game saves.</Text>
  </View>;
}
