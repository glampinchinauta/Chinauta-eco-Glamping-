export interface Dome {
  id: number;
  name: string;
  code: string;
  description: string;
  capacity: number;
  /** Máximo de personas que recibe (las que pasan de "capacity" pagan persona adicional). */
  max_guests?: number;
  price_per_night: number;
  image_url: string;
  images?: string[];
  status: 'Disponible' | 'Mantenimiento' | 'Fuera de servicio';
  features: string;
  policies: string;
}

export interface Reservation {
  id: number;
  reservation_code: string;
  customer_id: number;
  dome_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: 'Pendiente' | 'Pendiente de pago' | 'Confirmada' | 'Check-in' | 'Hospedado' | 'Check-out' | 'Completada' | 'Cancelada' | 'No show';
  payment_status: 'Pendiente' | 'Parcial' | 'Pagado' | 'Reembolsado';
  total_amount: number;
  amount_paid: number;
  amount_pending: number;
  notes?: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_whatsapp?: string;
  dome_name?: string;
  dome_code?: string;
  /** "Voy en camino" (solo panel): estado, última ubicación y tiempo estimado de llegada. */
  trip_status?: 'en_camino' | 'llego' | 'detenido';
  trip_updated_at?: string;
  trip_started_at?: string;
  trip_lat?: number | null;
  trip_lng?: number | null;
  trip_accuracy?: number | null;
  trip_eta_min?: number | null;
  trip_distance_km?: number | null;
  trip_eta_source?: 'google' | 'estimado' | 'sin_destino';
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  document_id: string;
  notes: string;
  created_at: string;
  total_reservations?: number;
  total_spent?: number;
  last_reservation?: string;
}

export interface Payment {
  id: number;
  reservation_id: number;
  amount: number;
  method: string;
  status: string;
  recorded_by: string;
  created_at: string;
  reservation_code?: string;
  customer_name?: string;
}

export interface MaintenanceBlock {
  id: number;
  dome_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  created_by: string;
  dome_name?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'RECEPCION' | 'FINANCES';
  status: string;
}

export interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  timestamp: string;
}
