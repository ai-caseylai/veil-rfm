import React, { useState, useCallback } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { I18nContext, detectLang, getTranslations } from "./lib/i18n"
import type { Lang } from "./lib/i18n"
import "./index.css"

function Root() {
  const [lang, setLang] = useState<Lang>(detectLang())
  const t = getTranslations(lang)
  const handleSetLang = useCallback((l: Lang) => setLang(l), [])
  return (
    <I18nContext.Provider value={{ lang, t, setLang: handleSetLang }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nContext.Provider>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Root /></React.StrictMode>
)
