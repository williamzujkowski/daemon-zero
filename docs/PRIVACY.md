# Privacy

DAEMON // 0 is an offline, single-player game. The app collects and transmits no
personal data. It has no accounts, advertising, analytics, tracking, remote
service, or in-app purchases. The release Android app requests no internet,
microphone, photo-library or external-storage access. Haptic feedback may use
the device's vibration permission. The audio player it is built with adds two more
install-time permissions that show no prompt: changing audio settings (how sound is
routed), and reading the network *state*. The second means the app could tell whether
the device has a connection; it cannot use one, because internet access is removed from
the build, and the game reads that state for nothing. The full list, with the library
behind each entry, is in [RELEASE.md](RELEASE.md#android-permissions-and-size).

While the optional music plays, Android and browsers can show what is playing on a lock
screen, a headset or a connected car display. The web build shows only "Phase N score"
and the game's name there. The Android build shows what the music file's own tags say,
and since 2026-11-17 those tags say the same thing and nothing more: the title
"Phase N score", the game's name as artist and album, and no picture. The track's name
and the account label the files were supplied with are no longer in them. That is what
the files contain; a car display has not been looked at since the change. See
[SOUNDTRACK.md](SOUNDTRACK.md). Nothing is sent anywhere by this: it is the device's own
media controls.

Progress is stored on the device (browser localStorage or native AsyncStorage).
It includes gameplay choices, simulation state and any breadcrumb text the player
writes. Android automatic cloud backup is disabled. A player can export a save
code, which contains that gameplay data, and choose where to keep or share it.
Treat a shared code as sharing the breadcrumb too. Nothing is uploaded by the game.

Start Over resets the active run after confirmation. Clearing the browser's site
data or uninstalling the native app removes its local storage. Keep an exported
save before uninstalling or changing between differently signed Android builds.

Store disclosure: data collected — none; data shared — none; tracking — none.
This describes the standalone release app. Expo Go, development tools, build
services, GitHub and a web hosting provider have their own privacy policies;
a web host may receive ordinary asset requests and keep access logs. The game
itself sends no gameplay data to that host.
