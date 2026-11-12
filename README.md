# PDF Merger

Combine PDFs and JPG scans into a single PDF, or fill in and sign a PDF, entirely in the browser.
Nothing is uploaded anywhere.

**Use it online:** https://muradzalov.github.io/pdf-merger/

After the first visit it also works offline, and it can be installed as an app (the install icon in
the browser's address bar). Files are still processed only on your machine.

## Features

### Merge

- Merge any mix of PDFs and JPGs, in the order you choose (drag the handle, or focus it and use Space + arrow keys)
- Files you add are put in name order automatically (`IMG_2` before `IMG_10`, `Scan` before `Scan (2)`),
  since browsers hand dropped files over in no reliable order; **Sort A–Z** re-sorts the whole list
- Long lists (100+ files) scroll inside their own box
- Rotate a file's pages 90° at a time (for sideways scans)
- Choose the output file name
- Remove one file or all of them
- Files that can't be merged are skipped with a reason, including password-protected or restricted
  PDFs, which pdf-lib can't decrypt (open those and use Print → Save as PDF first)

### Edit & sign

Open one PDF (or JPG) and:

- **Text:** click anywhere to type, e.g. to fill in a form. Drag a corner to make the text bigger or
  smaller; pick its size and color in the toolbar.
- **Draw:** freehand pen. A stylus's pressure makes the line thicker or thinner.
- **Highlight:** drag over text. The text stays readable underneath.
- **Signature:** draw it once on the signature pad, then click where it goes and drag or resize it.
  You can let the browser remember it, so the next document takes two clicks.
- **Select** to move, resize or delete anything you added. Ctrl+Z undoes, Delete deletes, Esc cancels.

**Download** writes everything into the PDF itself, so it looks the same in every viewer. Fillable form
fields are flattened (they become part of the page and stop being editable), so nothing you typed over
them can end up hidden behind them. Typed text uses Helvetica, which covers Western European
characters only; text with other characters (e.g. ə, ş, Cyrillic, emoji) is outlined in red and
can't be saved.

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
update the site by itself; run `npm run deploy` when you want the live version updated. A copy of the
site that's already open (or installed) shows a "new version available" prompt shortly after; click
**Reload** there, or close all its tabs, to switch to the new version.

## How it works

- **Stack:** React + TypeScript + Vite, [antd](https://ant.design) for UI components, [jotai](https://jotai.org) for state.
- **PDFs** are merged page-by-page with [pdf-lib](https://pdf-lib.js.org).
- **JPGs** are embedded with pdf-lib's `embedJpg`, which stores the original JPEG bytes unchanged
  (no re-compression), so the image in the PDF is bit-for-bit identical to the file you added.
  [exifr](https://github.com/MikeKovarik/exifr) reads the scan's DPI (so a 300 DPI letter scan becomes a
  letter-size page) and its EXIF orientation (so phone photos aren't sideways). A JPG with no DPI
  info gets 1 pixel = 1 point.
- **Editor:** [pdf.js](https://mozilla.github.io/pdf.js/) (what Firefox uses) draws the pages; your edits
  sit on top as React components ([react-rnd](https://github.com/bokuweb/react-rnd) for moving and resizing,
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand) for pen strokes). Download writes
  them into the PDF with pdf-lib, at the same positions as on screen, on rotated and cropped pages too.
- **Offline:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app) generates a service worker that
  caches the app (builds only, never `npm run dev`).

## Layout

```
src/
  App.tsx                     page layout: the Merge and Edit & sign tabs
  state/files.ts              jotai atoms: the file list + add/remove/rotate/reorder/sort/clear actions
  components/
    FileDropzone.tsx          antd Upload.Dragger; adds files to state, reports unsupported ones
    FileList.tsx              drag-to-reorder list (dnd-kit), Sort A–Z, Remove all
    FileListItem.tsx          one row: rotate, remove, drag handle
    MergeButton.tsx           output file name, runs the merge, shows result messages
    UpdatePrompt.tsx          "a new version is available" prompt
  lib/
    fileKinds.ts              PDF vs JPG detection
    fileOrder.ts              natural file name ordering (matches Windows Explorer)
    loadPdf.ts                loads a PDF with pdf-lib, refusing encrypted ones
    mergeFiles.ts             builds the merged PDF
    jpegPage.ts               turns one JPG into one PDF page
    rotatePage.ts             adds a rotation to a page
    download.ts               output file name + triggers the browser download
  editor/
    types.ts                  what an edit is, and the coordinates everything uses (start here)
    state.ts                  jotai atoms: open document, edits, tool, options, undo
    constants.ts              colors, sizes, zoom limits
    textMetrics.ts            text layout shared by the screen and the export
    ink.ts                    pen strokes → SVG paths (perfect-freehand)
    pdfjs.ts                  pdf.js setup; opens a PDF or JPG for editing
    EditorPage.tsx            the tab: open a file, header (zoom, Close, Download), pages
    PdfPage.tsx               one page: pdf.js canvas (rendered when near the screen) + its edits
    EditorToolbar.tsx         tools, options, Undo/Delete, keyboard shortcuts
    SignaturePad.tsx          draw a signature; savedSignature.ts remembers it in the browser
    AnnotationLayer.tsx       a page's edits; creates new ones with the current tool
    annotations/              one component per kind of edit, plus the draw/highlight/sign surfaces
    exportPdf.ts              writes the edits into the PDF (and flattens form fields)
public/                       app icons
vite.config.ts                base path for GitHub Pages, offline (PWA) setup, pdf.js files
```
