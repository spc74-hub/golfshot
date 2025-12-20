import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// Pages
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Home } from "@/pages/Home";
import { History } from "@/pages/History";
import { Courses } from "@/pages/Courses";
import { RoundSetup } from "@/pages/RoundSetup";
import { RoundPlay } from "@/pages/RoundPlay";
import { RoundCard } from "@/pages/RoundCard";
import { ImportRound } from "@/pages/ImportRound";
import { Players } from "@/pages/Players";
import { Stats } from "@/pages/Stats";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <Layout>
                    <History />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Courses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/round/setup"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoundSetup />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/round/play"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoundPlay />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/round/card"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoundCard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/round/import"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ImportRound />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/players"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Players />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Stats />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold mb-4">Panel de Admin</h1>
                      <p className="text-muted-foreground">
                        Dashboard de administracion - Por implementar
                      </p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold mb-4">Gestion de Usuarios</h1>
                      <p className="text-muted-foreground">
                        Pagina de usuarios - Por implementar
                      </p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <div className="text-center py-12">
                      <h1 className="text-2xl font-bold mb-4">Gestion de Campos</h1>
                      <p className="text-muted-foreground">
                        Pagina de campos - Por implementar
                      </p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
