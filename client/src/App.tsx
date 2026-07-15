import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { VideoView } from './pages/VideoView';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video/:id" element={<VideoView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
