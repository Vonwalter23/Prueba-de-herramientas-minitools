import React from 'react'
import { createRoot } from 'react-dom/client'
import PdfToolsPage from './PdfToolsPage'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PdfToolsPage />
  </React.StrictMode>,
)
