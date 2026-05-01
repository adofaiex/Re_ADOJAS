import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter as Router } from "react-router-dom"
import App from "./App.tsx"
import { ThemeProvider } from "./hooks/use-theme.tsx"
import { I18nProvider } from "./lib/i18n/context.tsx"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
  <React.StrictMode>
    <Router>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
  </>,
)
