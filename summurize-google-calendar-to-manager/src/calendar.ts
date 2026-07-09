import type { CalendarEvent } from "./types";

function getCurrentWeekMonday(): Date {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday;
}

function getWeeklyEvents(from: Date): CalendarEvent[] {
  const calendar = CalendarApp.getDefaultCalendar();

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

export { getCurrentWeekMonday, getWeeklyEvents };
