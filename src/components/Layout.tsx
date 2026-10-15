import { Outlet } from "react-router";
import { useState, useEffect, Suspense } from "react";
import PageLoader from "./PageLoader";
import Header from "./Header";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import SearchOverlay from "./SearchOverlay";
import NavDrawer from "./NavDrawer";

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (cartOpen || searchOpen || navOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen, searchOpen, navOpen]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header
        onCartOpen={() => setCartOpen(true)}
        onSearchOpen={() => setSearchOpen(true)}
        onNavOpen={() => setNavOpen(true)}
      />
      <main className="flex-1">
        {/* En-tete et pied de page restent affiches pendant le chargement d'une page */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
