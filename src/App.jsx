// Human Court — application shell: providers, layout, and routes.
import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import AnnouncementBar from './components/layout/AnnouncementBar.jsx';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import PageTransition from './components/layout/PageTransition.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import './styles/motion.css';

import Landing from './pages/Landing.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import About from './pages/About.jsx';
import Faq from './pages/Faq.jsx';
import ExamplePage from './pages/ExamplePage.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import NewCaseWizard from './pages/NewCaseWizard.jsx';
import Settings from './pages/Settings.jsx';
import Notifications from './pages/Notifications.jsx';
import SharePage from './pages/SharePage.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';

// Scroll back to the top whenever the route changes.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Simple 404 page.
function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — Human Court';
  }, []);
  return (
    <main className="container" style={{ padding: '64px 16px', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        The page you are looking for does not exist.
      </p>
      <p>
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
      </p>
    </main>
  );
}

// Skip link: moves keyboard focus to the page's <main> landmark.
function SkipLink() {
  const handleClick = (event) => {
    event.preventDefault();
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: false });
    }
  };
  return (
    <a className="skip-link" href="#main-content" onClick={handleClick}>
      Skip to main content
    </a>
  );
}

function Layout() {
  return (
    <div className="app-shell">
      <SkipLink />
      <AnnouncementBar />
      <Header />
      <div className="page-shell">
        <PageTransition>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<Landing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/example" element={<ExamplePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/s/:token" element={<SharePage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Protected pages */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/new"
              element={
                <ProtectedRoute>
                  <NewCaseWizard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/:id/edit"
              element={
                <ProtectedRoute>
                  <NewCaseWizard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/:id"
              element={
                <ProtectedRoute>
                  <CaseDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </div>
      <Footer />
      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ScrollToTop />
          <Layout />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
