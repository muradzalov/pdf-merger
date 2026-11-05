# PDF Merger

Combine PDFs and JPG scans into a single PDF, entirely in the browser. Nothing is uploaded anywhere.

## Run

```
npm install
npm run dev
```

`npm run build` type-checks and builds; `npm run typecheck` only type-checks.

## How it works

- **Stack:** React + TypeScript + Vite, [antd](https://ant.design) for UI components, [jotai](https://jotai.org) for state.
- **PDFs** are merged page-by-page with [pdf-lib](https://pdf-lib.js.org).
- **JPGs** are embedded with pdf-lib's `embedJpg`, which stores the original JPEG bytes unchanged
  (no re-compression), so the image in the PDF is bit-for-bit identical to the file you added.
  [exifr](https://github.com/MikeKovarik/exifr) reads the scan's DPI (so a 300 DPI letter scan becomes a
  letter-size page) and its EXIF orientation (so phone photos aren't sideways). A JPG with no DPI
  info gets 1 pixel = 1 point.

## Layout

```
src/
  App.tsx                     page layout
  state/files.ts              jotai atoms: the file list + add/remove/reorder actions
  components/
    FileDropzone.tsx          antd Upload.Dragger; adds files to state
    FileList.tsx              drag-to-reorder list (dnd-kit)
    FileListItem.tsx          one row in the list
    MergeButton.tsx           runs the merge, shows result messages
  lib/
    fileKinds.ts              PDF vs JPG detection
    mergeFiles.ts             builds the merged PDF
    jpegPage.ts               turns one JPG into one PDF page
    download.ts               triggers the browser download
```
