// Reset password page (legacy route).
//
// Password reset is now a 2-step OTP flow starting at /forgot-password.
// This route is kept so old bookmarks and links don't 404 — it redirects
// to the forgot-password page.
import { Navigate } from 'react-router-dom';

export default function ResetPassword() {
  return <Navigate to="/forgot-password" replace />;
}
