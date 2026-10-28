import { Routes, Route } from "react-router";
import { lazy, Suspense, useEffect } from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CollectionPage from "./pages/CollectionPage";
import ProductPage from "./pages/ProductPage";
import ContactPage from "./pages/ContactPage";
import PageLoader from "./components/PageLoader";
import ScrollToTop from "./components/ScrollToTop";

// Pages chargees a la demande : un visiteur de la boutique ne telecharge ni
// le CRM (et sa librairie de graphiques) ni Stripe tant qu'il n'en a pas besoin.
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminShipping = lazy(() => import("./pages/admin/AdminShipping"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminEmails = lazy(() => import("./pages/admin/AdminEmails"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

function App() {
  useEffect(() => {
    if (!localStorage.getItem("dnmode_session_id")) {
      localStorage.setItem("dnmode_session_id", crypto.randomUUID());
    }
  }, []);

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/collections/:slug" element={<CollectionPage />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<Login />} />
          </Route>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="collections" element={<AdminCollections />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="shipping" element={<AdminShipping />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="emails" element={<AdminEmails />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
