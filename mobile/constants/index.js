// Shared constants for incident management

export const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#00CC44'
};

export const STATUS_COLORS = {
  pending_review: '#FFAA00',
  pending: '#FFAA00',
  acknowledged: '#0066FF',
  en_route: '#0066FF',
  on_scene: '#0066FF',
  resolved: '#00CC44',
  closed: '#666666',
  cancelled: '#666666'
};

export const STATUS_ICONS = {
  pending_review: '⏳',
  pending: '⏳',
  acknowledged: '✅',
  en_route: '🚨',
  on_scene: '📍',
  resolved: '✓',
  closed: '📋',
  cancelled: '❌'
};

export const STATUS_LABELS = {
  pending_review: 'PENDING',
  pending: 'PENDING',
  acknowledged: 'ACKNOWLEDGED',
  en_route: 'EN ROUTE',
  on_scene: 'ON SCENE',
  resolved: 'RESOLVED',
  closed: 'CLOSED',
  cancelled: 'CANCELLED'
};

export const INCIDENT_ICONS = {
  fire: '🔥',
  medical: '🚑',
  police: '🚔'
};

export const EMERGENCY_CONTACTS = [
  { id: 'fire', label: 'Fire', icon: '🚒', number: '911' },
  { id: 'medical', label: 'Medical', icon: '🚑', number: '911' },
  { id: 'police', label: 'Police', icon: '🚔', number: '911' }
];
