export interface Trip {
  id: string;
  name: string;
  date: string;
  time: string;
  meeting: string;
  desc?: string;
  description?: string;
  image?: string;
  cropY?: number;
  zoom?: number;
  hidden: boolean;
  hasPassword: boolean;
  status: string;
  participants: Participant[];
  waypoints: Waypoint[];
}

export interface Participant {
  id: string;
  name: string;
  phone: string;
  city: string;
  hasCar: boolean;
  seats: number;
  carFrom: string;
  carTo: string;
  carNotes: string;
  needRide: boolean;
  assignedTo: string | null;
  notes: string;
}

export interface Waypoint {
  id: string;
  name: string;
  address: string;
  phone: string;
  time: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingsTotal: number | null;
  placeId: string | null;
}
