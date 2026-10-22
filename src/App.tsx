import { Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Today from './screens/Today'
import Fridge from './screens/Fridge'
import Recipes from './screens/Recipes'
import RecipeDetail from './screens/RecipeDetail'
import Cook from './screens/Cook'
import Shopping from './screens/Shopping'
import Settings from './screens/Settings'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/fridge" element={<Fridge />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/cook/:id" element={<Cook />} />
        <Route path="/shopping" element={<Shopping />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
