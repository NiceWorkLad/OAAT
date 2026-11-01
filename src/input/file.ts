export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.markdown'];

export type LoadedFile = { name: string; text: string; isMarkdown: boolean };

export class FileError extends Error {}

export async function readTextFile(file: File): Promise<LoadedFile> {
  const name = file.name;
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new FileError(`“${name}” isn’t a .txt or .md file.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new FileError(`“${name}” is ${mb} MB — the limit is 5 MB. Try splitting it up.`);
  }
  const text = await file.text(); // decoded as UTF-8
  return { name, text: text.replace(/^﻿/, ''), isMarkdown: ext !== '.txt' };
}

/** Make the whole page a drop zone. `onDragState` toggles the overlay. */
export function setupDropZone(
  target: HTMLElement,
  onFile: (file: File) => void,
  onDragState: (active: boolean) => void,
): () => void {
  let depth = 0;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const enter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (depth++ === 0) onDragState(true);
  };
  const over = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const leave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    if (--depth <= 0) {
      depth = 0;
      onDragState(false);
    }
  };
  const drop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    onDragState(false);
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  };
  target.addEventListener('dragenter', enter);
  target.addEventListener('dragover', over);
  target.addEventListener('dragleave', leave);
  target.addEventListener('drop', drop);
  return () => {
    target.removeEventListener('dragenter', enter);
    target.removeEventListener('dragover', over);
    target.removeEventListener('dragleave', leave);
    target.removeEventListener('drop', drop);
  };
}
