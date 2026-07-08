import type { CalendarEvent } from "./types";

function getWeeklyEvents(calendarId: string, from: Date): CalendarEvent[] {
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error(`カレンダーが見つかりません: ${calendarId}`);
  }

  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const events = calendar.getEvents(
    from as unknown as GoogleAppsScript.Base.Date,
    to as unknown as GoogleAppsScript.Base.Date,
  );

  return events.map((event) => ({
    title: event.getTitle(),
    startTime: event.getStartTime() as unknown as Date,
    endTime: event.getEndTime() as unknown as Date,
    isAllDay: event.isAllDayEvent(),
    location: event.getLocation() || undefined,
  }));
}

export { getWeeklyEvents };
