import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ModulesView from './pages/ModulesPage'
import ModuleDetailPage from './pages/ModuleDetailPage'
import QueueDetailPage from './pages/QueueDetailPage'
import ScheduleDetailPage from './pages/ScheduleDetailPage'
import RouteDetailPage from './pages/RouteDetailPage'
import Header from './components/shared/Header'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename='/console' >
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<ModulesView />} />
              <Route path="/modules" element={<ModulesView />} />
              <Route path="/modules/:moduleName" element={<ModuleDetailPage />} />
              <Route path="/modules/:moduleName/queues/:queueName" element={<QueueDetailPage />} />
              <Route path="/modules/:moduleName/schedules/:scheduleName" element={<ScheduleDetailPage />} />
              <Route path="/modules/:moduleName/routes" element={<RouteDetailPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App