import { http } from "@/lib/http";
import type { AppNotification } from "@/types/notifications";

export async function getNotifications(): Promise<AppNotification[]> {
  return http.get<AppNotification[]>("/notifications");
}

export async function marquerNotificationLue(id: string): Promise<void> {
  await http.patch(`/notifications/${id}/lue`, {});
}

export async function marquerToutesNotificationsLues(): Promise<void> {
  await http.patch(`/notifications/toutes-lues`, {});
}
