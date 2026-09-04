import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LoginPage } from "./pages/LoginPage";
import { MissionControlPlaceholder } from "./pages/MissionControlPlaceholder";
import { AccessAdministrationPage } from "./pages/AccessAdministrationPage";
import { ClientsAdministrationPage } from "./pages/ClientsAdministrationPage";
import { SpacesAdministrationPage } from "./pages/SpacesAdministrationPage";
import { EquipmentsAdministrationPage } from "./pages/EquipmentsAdministrationPage";
import { AgendaPage } from "./pages/AgendaPage";
import { SessionDossierPage } from "./pages/SessionDossierPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HealthCenterPage } from "./pages/HealthCenterPage";
import { FinancialDashboardPage } from "./pages/FinancialDashboardPage";
import { PendingPaymentsPage } from "./pages/PendingPaymentsPage";
import { Toaster } from "./components/ui/sonner";
import { LicenseGuard } from "./components/LicenseGuard";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LicenseGuard>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
          <Route path="/mission-control" element={<MissionControlPlaceholder />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/sessoes/:sessionId" element={<SessionDossierPage />} />
          <Route path="/administracao/acessos" element={<AccessAdministrationPage />} />
          <Route path="/administracao/equipamentos" element={<EquipmentsAdministrationPage />} />
          <Route path="/administracao/configuracoes" element={<SettingsPage />} />
          <Route path="/health-center" element={<HealthCenterPage />} />
          <Route path="/administracao/financeiro" element={<FinancialDashboardPage />} />
          <Route path="/administracao/financeiro/pendencias" element={<PendingPaymentsPage />} />
          <Route path="/administracao/health-center" element={<Navigate to="/health-center" replace />} />
          <Route path="/cadastros/clientes" element={<ClientsAdministrationPage />} />
          <Route path="/cadastros/espacos" element={<SpacesAdministrationPage />} />
          <Route path="/administracao/clientes" element={<Navigate to="/cadastros/clientes" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </LicenseGuard>
      <Toaster />
    </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
