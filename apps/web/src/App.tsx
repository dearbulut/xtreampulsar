import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-500 mb-4">XtreamPulsar</h1>
        <p className="text-gray-400">IPTV Middleware Dashboard</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
