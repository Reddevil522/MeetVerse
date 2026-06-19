import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import './App.css'
import LandingPage from './pages/landing.jsx';
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgetPassword from "./pages/ForgetPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import { AuthContext, AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import VideoCall from "./pages/VideoCall.jsx";
import Home from "./pages/Home.jsx";
import { useContext } from "react";

// Guard for routes that require authentication
const ProtectedRoute = () => {
  const { userData, loading } = useContext(AuthContext);
  if (loading) return null; // Wait for auth check
  return userData ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname, error: "Please log in to continue" }} />;
};

// Guard for routes that should only be accessible if NOT logged in (e.g. login, register, landing)
const PublicRoute = ({ children }) => {
  const { userData, loading } = useContext(AuthContext);
  if (loading) return null; // Wait for auth check
  return !userData ? children : <Navigate to="/home" replace />;
};

function App() {
  return (
    <>
      <Router>
        <ToastProvider>
          <AuthProvider>
            <Routes>

              <Route path="/" element={
                <PublicRoute>
                  <LandingPage />
                </PublicRoute>
              } />
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/register" element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } />
              <Route path="/forgetPassword" element={
                <PublicRoute>
                  <ForgetPassword />
                </PublicRoute>
              } />
              <Route path="/reset-password/:token" element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              } />

              <Route element={<ProtectedRoute />}>
                <Route path="/home" element={<Home />} />
              </Route>

              <Route path="/:url" element={
                <VideoCall />
              } />

            </Routes>
          </AuthProvider>
        </ToastProvider>

      </Router>
    </>
  )
}

export default App
