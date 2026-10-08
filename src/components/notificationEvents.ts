/** Fired when something just happened that the header bell should pick up right away (e.g. an
 * order was booked), instead of waiting for its next 30-second poll. */
export const NOTIFICATIONS_REFRESH_EVENT = 'hx:notifications-refresh'

export function requestNotificationsRefresh(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT))
}
