/**
 * 剪贴板
 *
 * navigator.clipboard 只在安全上下文（https / localhost）里可用，
 * 局域网 http 访问时会直接抛错，因此保留 textarea + execCommand 兜底，
 * 避免复制静默失败。
 */

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限被拒或非安全上下文，走兜底方案
  }

  return copyByTextarea(text);
}

function copyByTextarea(text: string): boolean {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  // 移出视口，避免复制瞬间页面滚动或闪烁
  el.style.position = 'fixed';
  el.style.top = '-1000px';
  el.style.opacity = '0';
  document.body.appendChild(el);

  el.select();
  el.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(el);
  return ok;
}
