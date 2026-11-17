/**
 * Whether a status report says the player has really been paused, as opposed to merely not
 * producing sound yet. The answer is platform-specific, so it lives in one place.
 */
import { Platform } from 'react-native';

/**
 * Android only. There expo-audio keeps `playing` true through buffering and drops it only
 * when the player is paused, and there every player has a media session that a headset key
 * can pause behind the app's back. On the web `playing` is also false at position zero and
 * whenever the element has not buffered enough, which happens at every start, every loop and
 * every network stall, and nothing can pause the element without going through the app's own
 * session handlers. iOS publishes no session to be paused through, and is unverified.
 */
export function heldBy(status: { playing: boolean }, os: string = Platform.OS): boolean {
  return os === 'android' && !status.playing;
}
