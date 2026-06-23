import { convertFileSrc } from '@tauri-apps/api/core';

export function imageSource(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('asset://')) {
    return src;
  }

  return convertFileSrc(src);
}
