/**
 * Google Calendar Service
 * Handles availability checking and appointment booking
 */

const { google } = require('googleapis');
const { DateTime } = require('luxon');

class CalendarService {
  constructor() {
    // Validate env vars before using
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error('GOOGLE_CLIENT_EMAIL not configured');
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('GOOGLE_PRIVATE_KEY not configured');
    }
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error('GOOGLE_CALENDAR_ID not configured');
    }

    // Initialize with service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      },
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ]
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.calendarId = process.env.GOOGLE_CALENDAR_ID;
  }

  /**
   * Check available time slots
   * @param {Object} options
   * @param {number} options.daysAhead - How many days to check
   * @param {number} options.durationMinutes - Meeting duration
   * @param {string} options.timezone - Target timezone (default Europe/London)
   * @returns {Promise<Array>} Available slots
   */
  async checkAvailability({ daysAhead = 5, durationMinutes = 30, timezone = 'Europe/London' }) {
    const now = DateTime.now().setZone(timezone);
    const endDate = now.plus({ days: daysAhead });

    // Get busy times from calendar
    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISO(),
        timeMax: endDate.toISO(),
        timeZone: timezone,
        items: [{ id: this.calendarId }]
      }
    });

    const busyTimes = response.data.calendars[this.calendarId].busy;
    const slots = this._generateAvailableSlots(
      now,
      endDate,
      busyTimes,
      durationMinutes,
      timezone
    );

    return slots.slice(0, 6); // Return top 6 slots
  }

  /**
   * Generate available slots avoiding busy times
   */
  _generateAvailableSlots(startDate, endDate, busyTimes, durationMinutes, timezone) {
    const slots = [];
    let current = startDate.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    
    // Round to next hour if we're past 9 AM
    if (current < startDate) {
      current = startDate.plus({ hours: 1 }).set({ minute: 0 });
    }

    const endTime = endDate.set({ hour: 17, minute: 0 });
    const duration = { minutes: durationMinutes };

    while (current < endTime && slots.length < 10) {
      const slotEnd = current.plus(duration);
      const dayOfWeek = current.weekday;

      // Skip weekends
      if (dayOfWeek !== 6 && dayOfWeek !== 7) {
        // Skip lunch (12-1 PM)
        const isLunch = current.hour === 12 || (current.hour === 13 && current.minute === 0);
        
        if (!isLunch) {
          // Check if slot conflicts with busy time
          const isBusy = busyTimes.some(busy => {
            const busyStart = DateTime.fromISO(busy.start).setZone(timezone);
            const busyEnd = DateTime.fromISO(busy.end).setZone(timezone);
            return current < busyEnd && slotEnd > busyStart;
          });

          if (!isBusy && current > startDate.plus({ minutes: 5 })) {
            slots.push({
              datetime: current.toISO(),
              display: current.toFormat('EEEE, MMMM d at h:mm a'),
              displayDate: current.toFormat('EEEE, MMMM d'),
              displayTime: current.toFormat('h:mm a'),
              day: current.toFormat('EEEE')
            });
          }
        }
      }

      current = current.plus({ hours: 1 });
    }

    return slots;
  }

  /**
   * Book an appointment
   * @param {Object} booking
   * @returns {Promise<Object>} Created event
   */
  async bookAppointment({ name, practice, phone, email, datetime, notes = '', attendees = [] }) {
    const startTime = DateTime.fromISO(datetime);
    const endTime = startTime.plus({ minutes: 30 });

    const event = {
      summary: `VoxAn Demo: ${practice}`,
      description: `
Demo call with ${name} from ${practice}

Phone: ${phone}
Email: ${email}
Notes: ${notes}

Booking via VoxAn AI
      `.trim(),
      start: {
        dateTime: startTime.toISO(),
        timeZone: 'Europe/London'
      },
      end: {
        dateTime: endTime.toISO(),
        timeZone: 'Europe/London'
      },
      attendees: [
        { email: this.calendarId }, // Host
        ...attendees.map(email => ({ email }))
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 }
        ]
      },
      colorId: '9', // Blue
      status: 'confirmed'
    };

    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        sendUpdates: 'all', // Send emails to attendees
        resource: event
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime
      };
    } catch (error) {
      console.error('Calendar booking failed:', error);
      throw error;
    }
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(eventId, newDatetime) {
    const newStart = DateTime.fromISO(newDatetime);
    const newEnd = newStart.plus({ minutes: 30 });

    try {
      const response = await this.calendar.events.patch({
        calendarId: this.calendarId,
        eventId: eventId,
        sendUpdates: 'all',
        resource: {
          start: { dateTime: newStart.toISO(), timeZone: 'Europe/London' },
          end: { dateTime: newEnd.toISO(), timeZone: 'Europe/London' }
        }
      });

      return {
        success: true,
        eventId: response.data.id,
        newTime: newStart.toISO()
      };
    } catch (error) {
      console.error('Reschedule failed:', error);
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
        sendUpdates: 'all'
      });

      return { success: true };
    } catch (error) {
      console.error('Cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Verify if an event exists
   */
  async getEvent(eventId) {
    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId
      });
      return response.data;
    } catch (error) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }
}

module.exports = CalendarService;
