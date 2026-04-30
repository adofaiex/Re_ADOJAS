import { Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import EditorPage from "./pages/EditorPage"
import SettingsPage from "./pages/SettingsPage"

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
