# PDF Merger

Combine PDFs and JPG scans into a single PDF, entirely in the browser. Nothing is uploaded anywhere.

**Use it online:** https://muradzalov.github.io/pdf-merger/

After the first visit it also works offline, and it can be installed as an app (the install icon in
the browser's address bar). Files are still processed only on your machine.

## Features

- Merge any mix of PDFs and JPGs, in the order you choose (drag the handle, or focus it and use Space + arrow keys)
- Rotate a file's pages 90° at a time (for sideways scans)
- Choose the output file name
- Remove one file or all of them
- Files that can't be merged are skipped with a reason, including password-protected or restricted
  PDFs, which pdf-lib can't decrypt (open those and use Print → Save as PDF first)

## Run locally

```
npm install
npm run dev
```

`npm run build` type-checks and builds into `dist/`; `npm run preview` serves that build at
`http://localhost:4173/pdf-merger/`; `npm run typecheck` only type-checks.

## Deploying

```
npm run deploy
```

This builds the site and publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves
(repo **Settings → Pages → Source: Deploy from a branch → `gh-pages`**). Pushing to `main` does not
update the site by itself; run `npm run deploy` when you want the live version updated. Visitors get
the new version on their next visit after it's published.

## How it works

- **Stack:** React + TypeScript + Vite, [antd](https://ant.design) for UI components, [jotai](https://jotai.org) for state.
- **PDFs** are merged page-by-page with [pdf-lib](https://pdf-lib.js.org).
- **JPGs** are embedded with pdf-lib's `embedJpg`, which stores the original JPEG bytes unchanged
  (no re-compression), so the image in the PDF is bit-for-bit identical to the file you added.
  [exifr](https://github.com/MikeKovarik/exifr) reads the scan's DPI (so a 300 DPI letter scan becomes a
  letter-size page) and its EXIF orientation (so phone photos aren't sideways). A JPG with no DPI
  info gets 1 pixel = 1 point.
- **Offline:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app) generates a service worker that
  caches the app (builds only, never `npm run dev`).

## Layout

```
src/
  App.tsx                     page layout
  state/files.ts              jotai atoms: the file list + add/remove/rotate/reorder/clear actions
  components/
    FileDropzone.tsx          antd Upload.Dragger; adds files to state, reports unsupported ones
    FileList.tsx              drag-to-reorder list (dnd-kit), Remove all
    FileListItem.tsx          one row: rotate, remove, drag handle
    MergeButton.tsx           output file name, runs the merge, shows result messages
  lib/
    fileKinds.ts              PDF vs JPG detection
    mergeFiles.ts             builds the merged PDF
    jpegPage.ts               turns one JPG into one PDF page
    rotatePage.ts             adds a rotation to a page
    download.ts               output file name + triggers the browser download
public/                       app icons
vite.config.ts                base path for GitHub Pages + offline (PWA) setup
```
