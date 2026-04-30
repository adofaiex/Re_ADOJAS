import { Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import EditorPage from "./pages/EditorPage"
import SettingsPage from "./pages/SettingsPage"
import MeshPage from "./pages/MeshPage"

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/mesh" element={<MeshPage />} />
    </Routes>
  )
}

export default App
