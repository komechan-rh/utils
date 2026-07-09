type CalendarEvent = {
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
};

type LineTextMessage = {
  type: "text";
  text: string;
};

export type { CalendarEvent, LineTextMessage };
