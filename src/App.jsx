import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import BookingPage from "./pages/BookingPage";
import AdminPage from "./pages/AdminPage";

function App() {
  // A sua chave de identificação pública do Google
  const clientId = "703564286722-k5n0c4looh4688qa9vunbqmst9p3ju97.apps.googleusercontent.com";

  return (
    // Envolvemos o app com o provedor do Google para habilitar o login
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <Routes>
          {/* Rota para os Clientes */}
          <Route path="/" element={<BookingPage />} />
          
          {/* Rota para o Painel Administrativo */}
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;