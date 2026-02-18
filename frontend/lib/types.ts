export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface BuildAttributes {
  speed: number;
  acceleration: number;
  verticalLeap: number;
  strength: number;
  stamina: number;
  ballHandling: number;
  passAccuracy: number;
  threePointer: number;
  midRange: number;
  layup: number;
  dunkPower: number;
  interiorDefense: number;
  perimeterDefense: number;
  steal: number;
  block: number;
  offensiveRebound: number;
  defensiveRebound: number;
}

export interface Build {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  position: Position;
  height: string;
  weight: number;
  attributes: BuildAttributes;
  overallRating: number;
  archetype: string;
  price: number;
  description: string;
  sold: boolean;
  createdAt: string;
}

export interface Purchase {
  id: string;
  buildId: string;
  buyerId: string;
  buyerName: string;
  price: number;
  purchasedAt: string;
  build?: Build;
}
