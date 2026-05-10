export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  currentWeight?: number;
  targetWeight?: number;
  height?: number;
  createdAt?: any;
}

export interface ProgressEntry {
  id: string;
  userId: string;
  weight: number;
  date: any;
  note?: string;
}

export interface Tip {
  title: string;
  content: string;
  category: 'nutrition' | 'exercise' | 'lifestyle';
}

export interface Food {
  name: string;
  type: 'eat' | 'avoid';
  description: string;
}

export interface Exercise {
  name: string;
  description: string;
  duration: string;
  image?: string;
}
