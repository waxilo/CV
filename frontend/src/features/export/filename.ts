/**
 * 导出文件名清洗：去掉路径与非法字符，并限制长度。
 */
export function sanitizeFilename(name: string): string {
  const trimmed = (name || '简历').trim() || '简历';
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

/**
 * 触发浏览器下载文本文件。
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/markdown;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
