import { ThemeProvider } from './contexts/ThemeContext'
import { UbosStudioLayout } from './components/UbosStudioLayout'

function App() {
  return (
    <ThemeProvider>
      <UbosStudioLayout />
    </ThemeProvider>
  )
}

export default App
