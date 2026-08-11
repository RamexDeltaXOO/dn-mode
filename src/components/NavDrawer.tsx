import { Link } from "react-router";
import { X, Instagram } from "lucide-react";

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const navLinks = [
    { name: "T-shirts / Tops", slug: "t-shirts-tops" },
    { name: "Chemises / Hauts", slug: "chemises-hauts" },
    { name: "Sweats / Pulls", slug: "sweats-pulls" },
    { name: "Robes", slug: "robes" },
    { name: "Pantalons", slug: "pantalons" },
    { name: "Jupes", slug: "jupes" },
    { name: "Ensembles", slug: "ensembles" },
    { name: "Gilets / Vestes", slug: "gilets-vestes" },
    { name: "Manteaux", slug: "manteaux" },
    { name: "Hijabs", slug: "hijabs" },
    { name: "Burkini", slug: "burkini" },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-[200] transition-opacity duration-300 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-[300px] max-w-[85vw] bg-white z-[201] transition-transform duration-[400ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" onClick={onClose} className="font-['Playfair_Display'] text-lg tracking-[-0.5px]">
              dn mode
            </Link>
            <button onClick={onClose} className="p-1 hover:opacity-60">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          <nav className="flex-1 overflow-auto">
            <ul className="space-y-0">
              {navLinks.map((link) => (
                <li key={link.slug} className="border-b border-[#f0f0f0]">
                  <Link
                    to={`/collections/${link.slug}`}
                    onClick={onClose}
                    className="block py-3 text-[0.6875rem] uppercase tracking-[1.5px] text-[#222222] hover:text-[#666666] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="pt-6 border-t border-[#f0f0f0]">
            <Link to="/login" onClick={onClose} className="text-[0.75rem] text-[#666666] hover:text-[#222222]">
              Se connecter
            </Link>
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">
                <Instagram size={18} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
