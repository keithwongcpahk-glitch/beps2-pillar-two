/** Browser-only helper: save text as a file (no network, no dependency). */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilePart(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'export'
}
