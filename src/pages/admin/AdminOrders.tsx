import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { ChevronDown } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  shipped: "Expedie",
  delivered: "Livre",
  cancelled: "Annule",
};

const statusOptions = ["pending", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: ordersData, isLoading } = trpc.order.list.useQuery(
    statusFilter ? { status: statusFilter, page: 1, limit: 50 } : { page: 1, limit: 50 }
  );
  const utils = trpc.useUtils();
  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => utils.order.list.invalidate(),
  });

  const { data: orderDetail } = trpc.order.getById.useQuery(
    { id: expandedOrder! },
    { enabled: !!expandedOrder }
  );

  const orders = ordersData?.orders || [];

  return (
    <div>
      <h1 className="text-2xl font-light text-[#222222] mb-6">Commandes</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222] bg-white"
        >
          <option value="">Tous les statuts</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">#</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Client</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Date</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Total</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune commande</td>
              </tr>
            ) : (
              orders.map((order) => (
                <>
                  <tr
                    key={order.id}
                    className="border-b border-[#f8f8f8] hover:bg-[#fafafa] cursor-pointer"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <td className="px-4 py-3 text-[0.8125rem] font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">
                      {order.firstName} {order.lastName || order.email}
                    </td>
                    <td className="px-4 py-3 text-[0.75rem] text-[#999999]">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] font-medium">
                      €{parseFloat(order.total as string).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status || ""}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateStatus.mutate({ id: order.id, status: e.target.value as any });
                        }}
                        className={`text-[0.625rem] uppercase tracking-[1px] px-2 py-1 border-0 cursor-pointer ${statusColors[order.status || ""]}`}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>{statusLabels[s] || s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronDown
                        size={14}
                        className={`text-[#999999] transition-transform ${expandedOrder === order.id ? "rotate-180" : ""}`}
                      />
                    </td>
                  </tr>
                  {expandedOrder === order.id && orderDetail && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 bg-[#fafafa]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] mb-2">Articles</h4>
                            {orderDetail.items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between py-1 text-[0.75rem]">
                                <span>{item.productName} x{item.quantity}</span>
                                <span>€{parseFloat(item.totalPrice as string).toFixed(2)}</span>
                              </div>
                            )) || <p className="text-[0.75rem] text-[#999999]">Non disponible</p>}
                            <div className="border-t border-[#e0e0e0] mt-2 pt-2 flex justify-between text-[0.75rem] font-medium">
                              <span>Total</span>
                              <span>€{parseFloat(orderDetail.total as string).toFixed(2)}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] mb-2">Livraison</h4>
                            <p className="text-[0.75rem] text-[#666666]">
                              {orderDetail.address}<br />
                              {orderDetail.postalCode} {orderDetail.city}<br />
                              {orderDetail.country}
                            </p>
                            {orderDetail.phone && (
                              <p className="text-[0.75rem] text-[#666666] mt-1">{orderDetail.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
