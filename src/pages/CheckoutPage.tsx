import { useState, useMemo } from "react";
import { Link } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { carrierLabel } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { ChevronLeft, Check, ShoppingBag } from "lucide-react";
import ShippingMethodSelector from "@/components/ShippingMethodSelector";
import type { ShippingMethodOption } from "@/components/ShippingMethodSelector";
import ServicePointPicker from "@/components/ServicePointPicker";
import type { SelectedServicePoint } from "@/components/ServicePointPicker";

function CheckoutForm({ clientSecret, orderId, orderNumber, total, carrierName, servicePoint }: {
  clientSecret: string;
  orderId: number;
  orderNumber: string;
  total: number;
  carrierName: string | null;
  servicePoint: SelectedServicePoint | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const utils = trpc.useUtils();
  const confirmPayment = trpc.stripe.confirmPayment.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
    },
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage("");

    if (clientSecret === "pi_demo_secret") {
      await new Promise((r) => setTimeout(r, 1500));
      confirmPayment.mutate({ orderId });
      setMessage("success");
      setIsProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Une erreur est survenue");
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      confirmPayment.mutate({ orderId, paymentIntentId: paymentIntent.id });
      setMessage("success");
    }

    setIsProcessing(false);
  };

  if (message === "success") {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-light text-[#222222] mb-2">Paiement reussi !</h2>
        <p className="text-[0.9375rem] text-[#666666] mb-1">Commande {orderNumber}</p>
        {carrierName && (
          <p className="text-[0.8125rem] text-[#666666]">Livraison : {carrierName}</p>
        )}
        {servicePoint && (
          <p className="text-[0.8125rem] text-[#666666]">
            Point relais : {servicePoint.name}, {servicePoint.address}
          </p>
        )}
        <p className="text-[0.8125rem] text-[#999999] mt-2 mb-6">Un email de confirmation a ete envoye.</p>
        <Link
          to="/"
          className="inline-block bg-[#222222] text-white px-8 py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333]"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-[#e0e0e0] p-4 bg-white">
        <PaymentElement />
      </div>

      {message && message !== "success" && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-[0.8125rem]">{message}</div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !stripe}
        className="w-full bg-[#222222] text-white py-3.5 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <><div className="w-4 h-4 border border-white border-t-transparent animate-spin" />Traitement...</>
        ) : (
          <><ShoppingBag size={16} />Payer €{total.toFixed(2)}</>
        )}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const { data: cart } = trpc.cart.get.useQuery();
  const { data: stripeConfig } = trpc.stripe.getConfig.useQuery();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"shipping" | "payment">("shipping");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodOption | null>(null);
  const [servicePoint, setServicePoint] = useState<SelectedServicePoint | null>(null);
  const [formError, setFormError] = useState("");
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string;
    orderId: number;
    orderNumber: string;
    total: number;
  } | null>(null);

  const cartItems = cart?.items || [];
  const cartTotal = parseFloat(String(cart?.total || "0"));

  // Reglages de poids du serveur, pour calculer ici exactement la meme valeur
  // que celle qui servira a la cotation et a l'etiquette Sendcloud.
  const { data: shippingSettings } = trpc.shipping.settings.useQuery();
  const cartWeightGrams = useMemo(() => {
    // On depend de cart?.items et non de cartItems : ce dernier est un nouveau
    // tableau a chaque rendu, ce qui annulerait la memoisation.
    const items = cart?.items ?? [];
    if (!shippingSettings || items.length === 0) return 0;
    const content = items.reduce((total, item) => {
      const unit = item.product?.weightGrams ?? shippingSettings.fallbackWeightGrams;
      return total + unit * item.quantity;
    }, 0);
    return content > 0 ? content + shippingSettings.packagingWeightGrams : 0;
  }, [cart?.items, shippingSettings]);

  // Frais de port calcules par le backend (seuil de gratuite + tarif transporteur).
  const { data: quote } = trpc.shipping.quote.useQuery({
    subtotal: cartTotal,
    methodId: shippingMethod?.id,
    weightGrams: cartWeightGrams,
  });
  const shippingCost = quote?.cost ?? 0;
  const finalTotal = cartTotal + shippingCost;

  const createPayment = trpc.stripe.createPaymentIntent.useMutation({
    onSuccess: (data) => { setPaymentData(data); setStep("payment"); },
    onError: (err) => setFormError(err.message),
  });

  // Load Stripe with key from backend config
  const stripePromise = useMemo(() => {
    const key = stripeConfig?.publishableKey;
    if (key && key !== "pk_test_dummy") {
      return loadStripe(key);
    }
    return loadStripe("pk_test_dummy");
  }, [stripeConfig?.publishableKey]);

  const needsServicePoint = shippingMethod?.requiresServicePoint ?? false;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!cart?.items?.length) return;

    if (needsServicePoint && !servicePoint) {
      setFormError("Merci de choisir un point relais pour cette methode de livraison.");
      return;
    }

    const items = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      color: item.color || undefined,
      size: item.size || undefined,
    }));

    createPayment.mutate({
      amount: Math.round(finalTotal * 100),
      email,
      items,
      shipping: { firstName, lastName, address, city, postalCode, phone, country: "France" },
      shippingMethodId: shippingMethod?.id,
      servicePoint: needsServicePoint && servicePoint ? servicePoint : undefined,
    });
  };

  return (
    <div className="pt-[92px] min-h-[100dvh] bg-[#f4f4f4]">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-[0.75rem] text-[#666666] hover:text-[#222222] mb-6">
          <ChevronLeft size={14} />
          Retour
        </Link>

        <h1 className="text-2xl font-light text-[#222222] mb-8">Commander</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-8">
              <div className={`flex items-center gap-2 ${step === "shipping" ? "text-[#222222]" : "text-[#999999]"}`}>
                <span className={`w-6 h-6 flex items-center justify-center text-[0.625rem] border ${step === "shipping" ? "border-[#222222] bg-[#222222] text-white" : "border-[#999999] text-[#999999]"}`}>1</span>
                <span className="text-[0.75rem] uppercase tracking-[1px]">Livraison</span>
              </div>
              <div className="flex-1 h-[1px] bg-[#e0e0e0]" />
              <div className={`flex items-center gap-2 ${step === "payment" ? "text-[#222222]" : "text-[#999999]"}`}>
                <span className={`w-6 h-6 flex items-center justify-center text-[0.625rem] border ${step === "payment" ? "border-[#222222] bg-[#222222] text-white" : "border-[#999999] text-[#999999]"}`}>2</span>
                <span className="text-[0.75rem] uppercase tracking-[1px]">Paiement</span>
              </div>
            </div>

            {step === "shipping" ? (
              <form onSubmit={handleShippingSubmit} className="space-y-5">
                <div>
                  <label className="section-label block mb-1.5">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="section-label block mb-1.5">Prenom</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Nom</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="section-label block mb-1.5">Adresse *</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} required
                    className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="section-label block mb-1.5">Ville *</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} required
                      className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Code postal *</label>
                    <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required
                      className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="section-label block mb-1.5">Telephone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222] bg-white" />
                </div>

                {/* Mode de livraison */}
                <div className="bg-white border border-[#e8e8e8] p-5 space-y-4">
                  <h2 className="text-[0.75rem] uppercase tracking-[1px] text-[#222222]">Mode de livraison</h2>
                  <ShippingMethodSelector
                    value={shippingMethod?.id ?? null}
                    onChange={(method) => {
                      setShippingMethod(method);
                      setServicePoint(null);
                    }}
                    subtotal={cartTotal}
                    weightGrams={cartWeightGrams}
                  />
                  {needsServicePoint && shippingMethod && (
                    <ServicePointPicker
                      carrier={shippingMethod.carrier}
                      postalCode={postalCode}
                      city={city || undefined}
                      value={servicePoint}
                      onChange={setServicePoint}
                    />
                  )}
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-[0.8125rem]">
                    {formError}
                  </div>
                )}

                <button type="submit" disabled={createPayment.isPending}
                  className="w-full bg-[#222222] text-white py-3.5 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50">
                  {createPayment.isPending ? "Chargement..." : "Continuer vers le paiement"}
                </button>
              </form>
            ) : paymentData ? (
              <Elements stripe={stripePromise} options={{ clientSecret: paymentData.clientSecret, appearance: { theme: "stripe" } }}>
                <CheckoutForm
                  clientSecret={paymentData.clientSecret}
                  orderId={paymentData.orderId}
                  orderNumber={paymentData.orderNumber}
                  total={paymentData.total}
                  carrierName={
                    shippingMethod
                      ? `${carrierLabel(shippingMethod.carrier)} · ${shippingMethod.name}`
                      : null
                  }
                  servicePoint={servicePoint}
                />
              </Elements>
            ) : null}
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-[#e8e8e8] p-5 h-fit">
            <h2 className="text-[0.875rem] font-medium uppercase tracking-[1px] mb-4">Resume</h2>
            <div className="space-y-3 mb-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-3">
                  {item.product && (
                    <>
                      <div className="w-12 h-16 bg-[#f4f4f4] overflow-hidden flex-shrink-0">
                        <img src={item.product.images?.[0] || "/placeholder.png"} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.75rem] uppercase tracking-[0.5px] truncate">{item.product.name}</p>
                        <p className="text-[0.6875rem] text-[#999999]">Qte: {item.quantity}</p>
                        <p className="text-[0.75rem]">€{parseFloat(String(item.product.price)).toFixed(2)}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-[#f0f0f0] pt-3 space-y-2">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-[#666666]">Sous-total</span>
                <span>€{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-[#666666]">Livraison</span>
                <span>{quote?.free ? "Offerte" : `€${shippingCost.toFixed(2)}`}</span>
              </div>
              {cartWeightGrams > 0 && (
                <div className="flex justify-between text-[0.6875rem] text-[#999999]">
                  <span>Poids du colis</span>
                  <span>{(cartWeightGrams / 1000).toFixed(2)} kg</span>
                </div>
              )}
              {quote && !quote.free && quote.remaining > 0 && (
                <p className="text-[0.6875rem] text-[#999999]">
                  Plus que €{quote.remaining.toFixed(2)} pour la livraison offerte
                </p>
              )}
              <div className="flex justify-between text-[0.9375rem] font-medium border-t border-[#f0f0f0] pt-2">
                <span>Total</span>
                <span>€{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
