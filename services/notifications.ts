import {
  createNotification,
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  getPOs,
  getStoreStock,
  getDemands,
  getTransfers,
  getDb,
} from '../db/database';

export { getNotifications, markRead, markAllRead, getUnreadCount };

/**
 * generateAutoNotifications — runs checks and creates notifications
 * for actionable events in the system.
 */
export async function generateAutoNotifications(): Promise<void> {
  const db = { getPOs, getStoreStock, getDemands, getTransfers };

  // 1. POs dispatched but no GRN started
  try {
    const pos = await db.getPOs();
    const dispatched = pos.filter((p) => p.status === 'dispatched' && !p.is_deleted);
    for (const po of dispatched) {
      const dispatchDate = po.dispatch_date ? new Date(po.dispatch_date) : null;
      const daysAgo = dispatchDate
        ? Math.floor((Date.now() - dispatchDate.getTime()) / 86400000)
        : 0;
      if (daysAgo >= 3) {
        const oneDayAgo = new Date(Date.now() - 24*60*60*1000).toISOString();
        const exists = await getDb().getFirstAsync('SELECT id FROM notifications WHERE reference_type = ? AND reference_id = ? AND created_at > ?', ['po', po.id, oneDayAgo]);
        if (!exists) {
          await createNotification(
            'grn_due',
            `GRN overdue: ${po.po_number}`,
            `PO ${po.po_number} was dispatched ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago. Start receiving.`,
            'po',
            po.id,
          );
        }
      }
    }
  } catch { /* skip if table not ready */ }

  // 2. Low stock across stores
  try {
    const stock = await db.getStoreStock();
    const lowItems = stock.filter((s) => s.total_qty > 0 && s.total_qty < 5);
    for (const item of lowItems) {
      const name = item.design_name ?? item.product_id;
      await createNotification(
        'stock_low',
        `Low stock: ${name}`,
        `Only ${item.total_qty} unit${item.total_qty !== 1 ? 's' : ''} left at ${item.store_name ?? 'store'}.`,
        'product',
        item.product_id,
      );
    }
  } catch { /* skip */ }

  // 3. Open demands older than 7 days
  try {
    const demands = await db.getDemands(undefined, 'open');
    for (const d of demands) {
      const daysOld = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
      if (daysOld >= 7) {
        const customer = d.customer_name ?? d.customer_phone ?? 'Customer';
        await createNotification(
          'demand_match',
          `Old demand: ${customer}`,
          `"${d.description.slice(0, 60)}" has been open for ${daysOld} days.`,
          'demand',
          String(d.id),
        );
      }
    }
  } catch { /* skip */ }

  // 4. Transfers requested (awaiting approval)
  try {
    const transfers = await db.getTransfers(undefined, 'requested');
    for (const t of transfers) {
      const name = t.design_name ?? t.product_id;
      await createNotification(
        'transfer',
        `Transfer pending: ${name}`,
        `${t.total_qty} units from ${t.from_store_name ?? 'store'} → ${t.to_store_name ?? 'store'} awaiting approval.`,
        'transfer',
        String(t.id),
      );
    }
  } catch { /* skip */ }

  // 5. Welcome notification if no notifications exist at all
  try {
    const any = await getDb().getFirstAsync<{id: number}>('SELECT id FROM notifications LIMIT 1');
    if (!any) {
      await createNotification('system', 'Welcome to VASTRA', 'Your merchandise intelligence platform is ready. Start by scanning your first product!', undefined, undefined);
    }
  } catch { /* skip */ }
}
