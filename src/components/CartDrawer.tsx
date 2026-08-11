import { Link } from "react-router";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const utils = trpc.useUtils();
  const { data: cart } = trpc.cart.get.useQuery();
  const updateItem = trpc.cart.updateItem.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const removeItem = trpc.cart.removeItem.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const clearCart = trpc.cart.clear.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  const items = cart?.items || [];
  const total = cart?.total || "0";

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-[200] transition-opacity duration-300 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] max-w-[90vw] bg-white z-[201] transition-transform duration-[400ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[0.875rem] font-medium uppercase tracking-[1px]">Panier</h2>
            <button onClick={onClose} className="p-1 hover:opacity-60">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <ShoppingBag size={40} strokeWidth={1} className="text-[#cccccc] mb-4" />
              <p className="text-[0.875rem] text-[#999999]">Votre panier est vide</p>
              <button
                onClick={onClose}
                className="mt-4 text-[0.75rem] uppercase tracking-[2px] border-b border-[#222222] pb-0.5 hover:opacity-60"
              >
                Continuer les achats
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-4 pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-4 border-b border-[#f0f0f0]">
                    {item.product && (
                      <>
                        <Link
                          to={`/products/${item.product.slug}`}
                          onClick={onClose}
                          className="w-20 h-24 flex-shrink-0 bg-[#f4f4f4] overflow-hidden"
                        >
                          <img
                            src={item.product.images?.[0] || "/placeholder.png"}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/products/${item.product.slug}`}
                            onClick={onClose}
                            className="text-[0.75rem] uppercase tracking-[1px] hover:opacity-60"
                          >
                            {item.product.name}
                          </Link>
                          <p className="text-[0.8125rem] text-[#666666] mt-0.5">
                            €{parseFloat(String(item.product.price)).toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                item.quantity > 1
                                  ? updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 })
                                  : removeItem.mutate({ itemId: item.id })
                              }
                              className="w-6 h-6 flex items-center justify-center border border-[#e0e0e0] hover:bg-[#f4f4f4]"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-[0.75rem] w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateItem.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                              className="w-6 h-6 flex items-center justify-center border border-[#e0e0e0] hover:bg-[#f4f4f4]"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              onClick={() => removeItem.mutate({ itemId: item.id })}
                              className="ml-auto text-[0.625rem] text-[#999999] hover:text-[#222222] underline"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#e0e0e0] mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-[0.8125rem] text-[#666666]">Sous-total</span>
                  <span className="text-[0.875rem]">€{parseFloat(String(total)).toFixed(2)}</span>
                </div>
                <p className="text-[0.6875rem] text-[#999999] mb-4">
                  Livraison offerte a partir de 120€
                </p>
                <Link
                  to="/checkout"
                  onClick={onClose}
                  className="block w-full bg-[#222222] text-white py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] transition-colors text-center"
                >
                  Passer la commande
                </Link>
                <button
                  onClick={() => clearCart.mutate()}
                  className="w-full mt-2 text-[0.6875rem] text-[#999999] hover:text-[#222222] underline"
                >
                  Vider le panier
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
