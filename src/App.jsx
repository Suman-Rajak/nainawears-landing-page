import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HaulPage from './pages/HaulPage';
import HaulNotFound from './pages/HaulNotFound';
import './index.css';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/haul/:id" element={<HaulPage />} />
        <Route path="/haul-not-found" element={<HaulNotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
