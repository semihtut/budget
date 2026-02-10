import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Review from "./pages/Review";
import History from "./pages/History";
import Subscriptions from "./pages/Subscriptions";
import { seedCategories } from "./db/seed";

export default function App() {
  useEffect(() => {
    seedCategories();
  }, []);

  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/review/:draftId" element={<Review />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}
