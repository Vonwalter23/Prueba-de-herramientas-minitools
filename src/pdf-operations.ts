import { PDFDocument, degrees } from 'pdf-lib'

export const MAX_PDF_FILE_BYTES = 20 * 1024 * 1024
export const MAX_PDF_BATCH_BYTES = 30 * 1024 * 1024
export const PDF_MIME_TYPE = 'application/pdf'

export type PdfOperation = 'merge' | 'split' | 'rotate' | 'reorder' | 'remove'

export interface PdfOperationOptions {
  operation: PdfOperation
  files: File[]
  pages?: string
  rotation?: 90 | 180 | 270
}

export interface PdfOutput {
  blob: Blob
  filename: string
}

function validateFiles(files: File[], operation: PdfOperation): void {
  const requiredCount = operation === 'merge' ? 2 : 1
  if (files.length < requiredCount) {
    throw new Error(operation === 'merge' ? 'Seleccioná al menos dos archivos PDF para unir.' : 'Seleccioná un archivo PDF.')
  }
  if (operation !== 'merge' && files.length !== 1) {
    throw new Error('Esta operación acepta un solo archivo PDF por vez.')
  }
  if (files.some((file) => file.size === 0)) throw new Error('Uno de los archivos está vacío.')
  if (files.some((file) => file.size > MAX_PDF_FILE_BYTES)) {
    throw new Error('Cada PDF debe pesar 20 MB o menos.')
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_PDF_BATCH_BYTES) {
    throw new Error('El tamaño total de los archivos no puede superar los 30 MB.')
  }
  if (files.some((file) => file.type && file.type !== PDF_MIME_TYPE)) {
    throw new Error('Seleccioná únicamente archivos PDF.')
  }
}

function parsePageList(input: string, pageCount: number): number[] {
  if (!input.trim()) throw new Error('Indicá las páginas que querés procesar.')
  const pages: number[] = []
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim()
    const range = /^(\d+)-(\d+)$/u.exec(part)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (start < 1 || end < start || end > pageCount) {
        throw new Error(`El rango "${part}" no es válido. El PDF tiene ${pageCount} páginas.`)
      }
      for (let page = start; page <= end; page += 1) pages.push(page - 1)
      continue
    }
    if (!/^\d+$/u.test(part)) throw new Error(`La página "${part}" no es válida. Usá números y rangos como 1, 3-5.`)
    const page = Number(part)
    if (page < 1 || page > pageCount) throw new Error(`La página ${page} no existe. El PDF tiene ${pageCount} páginas.`)
    pages.push(page - 1)
  }
  if (new Set(pages).size !== pages.length) throw new Error('No repitas páginas ni incluyas rangos superpuestos.')
  return pages
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
  } catch {
    throw new Error(`No se pudo abrir "${file.name}". Verificá que sea un PDF válido y que no esté protegido con contraseña.`)
  }
}

function safeBaseName(name: string): string {
  return name.replace(/\.pdf$/iu, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'documento'
}

export async function processPdf(options: PdfOperationOptions): Promise<PdfOutput> {
  const { operation, files } = options
  validateFiles(files, operation)

  let output: PDFDocument
  let filename: string

  if (operation === 'merge') {
    output = await PDFDocument.create()
    for (const file of files) {
      const source = await loadPdf(file)
      const copiedPages = await output.copyPages(source, source.getPageIndices())
      copiedPages.forEach((page) => output.addPage(page))
    }
    filename = 'pdf-unidos.pdf'
  } else {
    const file = files[0]
    const source = await loadPdf(file)
    const baseName = safeBaseName(file.name)

    if (operation === 'rotate') {
      const rotation = options.rotation ?? 90
      source.getPages().forEach((page) => {
        page.setRotation(degrees((page.getRotation().angle + rotation) % 360))
      })
      output = source
      filename = `${baseName}-rotado.pdf`
    } else {
      const selectedPages = parsePageList(options.pages ?? '', source.getPageCount())
      if (operation === 'remove') {
        const removed = new Set(selectedPages)
        const remaining = source.getPageIndices().filter((page) => !removed.has(page))
        if (remaining.length === 0) throw new Error('No podés eliminar todas las páginas del PDF.')
        output = await PDFDocument.create()
        const copied = await output.copyPages(source, remaining)
        copied.forEach((page) => output.addPage(page))
        filename = `${baseName}-paginas-eliminadas.pdf`
      } else {
        output = await PDFDocument.create()
        const copied = await output.copyPages(source, selectedPages)
        copied.forEach((page) => output.addPage(page))
        filename = operation === 'split'
          ? `${baseName}-seleccion.pdf`
          : `${baseName}-reordenado.pdf`
      }
    }
  }

  const bytes = await output.save()
  return { blob: new Blob([bytes], { type: PDF_MIME_TYPE }), filename }
}
