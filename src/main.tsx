import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
// Polices servies par le site lui-meme : pas de connexion a Google Fonts
// qui retarde le premier affichage.
import '@fontsource-variable/inter'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/500.css'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
