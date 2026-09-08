import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from '@/app/layout';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import LoginScreen from '@/features/auth/login-screen';
import MyClassesScreen from '@/features/classes/my-classes-screen';
import DashboardScreen from '@/features/dashboard/dashboard-screen';
import JigsawScreen from '@/features/jigsaw/jigsaw-screen';
import LeaderboardScreen from '@/features/leaderboard/leaderboard-screen';
import PackListScreen from '@/features/packs/pack-list-screen';
import QuizScreen from '@/features/quiz/quiz-screen';
import StudentsScreen from '@/features/students/students-screen';
import TeachersScreen from '@/features/teachers/teachers-screen';
import { images } from '@/shared/assets/images';

/**
 * One gate, not per-route guards: every screen here needs the admin claim, so
 * the whole router is either the console or the login page.
 */
function Gate() {
  const { user, restoring } = useAuth();

  if (restoring) {
    return (
      <div className="login__panel" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
          <img src={images.appIcon} alt="" width={64} height={64} style={{ borderRadius: 16 }} />
          <span className="spinner" />
          <span className="card__hint">Restoring your session…</span>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={user.role === 'admin' ? <DashboardScreen /> : <Navigate to="/packs" replace />} />
        <Route path="/teachers" element={<TeachersScreen />} />
        <Route path="/students" element={<StudentsScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/packs" element={<PackListScreen />} />
        <Route path="/my-classes" element={<MyClassesScreen />} />
        <Route path="/packs/:packId/quiz" element={<QuizScreen />} />
        <Route path="/packs/:packId/jigsaw" element={<JigsawScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
