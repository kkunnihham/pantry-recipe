import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/theme.css'
import './styles/app.css'
import App from './App'
import { loadState } from './state/store'

registerSW({ immediate: true })

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

loadState()
  .catch((e) => console.error('상태를 불러오지 못했어요', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
