// 파일 드래그앤드롭 공용 props (v1.9) — 업로드 버튼·영역 어디든 {...fileDrop(fn)}으로 부착
import type { DragEvent } from 'react';

export function fileDrop(onFiles: (files: FileList) => void) {
  return {
    onDragOver: (e: DragEvent) => { e.preventDefault(); },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
    },
  };
}
