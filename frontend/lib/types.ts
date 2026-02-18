export type GameType = 'basketball' | 'football' | 'hockey';

export type BuildStatus = 'pending' | 'active' | 'rejected' | 'sold';

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'buyer' | 'seller' | 'admin';
  avatar_url: string | null;
  stripe_onboarded: boolean;
  stripe_account_id?: string;
  preferred_sport: GameType | null;
  playstyle_vector: number[] | null;
  playstyle_labels: PlaystyleLabels | null;
  total_earnings: number;
  total_spent: number;
  created_at: string;
}

export interface PlaystyleLabels {
  shootVsDrive: number;
  soloVsSquad: number;
  defenseSkill: number;
  reactionTiming: number;
  offensiveStyle: number;
  physicalPlay: number;
  pacePreference: number;
  consistencyVsHighRisk: number;
}

export interface BuildAttribute {
  key: string;
  value: string | number;
}

export interface BuildPerformance {
  speed: number;
  shooting: number;
  defense: number;
  playmaking: number;
  athleticism: number;
  patch_version?: string;
}

export interface Build {
  id: string;
  seller_id: string;
  seller?: {
    id: string;
    username: string;
    avatar_url: string | null;
    stripe_onboarded: boolean;
    total_earnings?: number;
  };
  title: string;
  game_type: GameType;
  position: string;
  archetype: string;
  description: string | null;
  price: number;
  import_code: string | null;
  preview_url: string | null;
  build_vector: number[] | null;
  attributes: BuildAttribute[];
  badges: string[];
  badge_count?: number;
  attribute_count?: number;
  performance: BuildPerformance;
  height_in: number | null;
  weight_lbs: number | null;
  status: BuildStatus;
  featured: boolean;
  view_count: number;
  avg_rating: number | null;
  reviews?: Review[];
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  build_id: string;
  buyer_id: string;
  purchase_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: { username: string; avatar_url: string | null };
}

export interface Purchase {
  id: string;
  buyer_id: string;
  build_id: string;
  seller_id: string;
  amount: number;
  platform_fee: number;
  seller_payout: number;
  stripe_payment_intent_id: string | null;
  status: string;
  created_at: string;
  build?: Build;
}

export interface CompatibilityResult {
  score: number;
  label: string;
  strengths: string[];
  weaknesses: string[];
  predictedWinBoost: number;
}
