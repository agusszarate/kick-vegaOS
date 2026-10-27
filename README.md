<p align="center"><img src="design/icon.svg" width="120" alt="KickTV icon"></p>

# KickTV

An unofficial, lightweight [Kick](https://kick.com) player for Fire TV devices
running **Vega OS** (for example the Fire TV Stick 4K Select), where there is
no Kick app and apps can only be installed from the Amazon Appstore or in
developer mode.

> **Disclaimer:** KickTV is not affiliated with, endorsed by or connected to
> Kick or Amazon. It uses the same undocumented web endpoints as kick.com,
> which may change or break at any time. Use at your own risk.

The full kick.com site runs inside a WebView, but it is too heavy for a device
with 1 GB of RAM. KickTV shows only what a TV needs and plays the stream itself.

## Features

- **Live now in Spanish**: the 24 most watched Spanish streams.
- **My channels**: favorites, live ones first. Press OK while watching to add or remove one.
- **Search** by channel name with the on-screen keyboard.
- **Zapping**: ▲/▼ while watching switches to the previous/next live channel of the same list.
- **Send from your phone**: scan a QR code and type a channel name or paste a Kick link; the TV opens it (see [Privacy](#send-from-your-phone-and-privacy)).
- Video capped at 720p, scaled UI with a TV-safe margin for overscan.

Not supported: logging in, chat, channel points and subscriptions. Kick's
public API has no endpoint for followed channels and no TV login flow, and
channel points are only earned through Kick's own player.

## Requirements

- A Fire TV device with **Vega OS** in **developer mode**, on the same network as your computer.
- An [Amazon Developer account](https://developer.amazon.com) (free).
- The [Vega SDK](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html) and Node.js 20+.

## Build and install

1. Install the Vega SDK and log in with your developer account:

   ```bash
   vega devmode login
   ```

2. On the Fire TV: **Settings → My Fire TV → About**, press OK seven times on the
   device name, then **Developer options → Developer Mode**. Enter the code it
   shows:

   ```bash
   vega devmode enable-device --code <CODE>
   ```

   The device reboots. Then set **Developer options → Connection mode** to
   **TCP/IP** and connect to it (the IP is under **About → Network**):

   ```bash
   vega exec vda connect <FIRE_TV_IP>:5555
   ```

3. Build and install:

   ```bash
   npm install
   npm run build:release
   vega run-app build/armv7-release/kicktv-vega_armv7.vpkg ar.agus.kicktv.main
   ```

   Use the package that matches your device's architecture (`vega device info`).

> **Note:** the Vega build tools fail when the project path contains spaces
> (for example macOS's `Application Support`). Clone it somewhere without them.

To publish your own build, change the package id `ar.agus.kicktv` in
`manifest.toml` and `app.json`. Ids starting with `com.amazon` are not allowed.

## Using it

| Where | Key | Action |
|---|---|---|
| Home | ◀ ▲ ▼ ▶ | Move between cards |
| Home | OK | Open a channel, search, or the phone QR |
| Home | Back | Exit |
| Watching | OK | Add to / remove from *Mis canales* |
| Watching | ▲ ▼ | Previous / next live channel |
| Watching | Back | Back to the list |

### Send from your phone and privacy

On first run the app creates a random topic on [ntfy.sh](https://ntfy.sh), a
free, open-source notification service, and listens to it while open. The QR
code opens `https://ntfy.sh/<topic>` on your phone; publish a channel name or a
Kick link there and the TV opens it.

- Only the channel names you send go through ntfy.sh, and ntfy.sh can see them.
- Topics have no password: anyone who knows yours could make your TV open a
  Kick channel. The app ignores everything else.
- To keep messages inside your network, [self-host ntfy](https://docs.ntfy.sh/install/)
  and change `NTFY_SERVER` in `web/src/phone.ts`.

### Home automation

In developer mode the device accepts commands over the network with plain
`adb`, so tools like Home Assistant can open the app:

```bash
adb connect <FIRE_TV_IP>:5555
adb shell vlcm launch-app orpheus://ar.agus.kicktv.main
```

> **Security:** in developer mode *any* device on your network can control the
> Fire TV this way, without confirmation.

## How it works

```
src/App.tsx        React Native shell: a full-screen WebView, Back key, logs
shared/protocol.ts Messages between the shell and the web UI
web/src/           The UI (TypeScript), bundled by esbuild into assets/app.js
  main.ts            screens, keys, wiring
  kick.ts            Kick API client
  player.ts          hls.js player with fallbacks and memory safeguards
  quality.ts         hls.js settings (720p cap, metadata off)
  home.ts focus.ts   rows of cards and remote-control focus
  phone.ts           ntfy listener and QR code
assets/            index.html, styles.css, icon, and the generated app.js
manifest.toml      Vega package manifest
```

The page loads from `file:///pkg/assets/index.html`. Kick's API, the Amazon IVS
variant playlists and the video segments all allow cross-origin requests, so no
backend is needed. The one exception is each stream's master playlist
(`*.playback.live-video.net`), which only allows `https://kick.com`: the React
Native shell, which isn't bound by CORS, downloads it on the page's behalf
(only from `*.live-video.net`) and the page hands it to hls.js as a blob URL.
See `shared/protocol.ts`.

### Memory

Without that, hls.js can't load the stream and playback falls back to the
WebView's native HLS player, which keeps everything it has played buffered
(about 45 MB a minute at 720p). On a 1 GB device the system then kills the app
after about 8 minutes. With hls.js the played video is evicted and memory stays
flat. KickTV also caps video at 720p, disables metadata and subtitle cues
(Kick sends ID3 and `EXT-X-DATERANGE` metadata every 1-2 seconds) and, if it
ever has to use the native player, restarts it every 5 minutes. See
`web/src/quality.ts`.

To check memory on a device, play a stream and run
`vega exec perf memory-monitor --app-name ar.agus.kicktv.main`; the device log
also gets a `[KickTV] stats` line every 30 seconds with the buffered seconds.

## Development

```bash
npm run watch:web   # rebuild assets/app.js on change
npm run check       # typecheck + lint + tests
npm run build:web   # bundle the UI only (no Vega SDK needed)
```

Device logs: `vega device start-log-stream`. The web UI's messages appear with
the `[KickTV]` prefix.

## License

[MIT](LICENSE). Kick is a trademark of its owner. The icon is original and not
Kick's logo.
