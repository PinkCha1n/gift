# Cassie Birthday Gift

A mobile-first, Stardew Valley-inspired birthday gift scene.

## Run locally

Requirements: Node.js 18 or newer.

```sh
node server.cjs
```

Open <http://127.0.0.1:8330/>. Set `PORT` to use another port.

The background track is loaded from `F:/1023.mp4` by the local server and is not included. Change `musicPath` in `server.cjs` to point to a track you can use.

## Publish with GitHub Pages

The `Deploy to GitHub Pages` workflow publishes the static page whenever a commit is pushed to `main`. In the repository, open **Settings → Pages**, select **GitHub Actions** under Build and deployment, then wait for the workflow to finish. The project page will be available at <https://pinkcha1n.github.io/gift/>.

GitHub Pages cannot run `server.cjs` or read files from your computer. Music is therefore disabled on the Pages version; the rest of the page works without a backend.

## Included assets

The page uses pixel art and interface assets extracted from Stardew Valley, plus gift images supplied for this project. The bundled game assets are provided here for this personal project; Stardew Valley is a trademark of ConcernedApe. The Chinese font subset is Noto Sans SC and its license is included in `assets/NotoSansSC-OFL.txt`.
