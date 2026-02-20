/**
 * Supabase Database Service
 * Handles all data persistence for VoxAn
 */

const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  /**
   * Store call metadata
   */
  async createCall({
    vapiCallId,
    assistantId,
    phoneNumber,
    customerName,
    practiceName,
    status,
    transcript = null,
    recordingUrl = null,
    cost = 0,
    duration = 0,
    success = false,
    outcome = null
  }) {
    const { data, error } = await this.supabase
      .from('calls')
      .insert([{
        vapi_call_id: vapiCallId,
        assistant_id: assistantId,
        phone_number: phoneNumber,
        customer_name: customerName,
        practice_name: practiceName,
        status,
        transcript,
        recording_url: recordingUrl,
        cost,
        duration,
        success,
        outcome,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update call record
   */
  async updateCall(vapiCallId, updates) {
    const { data, error } = await this.supabase
      .from('calls')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('vapi_call_id', vapiCallId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get call by ID
   */
  async getCall(vapiCallId) {
    const { data, error } = await this.supabase
      .from('calls')
      .select('*')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create appointment record
   */
  async createAppointment({
    callId,
    customerName,
    phone,
    email,
    practiceName,
    appointmentTime,
    calendarEventId,
    calendarLink,
    status = 'confirmed',
    notes = ''
  }) {
    const { data, error } = await this.supabase
      .from('appointments')
      .insert([{
        call_id: callId,
        customer_name: customerName,
        phone,
        email,
        practice_name: practiceName,
        appointment_time: appointmentTime,
        calendar_event_id: calendarEventId,
        calendar_link: calendarLink,
        status,
        notes,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(calendarEventId, status) {
    const { data, error } = await this.supabase
      .from('appointments')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('calendar_event_id', calendarEventId);

    if (error) throw error;
    return data;
  }

  /**
   * Get or create lead
   */
  async upsertLead({
    phone,
    email = null,
    name = null,
    practiceName = null,
    address = null,
    city = null,
    source = 'vapi_call'
  }) {
    const { data: existing } = await this.supabase
      .from('leads')
      .select('*')
      .eq('phone', phone);

    if (existing && existing.length > 0) {
      // Update existing lead
      const { data, error } = await this.supabase
        .from('leads')
        .update({
          last_contacted: new Date().toISOString(),
          contact_count: existing[0].contact_count + 1,
          ...(email && !existing[0].email && { email }),
          ...(name && !existing[0].name && { name }),
          ...(practiceName && !existing[0].practice_name && { practice_name: practiceName })
        })
        .eq('id', existing[0].id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, isNew: false };
    }

    // Create new lead
    const { data, error } = await this.supabase
      .from('leads')
      .insert([{
        phone,
        email,
        name,
        practice_name: practiceName,
        address,
        city,
        source,
        status: 'contacted',
        contact_count: 1,
        created_at: new Date().toISOString(),
        last_contacted: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return { ...data, isNew: true };
  }

  /**
   * Get lead by phone
   */
  async getLeadByPhone(phone) {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Get recent calls for dashboard
   */
  async getRecentCalls(limit = 20) {
    const { data, error } = await this.supabase
      .from('calls')
      .select('*, appointments(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('appointments')
      .select('*, calls(transcript)')
      .gte('appointment_time', now)
      .eq('status', 'confirmed')
      .order('appointment_time', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Get conversion metrics
   */
  async getMetrics(since = null) {
    const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: calls, error: callsError } = await this.supabase
      .from('calls')
      .select('success, cost, duration')
      .gte('created_at', sinceDate);

    if (callsError) throw callsError;

    const { data: appointments, error: apptError } = await this.supabase
      .from('appointments')
      .select('*')
      .gte('created_at', sinceDate);

    if (apptError) throw apptError;

    return {
      totalCalls: calls.length,
      successfulCalls: calls.filter(c => c.success).length,
      totalCost: calls.reduce((sum, c) => sum + (c.cost || 0), 0),
      avgDuration: calls.length > 0 
        ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length 
        : 0,
      bookings: appointments.filter(a => a.status === 'confirmed').length,
      cancellations: appointments.filter(a => a.status === 'cancelled').length
    };
  }
}

module.exports = DatabaseService;
