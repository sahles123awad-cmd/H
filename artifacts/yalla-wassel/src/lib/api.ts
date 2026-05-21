const getToken = () => localStorage.getItem("yw_token");

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  if (res.status !== 204 && res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  return null;
};

const jsonBody = (data: any) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  // Existing
  updateUserStatus: (id: number, status: string) =>
    fetchWithAuth(`/api/users/${id}/status`, { method: "PATCH", ...jsonBody({ status }) }),
  updateOrderStatus: (id: number, status: string) =>
    fetchWithAuth(`/api/orders/${id}/status`, { method: "PATCH", ...jsonBody({ status }) }),
  assignOrderDriver: (id: number, driverId: number) =>
    fetchWithAuth(`/api/orders/${id}/assign`, { method: "PATCH", ...jsonBody({ driverId }) }),
  markNotificationRead: (id: number) =>
    fetchWithAuth(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    fetchWithAuth(`/api/notifications/read-all`, { method: "POST" }),

  // Archive
  archiveOrder: (id: number) =>
    fetchWithAuth(`/api/orders/${id}/archive`, { method: "PATCH" }),
  unarchiveOrder: (id: number) =>
    fetchWithAuth(`/api/orders/${id}/unarchive`, { method: "PATCH" }),
  autoArchive: () =>
    fetchWithAuth(`/api/orders/auto-archive`, { method: "PATCH" }),

  // Order extras
  setDriverNote: (id: number, note: string) =>
    fetchWithAuth(`/api/orders/${id}/driver-note`, { method: "PATCH", ...jsonBody({ note }) }),
  setCustomerNote: (id: number, note: string, token: string) =>
    fetchWithAuth(`/api/orders/${id}/customer-note`, { method: "PATCH", ...jsonBody({ note, token }) }),
  rejectOrder: (id: number, reason: string) =>
    fetchWithAuth(`/api/orders/${id}/reject`, { method: "PATCH", ...jsonBody({ reason }) }),
  reportProblem: (id: number, problem: string) =>
    fetchWithAuth(`/api/orders/${id}/report-problem`, { method: "PATCH", ...jsonBody({ problem }) }),
  scheduleOrder: (id: number, scheduledFor: string | null, token: string) =>
    fetchWithAuth(`/api/orders/${id}/schedule`, { method: "PATCH", ...jsonBody({ scheduledFor, token }) }),
  cancelOrderWithReason: (id: number, reason: string) =>
    fetchWithAuth(`/api/orders/${id}/cancel-with-reason`, { method: "PATCH", ...jsonBody({ reason }) }),
  changeAddress: (id: number, toAddress: string, token: string) =>
    fetchWithAuth(`/api/orders/${id}/address`, { method: "PATCH", ...jsonBody({ toAddress, token }) }),
  ordersByPhone: (phone: string) =>
    fetchWithAuth(`/api/orders/by-phone/${encodeURIComponent(phone)}`),

  // Driver schedule
  getSchedule: (startDate: string, endDate: string) =>
    fetchWithAuth(`/api/driver-schedule?startDate=${startDate}&endDate=${endDate}`),
  setSchedule: (driverId: number, date: string, status: "working" | "off" | "sick") =>
    fetchWithAuth(`/api/driver-schedule`, { method: "POST", ...jsonBody({ driverId, date, status }) }),

  // Driver zones
  getDriverZones: (driverId: number) =>
    fetchWithAuth(`/api/drivers/${driverId}/zones`),
  setDriverZones: (driverId: number, zoneIds: number[]) =>
    fetchWithAuth(`/api/drivers/${driverId}/zones`, { method: "PUT", ...jsonBody({ zoneIds }) }),

  // Driver mgmt
  suspendDriver: (id: number) =>
    fetchWithAuth(`/api/drivers/${id}/suspend`, { method: "PATCH" }),
  reactivateDriver: (id: number) =>
    fetchWithAuth(`/api/drivers/${id}/reactivate`, { method: "PATCH" }),
  setDailyGoal: (id: number, goal: number) =>
    fetchWithAuth(`/api/drivers/${id}/daily-goal`, { method: "PATCH", ...jsonBody({ goal }) }),

  // Points & badges
  getDriverPoints: (id: number) =>
    fetchWithAuth(`/api/drivers/${id}/points`),
  getDriverBadges: (id: number) =>
    fetchWithAuth(`/api/drivers/${id}/badges`),
  awardOrder: (id: number) =>
    fetchWithAuth(`/api/orders/${id}/award`, { method: "POST" }),

  // Complaints
  fileComplaint: (data: { orderId?: number; customerPhone: string; reason: string; description?: string }) =>
    fetchWithAuth(`/api/complaints`, { method: "POST", ...jsonBody(data) }),
  listComplaints: () => fetchWithAuth(`/api/complaints`),
  resolveComplaint: (id: number) =>
    fetchWithAuth(`/api/complaints/${id}/resolve`, { method: "PATCH" }),

  // Day off
  requestDayOff: (requestedDate: string) =>
    fetchWithAuth(`/api/day-off-requests`, { method: "POST", ...jsonBody({ requestedDate }) }),
  listDayOffRequests: () => fetchWithAuth(`/api/day-off-requests`),
  updateDayOff: (id: number, status: "approved" | "rejected", note?: string) =>
    fetchWithAuth(`/api/day-off-requests/${id}`, { method: "PATCH", ...jsonBody({ status, note }) }),

  // Detailed ratings
  saveDetailedRating: (ratingId: number, data: { speedStars: number; honestyStars: number; kindnessStars: number }) =>
    fetchWithAuth(`/api/ratings/${ratingId}/detailed`, { method: "POST", ...jsonBody(data) }),

  // Driver messages
  sendDriverMessage: (message: string, isPreset = false) =>
    fetchWithAuth(`/api/driver-messages`, { method: "POST", ...jsonBody({ message, isPreset }) }),
  listDriverMessages: () => fetchWithAuth(`/api/driver-messages`),

  // Analytics
  driverComparison: () => fetchWithAuth(`/api/analytics/driver-comparison`),
  zonesHeatmap: () => fetchWithAuth(`/api/analytics/zones-heatmap`),
  peakHours: () => fetchWithAuth(`/api/analytics/peak-hours`),
  cancellationStats: () => fetchWithAuth(`/api/analytics/cancellation`),
  revenue: () => fetchWithAuth(`/api/analytics/revenue`),
  delayAlert: () => fetchWithAuth(`/api/analytics/delay-alert`),
  aiPrediction: () => fetchWithAuth(`/api/analytics/ai-prediction`),

  // Driver history
  driverHistory: (id: number, page = 1) =>
    fetchWithAuth(`/api/drivers/${id}/history?page=${page}`),

  // AI route
  optimalRoute: () => fetchWithAuth(`/api/ai/optimal-route`, { method: "POST", ...jsonBody({}) }),

  // Personal perf
  myPerformance: () => fetchWithAuth(`/api/driver/me/performance`),
};
