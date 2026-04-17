import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Skills from './pages/Skills'
import Memory from './pages/Memory'
import Crons from './pages/Crons'
import Plugins from './pages/Plugins'
import Logs from './pages/Logs'
import Profiles from './pages/Profiles'
import Multiagent from './pages/Multiagent'
import Settings from './pages/Settings'
import Files from './pages/Files'
import Jobs from './pages/Jobs'
import Config from './pages/Config'
import Kanban from './pages/Kanban'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<Chat />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/crons" element={<Crons />} />
        <Route path="/plugins" element={<Plugins />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/multiagent" element={<Multiagent />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/files" element={<Files />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/config" element={<Config />} />
      </Route>
    </Routes>
  )
}
