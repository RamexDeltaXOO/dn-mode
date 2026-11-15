import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { carrierLabel } from "@contracts/constants";
import { pageTitle } from "@contracts/seo";
import { useSeo } from "@/hooks/useSeo";
import { trpc } from "@/providers/trpc";
import { ArrowRight, ChevronLeft, Check, LockKeyhole, MapPin, PackageCheck, ShoppingBag } from "lucide-react";
import ShippingMethodSelector from "@/components/ShippingMethodSelector";
import type { ShippingMethodOption } from "@/components/ShippingMethodSelector";
import ServicePointPicker from "@/components/ServicePointPicker";
import type { SelectedServicePoint } from "@/components/ServicePointPicker";

function PaymentSuccess({ orderNumber, carrierName, servicePoint }: {
  orderNumber: string;
  carrierName: string | null;
  servicePoint: string | null;
}) {
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
        <p className="text-[0.8125rem] text-[#666666]">Point relais : {servicePoint}</p>
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

/**
 * Retour sur /checkout apres un moyen de paiement qui redirige (PayPal,
 * Klarna...). Stripe ajoute payment_intent et redirect_status a l'URL : on
 * fait confirmer la commande par le serveur, qui verifie le paiement aupres
 * de Stripe avant de la valider.
 */
function PaymentReturn({ paymentIntentId, redirectStatus }: { paymentIntentId: string; redirectStatus: string | null }) {
  const utils = trpc.useUtils();
  const clearCart = trpc.cart.clear.useMutation({ onSuccess: () => utils.cart.get.invalidate() });
  const confirmPayment = trpc.stripe.confirmPayment.useMutation({ onSuccess: () => clearCart.mutate() });
  const started = useRef(false);

  useEffect(() => {
    if (started.current || redirectStatus !== "succeeded") return;
    started.current = true;
    confirmPayment.mutate({ paymentIntentId });
  }, [paymentIntentId, redirectStatus, confirmPayment]);

  const backToCheckout = (
    <Link
      to="/checkout"
      className="inline-block bg-[#222222] text-white px-8 py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] mt-6"
    >
      Revenir au paiement
    </Link>
  );

  if (redirectStatus === "processing") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-light text-[#222222] mb-2">Paiement en cours de validation</h2>
        <p className="text-[0.8125rem] text-[#666666]">
          Ton moyen de paiement doit encore valider l&apos;operation. Tu recevras un email des qu&apos;elle sera confirmee.
        </p>
      </div>
    );
  }

  if (redirectStatus !== "succeeded" || confirmPayment.isError) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-light text-[#222222] mb-2">Le paiement n&apos;a pas abouti</h2>
        <p className="text-[0.8125rem] text-[#666666]">
          {confirmPayment.error?.message ?? "Aucun montant n'a ete preleve. Tu peux reessayer avec un autre moyen de paiement."}
        </p>
        {backToCheckout}
      </div>
    );
  }

  const order = confirmPayment.data?.order;
  if (!order) {
    return (
      <div className="py-12 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin" />
        <p className="text-[0.8125rem] text-[#666666]">Confirmation du paiement...</p>
      </div>
    );
  }

  return (
    <PaymentSuccess
      orderNumber={order.orderNumber}
      carrierName={
        order.shippingCarrier
          ? `${carrierLabel(order.shippingCarrier)}${order.shippingMethodName ? ` · ${order.shippingMethodName}` : ""}`
          : null
      }
      servicePoint={
        order.servicePointName ? [order.servicePointName, order.servicePointAddress].filter(Boolean).join(", ") : null
      }
    />
  );
}

