function resolveDailyStatus_(item, today) {
  if (!item) return CONFIG.STATUS.NO_RECORD;
  if (item.leave) return CONFIG.LEAVE_MEANS_NO_CHARGE ? CONFIG.STATUS.LEAVE : CONFIG.STATUS.UNPAID;
  if (item.paid) return CONFIG.STATUS.PAID;
  const itemKey = getBangkokDateKey_(item.date);
  return itemKey > today ? CONFIG.STATUS.UPCOMING : CONFIG.STATUS.UNPAID;
}
function buildPaymentItem_(item, today) {
  const status = resolveDailyStatus_(item, today);
  return { date: getBangkokDateKey_(item.date), displayDate: formatThaiDate_(item.date, true), status: status, amount: status === CONFIG.STATUS.LEAVE || status === CONFIG.STATUS.NO_RECORD ? 0 : item.rate, receivedDate: item.receivedDate ? formatThaiDate_(item.receivedDate, true) : null };
}
function getPaymentData_(shop, sheetName) {
  const rows = SheetRepository.getMonthData(sheetName, shop.shopName);
  const today = getBangkokDateKey_();
  const items = rows.map(function(row) { return buildPaymentItem_(row, today); });
  const summary = items.reduce(function(result, item) {
    if (item.status === CONFIG.STATUS.PAID) { result.paidDays++; result.paidAmount += item.amount || 0; }
    else if (item.status === CONFIG.STATUS.UNPAID) { result.unpaidDays++; result.unpaidAmount += item.amount || 0; }
    else if (item.status === CONFIG.STATUS.LEAVE) result.leaveDays++;
    else if (item.status === CONFIG.STATUS.UPCOMING) result.futureDays++;
    return result;
  }, { paidDays: 0, unpaidDays: 0, leaveDays: 0, futureDays: 0, paidAmount: 0, unpaidAmount: 0 });
  const todayItem = items.find(function(item) { return item.date === today; }) || null;
  return { month: sheetName, items: items, today: todayItem || { date: today, displayDate: formatThaiDate_(getBangkokNow_(), false), status: CONFIG.STATUS.NO_RECORD, amount: 0, receivedDate: null }, summary: summary };
}
function getTotalOutstanding_(shop) {
  return SheetRepository.getAllowedMonthlySheets().reduce(function(total, sheetName) {
    return total + getPaymentData_(shop, sheetName).summary.unpaidAmount;
  }, 0);
}
function getDashboard_(idToken) {
  const auth = requireAuthenticatedShop_(idToken);
  const data = getPaymentData_(auth.shop, getMonthSheetName_());
  return { shop: { shopId: auth.shop.shopId, shopName: auth.shop.shopName }, today: data.today, summary: data.summary, totalOutstanding: getTotalOutstanding_(auth.shop), items: data.items, updatedAt: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm') };
}
function getHistory_(idToken, requestedMonth) {
  const auth = requireAuthenticatedShop_(idToken);
  const month = requestedMonth || getMonthSheetName_();
  const data = getPaymentData_(auth.shop, month);
  return { month: data.month, items: data.items };
}
function getAvailableMonths_(idToken) {
  requireAuthenticatedShop_(idToken);
  return SheetRepository.getAllowedMonthlySheets().map(function(name) { return { id: name, label: name }; });
}
