import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Join from "./pages/Join";
import PreJoin from "./pages/PreJoin";
import MeetingRoom from "./pages/MeetingRoom";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* No auth required — guests can join via link (brief Section 2) */}
          <Route path="/join/:meetingId" element={<Join />} />

          {/* Phase 2 room flow (WebRTC mesh) — Join.jsx will hand off here */}
          <Route path="/meeting/:meetingCode" element={<PreJoin />} />
          <Route path="/meeting/:meetingCode/room" element={<MeetingRoom />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