function CheckoutForm({ clientSecret, orderId, confirmToken, orderNumber, total, carrierName, servicePoint }: {
  clientSecret: string;
  orderId: number;
  confirmToken: string;
  orderNumber: string;
  total: number;
  carrierName: string | null;
  servicePoint: SelectedServicePoint | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const utils = trpc.useUtils();
  const clearCart = trpc.cart.clear.useMutation({ onSuccess: () => utils.cart.get.invalidate() });
  const confirmPayment = trpc.stripe.confirmPayment.useMutation({
    onSuccess: () => clearCart.mutate(),
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [acceptedCgv, setAcceptedCgv] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !acceptedCgv || isProcessing) return;

    setIsProcessing(true);
    setMessage("");

    try {
      if (clientSecret === "pi_demo_secret") {
        // Ne jamais afficher une confirmation avant la validation serveur.
        const result = await confirmPayment.mutateAsync({ orderId, confirmToken });
        if (!result.order) throw new Error("La commande n'a pas pu etre confirmee.");
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.origin + "/checkout" },
        redirect: "if_required",
      });
      if (error) throw new Error(error.message || "Le paiement a echoue.");

      if (paymentIntent?.status === "succeeded") {
        const result = await confirmPayment.mutateAsync({ orderId, paymentIntentId: paymentIntent.id });
        if (!result.order) throw new Error("Impossible de confirmer la commande apres le paiement.");
      } else if (paymentIntent?.status === "processing") {
        setMessage("Votre paiement est en cours de verification. Ne recommencez pas tout de suite.");
      } else {
        setMessage("Le paiement n'est pas confirme. Veuillez verifier votre moyen de paiement.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (confirmPayment.data?.order) {
    return (
      <PaymentSuccess
        orderNumber={confirmPayment.data.order.orderNumber}
        carrierName={carrierName}
        servicePoint={servicePoint ? servicePoint.name + ", " + servicePoint.address : null}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-[#e0e0e0] p-4 bg-white">
        <PaymentElement />
      </div>

      <label className="flex items-start gap-3 text-[0.8125rem] leading-relaxed text-[#555555] cursor-pointer">
        <input
          type="checkbox"
          required
          checked={acceptedCgv}
          onChange={(event) => setAcceptedCgv(event.target.checked)}
          className="mt-1 shrink-0 accent-[#222222]"
        />
        <span>
          J'ai lu et j'accepte les{" "}
          <Link to="/cgv" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 text-[#222222]">
            conditions générales de vente
          </Link>
          , notamment les informations sur le droit de rétractation.
        </span>
      </label>

      {message && message !== "success" && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-[0.8125rem]">{message}</div>
      )}

      <button
        type="submit"
        disabled={isProcessing || confirmPayment.isPending || !stripe || !acceptedCgv}
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
  const [params] = useSearchParams();
  useSeo((site) => ({ title: pageTitle("Commande", site.siteName), noindex: true }));
  const paymentIntentId = params.get("payment_intent");

  if (paymentIntentId) {
    return (
      <div className="pt-[92px] min-h-[100dvh] bg-[#f4f4f4]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
          <PaymentReturn paymentIntentId={paymentIntentId} redirectStatus={params.get("redirect_status")} />
        </div>
      </div>
    );
  }

  return <CheckoutFlow />;
}


type CheckoutStep = "contact" | "delivery" | "payment";
const checkoutSteps: Array<{ key: CheckoutStep; label: string }> = [
  { key: "contact", label: "Coordonnees" },
  { key: "delivery", label: "Livraison" },
  { key: "payment", label: "Paiement" },
];

const inputClass = "w-full rounded-none border border-[#dddddd] bg-white px-3.5 py-3 text-[0.875rem] text-[#222222] outline-none transition-colors focus:border-[#222222]";
const fieldLabelClass = "mb-1.5 block text-[0.75rem] font-medium text-[#555555]";
const euro = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function CheckoutFlow() {
  const { data: cart, isLoading: cartLoading } = trpc.cart.get.useQuery();
  const { data: stripeConfig } = trpc.stripe.getConfig.useQuery();
  // Conserver le recapitulatif apres la confirmation, meme une fois le panier vide.
  const [paymentSnapshot, setPaymentSnapshot] = useState<NonNullable<typeof cart> | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<CheckoutStep>("contact");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodOption | null>(null);
  const [servicePoint, setServicePoint] = useState<SelectedServicePoint | null>(null);
  const [formError, setFormError] = useState("");
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string;
    orderId: number;
    confirmToken: string;
    orderNumber: string;
    total: number;
  } | null>(null);

  const displayCart = cart?.items?.length ? cart : paymentSnapshot;
  const cartItems = displayCart?.items ?? [];
  const cartTotal = Number.parseFloat(String(displayCart?.total || "0")) || 0;
  const { data: shippingSettings } = trpc.shipping.settings.useQuery();
  const cartWeightGrams = useMemo(() => {
    const items = displayCart?.items ?? [];
    if (!shippingSettings || items.length === 0) return 0;
    const contentWeight = items.reduce((sum, item) => {
      const declared = item.product?.weightGrams ?? 0;
      const unitWeight = declared > 0 ? declared : shippingSettings.fallbackWeightGrams;
      return sum + unitWeight * item.quantity;
    }, 0);
    return contentWeight > 0 ? contentWeight + shippingSettings.packagingWeightGrams : 0;
  }, [displayCart?.items, shippingSettings]);

  const { data: quote, isFetching: quoteLoading } = trpc.shipping.quote.useQuery(
    { subtotal: cartTotal, methodId: shippingMethod?.id, weightGrams: cartWeightGrams },
    { enabled: shippingMethod !== null },
  );
  const quoteMatchesMethod = !!shippingMethod && quote?.methodId === shippingMethod.id && !quote.weightOutOfRange;
  const shippingCost = quoteMatchesMethod ? quote.cost : null;
  const total = cartTotal + (shippingCost ?? 0);

  const createPayment = trpc.stripe.createPaymentIntent.useMutation({
    onSuccess: (data) => {
      setPaymentSnapshot(cart ?? null);
      setPaymentData(data);
      setStep("payment");
      setFormError("");
    },
    onError: (error) => setFormError(error.message),
  });
  const stripePromise = useMemo(() => {
    const key = stripeConfig?.publishableKey;
    return key && key !== "pk_test_dummy" ? loadStripe(key) : null;
  }, [stripeConfig?.publishableKey]);

  const activeIndex = checkoutSteps.findIndex((item) => item.key === step);
  const needsServicePoint = Boolean(shippingMethod?.requiresServicePoint);

  const updateAddress = (update: () => void) => {
    update();
    setServicePoint(null);
    setPaymentData(null);
    setPaymentSnapshot(null);
  };

  const goBack = (target: CheckoutStep) => {
    if (checkoutSteps.findIndex((item) => item.key === target) >= activeIndex) return;
    setPaymentData(null);
    setPaymentSnapshot(null);
    setFormError("");
    setStep(target);
  };

  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setStep("delivery");
  };

  const submitDelivery = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!cart?.items?.length) {
      setFormError("Votre panier est vide.");
      return;
    }
    if (!shippingMethod) {
      setFormError("Selectionnez un mode de livraison pour continuer.");
      return;
    }
    if (quoteLoading || !quoteMatchesMethod || shippingCost === null) {
      setFormError("Le tarif de livraison n'est pas encore disponible. Veuillez reessayer.");
      return;
    }
    if (needsServicePoint && !servicePoint) {
      setFormError("Choisissez votre point relais avant de continuer.");
      return;
    }
    createPayment.mutate({
      amount: Math.round(total * 100),
      email: email.trim(),
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        color: item.color || undefined,
        size: item.size || undefined,
      })),
      shipping: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        phone: phone.trim(),
        country: "France",
      },
      shippingMethodId: shippingMethod.id,
      servicePoint: needsServicePoint && servicePoint ? servicePoint : undefined,
    });
  };

  if (cartLoading) {
    return <div className="min-h-[100dvh] pt-[140px] text-center text-[#666666]">Chargement de votre panier...</div>;
  }
  if (!cartItems.length && step !== "payment") {
    return (
      <div className="min-h-[100dvh] pt-[140px] px-4 text-center">
        <ShoppingBag size={36} className="mx-auto mb-5 text-[#999999]" />
        <h1 className="text-2xl font-light mb-4">Votre panier est vide</h1>
        <Link to="/" className="inline-block bg-[#222222] px-6 py-3 text-white text-[0.75rem] uppercase tracking-[1px]">
          Retour a la boutique
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f7f7f7] pt-[92px] text-[#222222]">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-7 sm:py-10">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-[0.75rem] text-[#666666] hover:text-[#222222]">
          <ChevronLeft size={14} /> Continuer mes achats
        </Link>
        <div className="flex items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light">Finaliser ma commande</h1>
            <p className="text-[0.8125rem] text-[#777777] mt-1">Trois etapes simples avant de recevoir vos articles.</p>
          </div>
          <LockKeyhole size={21} className="text-[#888888] shrink-0" aria-label="Paiement securise" />
        </div>

        <nav aria-label="Etapes de commande" className="mb-8 flex items-center w-full">
          {checkoutSteps.map((item, index) => {
            const completed = index < activeIndex;
            const current = index === activeIndex;
            return (
              <div key={item.key} className="contents">
                {index > 0 && <span aria-hidden="true" className={"mx-2 sm:mx-4 h-px flex-1 " + (completed ? "bg-[#222222]" : "bg-[#dddddd]")} />}
                <button type="button" onClick={() => goBack(item.key)}
                  disabled={!completed} aria-current={current ? "step" : undefined}
                  className={"flex min-w-0 items-center gap-1.5 sm:gap-2 text-left " +
                    (current || completed ? "text-[#222222]" : "text-[#a3a3a3]") +
                    (completed ? " cursor-pointer" : " cursor-default")}>
                  <span className={"flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center border text-[0.75rem] " +
                    (current ? "border-[#222222] bg-[#222222] text-white" :
                      completed ? "border-[#222222] text-[#222222]" : "border-[#d6d6d6]")}>
                    {completed ? <Check size={15} /> : index + 1}
                  </span>
                  <span className="text-[0.6875rem] sm:text-[0.8125rem] font-medium">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 items-start">
          <section aria-label="Informations de commande" className="min-w-0">
            {step === "contact" && (
              <form onSubmit={submitContact} className="bg-white border border-[#e4e4e4] p-5 sm:p-7 space-y-5">
                <div className="border-b border-[#eeeeee] pb-4">
                  <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#888888]">Etape 1 sur 3</p>
                  <h2 className="text-xl font-light mt-1">Vos coordonnees</h2>
                  <p className="text-[0.8125rem] text-[#777777] mt-1">Pour vous envoyer la confirmation et preparer la livraison.</p>
                </div>
                <div>
                  <label htmlFor="checkout-email" className={fieldLabelClass}>Adresse e-mail *</label>
                  <input id="checkout-email" type="email" autoComplete="email" required value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="exemple@email.com" className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="checkout-first" className={fieldLabelClass}>Prenom *</label>
                    <input id="checkout-first" autoComplete="given-name" required value={firstName}
                      onChange={(event) => setFirstName(event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="checkout-last" className={fieldLabelClass}>Nom *</label>
                    <input id="checkout-last" autoComplete="family-name" required value={lastName}
                      onChange={(event) => setLastName(event.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="checkout-address" className={fieldLabelClass}>Adresse et numero de rue *</label>
                  <input id="checkout-address" autoComplete="street-address" required minLength={5} value={address}
                    onChange={(event) => updateAddress(() => setAddress(event.target.value))}
                    placeholder="12 rue de la Paix" className={inputClass} />
                  <p className="mt-1.5 text-[0.6875rem] text-[#888888]">
                    Elle permet aussi de trouver les points relais les plus proches.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="checkout-postal" className={fieldLabelClass}>Code postal *</label>
                    <input id="checkout-postal" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}"
                      title="Saisissez un code postal francais a 5 chiffres" required value={postalCode}
                      onChange={(event) => updateAddress(() => setPostalCode(event.target.value))}
                      placeholder="75001" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="checkout-city" className={fieldLabelClass}>Ville *</label>
                    <input id="checkout-city" autoComplete="address-level2" required minLength={2} value={city}
                      onChange={(event) => updateAddress(() => setCity(event.target.value))}
                      className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="checkout-phone" className={fieldLabelClass}>Telephone *</label>
                  <input id="checkout-phone" type="tel" autoComplete="tel" required minLength={10} value={phone}
                    onChange={(event) => setPhone(event.target.value)} placeholder="06 12 34 56 78" className={inputClass} />
                </div>
                <button type="submit" className="w-full bg-[#222222] text-white py-3.5 px-4 flex items-center justify-center gap-2 text-[0.8125rem] font-medium hover:bg-[#333333]">
                  Continuer vers la livraison <ArrowRight size={16} />
                </button>
              </form>
            )}

            {step === "delivery" && (
              <div className="space-y-4">
                <div className="bg-white border border-[#e4e4e4] p-4 sm:p-5 flex justify-between gap-3 items-start">
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#888888] mb-1">Coordonnees</p>
                    <p className="text-[0.8125rem] text-[#222222]">{firstName} {lastName} · {email}</p>
                    <p className="text-[0.75rem] text-[#666666] mt-1">{address}, {postalCode} {city}</p>
                  </div>
                  <button type="button" onClick={() => goBack("contact")}
                    className="text-[0.75rem] underline underline-offset-4 shrink-0">Modifier</button>
                </div>
                <form onSubmit={submitDelivery} className="bg-white border border-[#e4e4e4] p-5 sm:p-7 space-y-5">
                  <div className="border-b border-[#eeeeee] pb-4">
                    <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#888888]">Etape 2 sur 3</p>
                    <h2 className="text-xl font-light mt-1">Comment souhaitez-vous etre livre ?</h2>
                    <p className="text-[0.8125rem] text-[#777777] mt-1">
                      Choisissez une livraison a domicile ou en point relais. Le tarif est calcule selon votre panier.
                    </p>
                  </div>

                  <ShippingMethodSelector
                    value={shippingMethod?.id ?? null}
                    onChange={(method) => { setShippingMethod(method); setServicePoint(null); setFormError(""); }}
                    subtotal={cartTotal}
                    weightGrams={cartWeightGrams}
                  />

                  {needsServicePoint && shippingMethod && (
                    <ServicePointPicker
                      key={shippingMethod.id}
                      carrier={shippingMethod.carrier}
                      address={address}
                      postalCode={postalCode}
                      city={city}
                      value={servicePoint}
                      onChange={setServicePoint}
                    />
                  )}

                  {needsServicePoint && !servicePoint && (
                    <p className="text-[0.75rem] text-[#666666]">
                      Selectionnez un relais dans la liste pour activer le paiement.
                    </p>
                  )}

                  {!shippingMethod && (
                    <p className="flex items-center gap-2 text-[0.75rem] text-[#777777]">
                      <MapPin size={14} /> Selectionnez une option pour voir les details de livraison.
                    </p>
                  )}

                  {shippingMethod && shippingCost !== null && (
                    <div className="bg-[#f7f7f7] p-3 text-[0.8125rem] flex items-center justify-between gap-3">
                      <span>Livraison · {shippingMethod.name}</span>
                      <span className="font-medium">{quote?.free ? "Offerte" : euro(shippingCost)}</span>
                    </div>
                  )}

                  {formError && (
                    <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-[0.8125rem] text-red-700">{formError}</div>
                  )}

                  <button type="submit"
                    disabled={createPayment.isPending || !shippingMethod || quoteLoading || !quoteMatchesMethod || (needsServicePoint && !servicePoint)}
                    className="w-full bg-[#222222] text-white py-3.5 px-4 flex items-center justify-center gap-2 text-[0.8125rem] font-medium hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
                    {createPayment.isPending ? "Preparation du paiement..." : "Continuer vers le paiement"} <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            )}

            {step === "payment" && paymentData && (
              <div className="space-y-4">
                <div className="border border-[#e4e4e4] bg-white px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#888888]">Contact et livraison</p>
                      <p className="text-[0.8125rem] text-[#222222] mt-2">{email}</p>
                      <p className="text-[0.75rem] text-[#666666] mt-1">{shippingMethod?.name}</p>
                      {servicePoint && <p className="text-[0.75rem] text-[#666666] mt-1">{servicePoint.name} · {servicePoint.address}</p>}
                      {!servicePoint && <p className="text-[0.75rem] text-[#666666] mt-1">{address}, {postalCode} {city}</p>}
                    </div>
                    <button type="button" onClick={() => goBack("delivery")}
                      className="text-[0.75rem] underline underline-offset-4 shrink-0">Modifier</button>
                  </div>
                </div>
                <div className="bg-white border border-[#e4e4e4] p-5 sm:p-7">
                  <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#888888]">Etape 3 sur 3</p>
                  <h2 className="text-xl font-light mt-1 mb-2">Paiement securise</h2>
                  <p className="text-[0.8125rem] text-[#777777] mb-5">Verifiez votre commande puis choisissez votre moyen de paiement.</p>
                  {paymentData.clientSecret === "pi_demo_secret" ||
                  !stripeConfig?.publishableKey || stripeConfig.publishableKey === "pk_test_dummy" ? (
                    <p role="alert" className="border border-amber-200 bg-amber-50 p-4 text-[0.8125rem] text-[#66502d]">
                      Le paiement en ligne est temporairement indisponible. Votre commande n'est pas confirmee,
                      aucun paiement n'a ete effectue. Veuillez reessayer plus tard.
                    </p>
                  ) : (
                    <Elements stripe={stripePromise} options={{
                      clientSecret: paymentData.clientSecret,
                      appearance: { theme: "stripe" },
                    }}>
                      <CheckoutForm
                        clientSecret={paymentData.clientSecret}
                        orderId={paymentData.orderId}
                        confirmToken={paymentData.confirmToken}
                        orderNumber={paymentData.orderNumber}
                        total={paymentData.total}
                        carrierName={shippingMethod ? carrierLabel(shippingMethod.carrier) + " · " + shippingMethod.name : null}
                        servicePoint={servicePoint}
                      />
                    </Elements>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="bg-white border border-[#e4e4e4] p-5 sm:p-6 h-fit lg:sticky lg:top-[110px]" aria-label="Recapitulatif de commande">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[0.875rem] font-medium">Votre commande</h2>
              <span className="text-[0.75rem] text-[#888888]">{cartItems.length} article{cartItems.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-4 pb-5">
              {cartItems.map((item) => item.product && (
                <div key={item.id} className="flex gap-3">
                  <div className="h-20 w-16 shrink-0 bg-[#f5f5f5] overflow-hidden">
                    <img src={item.product.images?.[0] || "/placeholder.png"} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.75rem] text-[#222222] font-medium">{item.product.name}</p>
                    <p className="text-[0.6875rem] text-[#888888] mt-1">Quantite : {item.quantity}</p>
                    {(item.color || item.size) && (
                      <p className="text-[0.6875rem] text-[#888888]">{[item.color, item.size].filter(Boolean).join(" · ")}</p>
                    )}
                    <p className="text-[0.75rem] mt-2">{euro(Number(item.product.price) * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#ededed] pt-4 space-y-3">
              <div className="flex justify-between gap-3 text-[0.8125rem]">
                <span className="text-[#666666]">Sous-total</span>
                <span>{euro(cartTotal)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[0.8125rem]">
                <span className="text-[#666666]">Livraison</span>
                <span className="text-right">
                  {shippingCost === null ? "A choisir" : quote?.free ? "Offerte" : euro(shippingCost)}
                </span>
              </div>
              {shippingMethod && <p className="text-[0.75rem] text-[#888888]">{shippingMethod.name}</p>}
              {servicePoint && <p className="text-[0.75rem] text-[#888888]">Relais : {servicePoint.name}</p>}
              {quote && !quote.free && quote.remaining > 0 && (
                <p className="text-[0.6875rem] text-[#888888]">
                  Encore {euro(quote.remaining)} pour la livraison offerte.
                </p>
              )}
              <div className="flex justify-between gap-3 border-t border-[#ededed] pt-4 text-base font-medium">
                <span>Total</span>
                <span>{shippingCost === null ? "A calculer" : euro(step === "payment" && paymentData ? paymentData.total : total)}</span>
              </div>
              <p className="flex items-center gap-2 text-[0.6875rem] text-[#888888] pt-2">
                <PackageCheck size={15} /> Livraison en France metropolitaine
              </p>
              <p className="flex items-center gap-2 text-[0.6875rem] text-[#888888]">
                <LockKeyhole size={15} /> Paiement securise
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
