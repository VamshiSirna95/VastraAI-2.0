import { getDeliveryConfig } from '../db/database';

export interface DeliverySchedule {
  urgency: 'CRITICAL' | 'URGENT' | 'PLAN' | 'EXCESS';
  urgencyColor: string;
  stockCoverDays: number;
  deficitDays: number;
  vendorDispatchDate: Date;
  warehouseArrivalDate: Date;
  storeShelfDate: Date;
  message: string;
}

export async function calculateDelivery(
  currentStock: number,
  dailyAvgSales: number,
): Promise<DeliverySchedule> {
  const config = await getDeliveryConfig();

  const stockCoverDays = dailyAvgSales > 0
    ? Math.round(currentStock / dailyAvgSales)
    : 999;

  const deficitDays = config.optimal_stock_cover_days - stockCoverDays;

  let urgency: DeliverySchedule['urgency'];
  let urgencyColor: string;
  let message: string;

  if (stockCoverDays < 30) {
    urgency = 'CRITICAL';
    urgencyColor = '#E24B4A';
    message = 'Immediate reorder — expedited delivery needed';
  } else if (stockCoverDays < 45) {
    urgency = 'URGENT';
    urgencyColor = '#EF9F27';
    message = 'Order within this week';
  } else if (stockCoverDays < 60) {
    urgency = 'PLAN';
    urgencyColor = '#7F77DD';
    message = 'Include in next purchase trip';
  } else {
    urgency = 'EXCESS';
    urgencyColor = '#5DCAA5';
    message = 'Sufficient stock — no reorder needed';
  }

  const today = new Date();
  const netDays = Math.max(
    deficitDays - config.vendor_transit_days - config.inward_processing_days - config.store_dispatch_days,
    1
  );

  const warehouseArrival = new Date(today);
  warehouseArrival.setDate(today.getDate() + netDays);

  const vendorDispatch = new Date(warehouseArrival);
  vendorDispatch.setDate(warehouseArrival.getDate() - config.vendor_transit_days);

  const storeShelf = new Date(warehouseArrival);
  storeShelf.setDate(warehouseArrival.getDate() + config.inward_processing_days + config.store_dispatch_days);

  return {
    urgency,
    urgencyColor,
    stockCoverDays,
    deficitDays,
    vendorDispatchDate: vendorDispatch,
    warehouseArrivalDate: warehouseArrival,
    storeShelfDate: storeShelf,
    message,
  };
}

// Format date as DD-Mon-YYYY
export function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
}
