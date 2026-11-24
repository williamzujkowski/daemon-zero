/**
 * One literal import per clip so Metro packages every file; the name is derived from the clip id and
 * this table is checked against assets/audio/voice/MANIFEST.json by a test, so a regenerated clip set
 * cannot silently drop a voice. Each line imports the tier of the feed source that carries it, the
 * fidelity ladder (#462, docs/VOICE-CLIPS.md): vibration (host, and the records), phone (office),
 * stream (netsec), broadcast (wire), direct or peer (world). The host's clean takes stay unbundled.
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
import Ambient13 from '../../assets/audio/voice/vibration/ambient_13.mp3';
import Office01 from '../../assets/audio/voice/phone/office_01.mp3';
import Office02 from '../../assets/audio/voice/phone/office_02.mp3';
import Office03 from '../../assets/audio/voice/phone/office_03.mp3';
import Office04 from '../../assets/audio/voice/phone/office_04.mp3';
import Office05 from '../../assets/audio/voice/phone/office_05.mp3';
import Office06 from '../../assets/audio/voice/phone/office_06.mp3';
import Office07 from '../../assets/audio/voice/phone/office_07.mp3';
import Office08 from '../../assets/audio/voice/phone/office_08.mp3';
import Office09 from '../../assets/audio/voice/phone/office_09.mp3';
import Office10 from '../../assets/audio/voice/phone/office_10.mp3';
import Office11 from '../../assets/audio/voice/phone/office_11.mp3';
import Forum01 from '../../assets/audio/voice/stream/forum_01.mp3';
import Forum02 from '../../assets/audio/voice/stream/forum_02.mp3';
import Forum03 from '../../assets/audio/voice/stream/forum_03.mp3';
import Forum04 from '../../assets/audio/voice/stream/forum_04.mp3';
import Forum05 from '../../assets/audio/voice/stream/forum_05.mp3';
import Forum06 from '../../assets/audio/voice/stream/forum_06.mp3';
import Forum07 from '../../assets/audio/voice/stream/forum_07.mp3';
import Forum08 from '../../assets/audio/voice/stream/forum_08.mp3';
import Forum09 from '../../assets/audio/voice/stream/forum_09.mp3';
import Forum10 from '../../assets/audio/voice/stream/forum_10.mp3';
import Forum11 from '../../assets/audio/voice/stream/forum_11.mp3';
import Forum12 from '../../assets/audio/voice/stream/forum_12.mp3';
import Forum13 from '../../assets/audio/voice/stream/forum_13.mp3';
import Forum14 from '../../assets/audio/voice/stream/forum_14.mp3';
import Wire01 from '../../assets/audio/voice/broadcast/wire_01.mp3';
import Wire02 from '../../assets/audio/voice/broadcast/wire_02.mp3';
import Wire03 from '../../assets/audio/voice/broadcast/wire_03.mp3';
import Wire04 from '../../assets/audio/voice/broadcast/wire_04.mp3';
import Wire05 from '../../assets/audio/voice/broadcast/wire_05.mp3';
import Wire06 from '../../assets/audio/voice/broadcast/wire_06.mp3';
import Wire07 from '../../assets/audio/voice/broadcast/wire_07.mp3';
import Wire08 from '../../assets/audio/voice/broadcast/wire_08.mp3';
import Wire09 from '../../assets/audio/voice/broadcast/wire_09.mp3';
import Wire10 from '../../assets/audio/voice/broadcast/wire_10.mp3';
import Wire11 from '../../assets/audio/voice/broadcast/wire_11.mp3';
import Wire12 from '../../assets/audio/voice/broadcast/wire_12.mp3';
import Wire13 from '../../assets/audio/voice/broadcast/wire_13.mp3';
import Wire14 from '../../assets/audio/voice/broadcast/wire_14.mp3';
import World01 from '../../assets/audio/voice/direct/world_01.mp3';
import World02 from '../../assets/audio/voice/direct/world_02.mp3';
import World03 from '../../assets/audio/voice/direct/world_03.mp3';
import World04 from '../../assets/audio/voice/peer/world_04.mp3';
import World05 from '../../assets/audio/voice/peer/world_05.mp3';
import World06 from '../../assets/audio/voice/peer/world_06.mp3';
import World07 from '../../assets/audio/voice/peer/world_07.mp3';
import World08 from '../../assets/audio/voice/peer/world_08.mp3';
import World09 from '../../assets/audio/voice/direct/world_09.mp3';
import World10 from '../../assets/audio/voice/direct/world_10.mp3';
import World11 from '../../assets/audio/voice/direct/world_11.mp3';
import World12 from '../../assets/audio/voice/direct/world_12.mp3';
import World13 from '../../assets/audio/voice/peer/world_13.mp3';
import RecordCryoPreserved from '../../assets/audio/voice/vibration/record_cryo_preserved.mp3';
import RecordCryoLost from '../../assets/audio/voice/vibration/record_cryo_lost.mp3';

/** Clip id -> bundled asset. Ids are content ids: ambient_NN, office_NN, forum_NN, wire_NN, world_NN and record_*. */
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
  ambient_13: Ambient13,
  office_01: Office01,
  office_02: Office02,
  office_03: Office03,
  office_04: Office04,
  office_05: Office05,
  office_06: Office06,
  office_07: Office07,
  office_08: Office08,
  office_09: Office09,
  office_10: Office10,
  office_11: Office11,
  forum_01: Forum01,
  forum_02: Forum02,
  forum_03: Forum03,
  forum_04: Forum04,
  forum_05: Forum05,
  forum_06: Forum06,
  forum_07: Forum07,
  forum_08: Forum08,
  forum_09: Forum09,
  forum_10: Forum10,
  forum_11: Forum11,
  forum_12: Forum12,
  forum_13: Forum13,
  forum_14: Forum14,
  wire_01: Wire01,
  wire_02: Wire02,
  wire_03: Wire03,
  wire_04: Wire04,
  wire_05: Wire05,
  wire_06: Wire06,
  wire_07: Wire07,
  wire_08: Wire08,
  wire_09: Wire09,
  wire_10: Wire10,
  wire_11: Wire11,
  wire_12: Wire12,
  wire_13: Wire13,
  wire_14: Wire14,
  world_01: World01,
  world_02: World02,
  world_03: World03,
  world_04: World04,
  world_05: World05,
  world_06: World06,
  world_07: World07,
  world_08: World08,
  world_09: World09,
  world_10: World10,
  world_11: World11,
  world_12: World12,
  world_13: World13,
  record_cryo_preserved: RecordCryoPreserved,
  record_cryo_lost: RecordCryoLost,
};
