import { useEffect, useState } from 'react'
import { MAX_PDF_BATCH_BYTES, MAX_PDF_FILE_BYTES, processPdf, type PdfOperation } from './pdf-operations'

const operationLabels: Record<PdfOperation, string> = {
  merge: 'Unir PDF',
  split: 'Extraer páginas (dividir)',
  rotate: 'Rotar páginas',
  reorder: 'Reordenar páginas',
  remove: 'Eliminar páginas',
}

export default function PdfToolsPage() {
  const [operation, setOperation] = useState<PdfOperation>('merge')
  const [files, setFiles] = useState<File[]>([])
  const [pages, setPages] = useState('1')
  const [rotation, setRotation] = useState<90 | 180 | 270>(90)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloadName, setDownloadName] = useState('')

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  }, [downloadUrl])

  function resetResult() {
    setError('')
    setStatus('')
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl('')
    setDownloadName('')
  }

  function changeOperation(next: PdfOperation) {
    setOperation(next)
    setFiles([])
    setPages('1')
    resetResult()
  }

  function handleFiles(selected: FileList | null) {
    setFiles(selected ? Array.from(selected) : [])
    resetResult()
  }

  async function runOperation() {
    resetResult()
    setBusy(true)
    try {
      const result = await processPdf({ operation, files, pages, rotation })
      const url = URL.createObjectURL(result.blob)
      setDownloadUrl(url)
      setDownloadName(result.filename)
      setStatus('PDF procesado en este dispositivo. Descargá el resultado para guardarlo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const needsPages = operation === 'split' || operation === 'reorder' || operation === 'remove'
  const needsMultiple = operation === 'merge'

  return (
    <>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <main id="main-content" className="page-shell tool-page">
        <header className="topbar">
          <a className="brand" href="#main-content" aria-label="Herramientas PDF">
            <span className="brand-mark">M</span>
            <span>Herramientas PDF</span>
          </a>
          <span className="topbar-note">PDF local · Privacidad primero</span>
        </header>
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <span>Demo de prueba</span>
        </nav>
        <section className="tool-intro">
          <span className="eyebrow">HERRAMIENTA GRATUITA</span>
          <h1>Herramientas para PDF</h1>
          <p>Uní, extraé, rotá, reordená y eliminá páginas de archivos PDF desde tu navegador.</p>
          <p className="local-note">✓ Los archivos se procesan en este navegador; no se suben a un servidor.</p>
        </section>
        <section className="tool-workspace" aria-label="Operaciones PDF">
          <label className="field-label" htmlFor="pdf-operation">Operación
            <select id="pdf-operation" value={operation} onChange={(event) => changeOperation(event.target.value as PdfOperation)}>
              {Object.entries(operationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>

          <label className="field-label" htmlFor="pdf-files">{needsMultiple ? 'Archivos PDF (seleccioná al menos dos)' : 'Archivo PDF'}
            <input
              id="pdf-files"
              type="file"
              accept="application/pdf,.pdf"
              multiple={needsMultiple}
              onChange={(event) => handleFiles(event.target.files)}
              aria-describedby="pdf-file-help"
            />
          </label>
          <p id="pdf-file-help" className="option-help">
            Máximo 20 MB por archivo y 30 MB en total. Se admiten PDF válidos sin contraseña.
          </p>
          {files.length > 0 && (
            <div className="pdf-file-list" aria-label="Archivos seleccionados">
              <strong>{files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}</strong>
              <ul>{files.map((file, index) => <li key={index}>{file.name} — {(file.size / (1024 * 1024)).toFixed(2)} MB</li>)}</ul>
              <p className="image-meta">Tamaño total: {(totalBytes / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          )}

          {needsPages && (
            <label className="field-label" htmlFor="pdf-pages">
              {operation === 'reorder' ? 'Nuevo orden de páginas' : operation === 'remove' ? 'Páginas que querés eliminar' : 'Páginas que querés extraer'}
              <input id="pdf-pages" type="text" value={pages} onChange={(event) => setPages(event.target.value)} placeholder="Ej.: 1, 3-5, 2" />
            </label>
          )}
          {operation === 'rotate' && (
            <label className="field-label" htmlFor="pdf-rotation">Rotación
              <select id="pdf-rotation" value={rotation} onChange={(event) => setRotation(Number(event.target.value) as 90 | 180 | 270)}>
                <option value={90}>90° a la derecha</option>
                <option value={180}>180°</option>
                <option value={270}>270° a la derecha</option>
              </select>
            </label>
          )}

          <div className="button-row">
            <button className="primary-button" type="button" onClick={runOperation} disabled={busy || files.length === 0 || totalBytes > MAX_PDF_BATCH_BYTES || files.some((file) => file.size > MAX_PDF_FILE_BYTES)}>
              {busy ? 'Procesando…' : operationLabels[operation]}
            </button>
            <button className="secondary-button" type="button" onClick={() => { setFiles([]); setPages('1'); resetResult() }}>Limpiar</button>
          </div>
          {busy && <p className="feedback" role="status">Procesando el documento en tu dispositivo. Los archivos grandes pueden tardar.</p>}
          {error && <p className="feedback error" role="alert">{error}</p>}
          {status && <p className="feedback success" role="status">{status}</p>}
          {downloadUrl && (
            <div className="pdf-download">
              <a className="primary-link" href={downloadUrl} download={downloadName}>Descargar {downloadName}</a>
            </div>
          )}
        </section>

        <section className="how-to">
          <h2>Cómo usar esta herramienta</h2>
          <p>Elegí una operación, seleccioná el PDF y descargá el resultado. Para extraer, reordenar o eliminar páginas, indicá números separados por comas y rangos con guion (por ejemplo, 1, 3-5). Los números de página empiezan en 1. Para reordenar, la lista define el orden final e incluye cada página que querés conservar.</p>
          <h2>Compatibilidad y privacidad</h2>
          <p>El procesamiento se realiza localmente. Los archivos protegidos con contraseña, dañados o que superen los límites indicados no son compatibles. La operación de páginas no edita texto existente, formularios ni firmas digitales; al modificar un PDF, las firmas criptográficas existentes pueden dejar de ser válidas.</p>
        </section>
        <footer className="footer"><span>Demo temporal · Procesamiento local</span><a href="#main-content">Volver arriba</a></footer>
      </main>
    </>
  )
}
