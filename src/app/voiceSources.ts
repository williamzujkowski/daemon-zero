/**
 * One literal import per clip so Metro packages every file; the name is derived from the
 * clip id and this table is checked against assets/audio/voice/MANIFEST.json by a test, so a
 * regenerated clip set cannot silently drop a voice. Only the vibration tier is wired: the
 * clean tier exists for the acoustic upgrade, which is not built yet.
 */
import Ambient01 from '../../assets/audio/voice/vibration/ambient_01.mp3';
import Ambient02 from '../../assets/audio/voice/vibration/ambient_02.mp3';
import Ambient03 from '../../assets/audio/voice/vibration/ambient_03.mp3';
import Ambient04 from '../../assets/audio/voice/vibration/ambient_04.mp3';
import Ambient05 from '../../assets/audio/voice/vibration/ambient_05.mp3';
import Ambient06 from '../../assets/audio/voice/vibration/ambient_06.mp3';
import Ambient07 from '../../assets/audio/voice/vibration/ambient_07.mp3';
import Ambient08 from '../../assets/audio/voice/vibration/ambient_08.mp3';
import Ambient09 from '../../assets/audio/voice/vibration/ambient_09.mp3';
import Ambient10 from '../../assets/audio/voice/vibration/ambient_10.mp3';
import Ambient11 from '../../assets/audio/voice/vibration/ambient_11.mp3';
import Ambient12 from '../../assets/audio/voice/vibration/ambient_12.mp3';
import RecordCryoPreserved from '../../assets/audio/voice/vibration/record_cryo_preserved.mp3';
import RecordCryoLost from '../../assets/audio/voice/vibration/record_cryo_lost.mp3';

/** Clip id -> bundled asset. Ids are content ids: ambient_NN and record_*. */
export const voiceSources: Readonly<Record<string, number>> = {
  ambient_01: Ambient01,
  ambient_02: Ambient02,
  ambient_03: Ambient03,
  ambient_04: Ambient04,
  ambient_05: Ambient05,
  ambient_06: Ambient06,
  ambient_07: Ambient07,
  ambient_08: Ambient08,
  ambient_09: Ambient09,
  ambient_10: Ambient10,
  ambient_11: Ambient11,
  ambient_12: Ambient12,
  record_cryo_preserved: RecordCryoPreserved,
  record_cryo_lost: RecordCryoLost,
};
