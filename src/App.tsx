import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { startPracticeSync, stopPracticeSync, usePractice } from './stores/practice';
import { AppShell } from './components/AppShell';
import { Loading } from './components/ui';
import { LoginPage, NoAccessPage } from './pages/Auth';
import { HomePage } from './pages/Home';
import { DogsPage } from './pages/Dogs';
import { DogProfilePage } from './pages/DogProfile';
import { DogFormPage } from './pages/DogForm';
import { ClientsPage } from './pages/Clients';
import { ClientProfilePage } from './pages/ClientProfile';
import { ClientFormPage, IntakePage } from './pages/ClientForm';
import { SessionsPage } from './pages/Sessions';
import { SessionFormPage } from './pages/SessionForm';
import { SessionDetailPage } from './pages/SessionDetail';
import { SchedulePage } from './pages/Schedule';
import { AppointmentFormPage } from './pages/AppointmentForm';
import { NewAssessmentPage, AssessmentPage } from './pages/Assessment';
import { PlanFormPage, PlanPage } from './pages/Plan';
import { SearchPage } from './pages/Search';
import { SettingsPage } from './pages/Settings';

const ReportPage = lazy(() => import('./pages/Report'));
const NewReportPage = lazy(() => import('./pages/Report').then((m) => ({ default: m.NewReportPage })));
const TemplateEditorPage = lazy(() => import('./pages/TemplateEditor'));

export function App() {
  const status = useAuth((s) => s.status);
  const ready = usePractice((s) => s.ready);

  useEffect(() => {
    if (status === 'authorized') startPracticeSync();
    else stopPracticeSync();
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="paper grid min-h-dvh place-items-center" data-theme="gooddog">
        <Loading label="Opening Good Dog" />
      </div>
    );
  }
  if (status === 'signedOut') return <LoginPage />;
  if (status === 'unauthorized') return <NoAccessPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        {!ready ? (
          <Route path="*" element={<Loading label="Loading your practice" />} />
        ) : (
          <>
            <Route index element={<HomePage />} />
            <Route path="dogs" element={<DogsPage />} />
            <Route path="dogs/new" element={<DogFormPage />} />
            <Route path="dogs/:id" element={<DogProfilePage />} />
            <Route path="dogs/:id/edit" element={<DogFormPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/new" element={<IntakePage />} />
            <Route path="clients/:id" element={<ClientProfilePage />} />
            <Route path="clients/:id/edit" element={<ClientFormPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/new" element={<SessionFormPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="sessions/:id/edit" element={<SessionFormPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="schedule/new" element={<AppointmentFormPage />} />
            <Route path="schedule/:id" element={<AppointmentFormPage />} />
            <Route path="assessments/new" element={<NewAssessmentPage />} />
            <Route path="assessments/:id" element={<AssessmentPage />} />
            <Route path="plans/new" element={<PlanFormPage />} />
            <Route path="plans/:id" element={<PlanPage />} />
            <Route path="plans/:id/edit" element={<PlanFormPage />} />
            <Route path="reports/new" element={<Suspense fallback={<Loading />}><NewReportPage /></Suspense>} />
            <Route path="reports/:id" element={<Suspense fallback={<Loading />}><ReportPage /></Suspense>} />
            <Route path="search" element={<SearchPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/template" element={<Suspense fallback={<Loading />}><TemplateEditorPage /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
