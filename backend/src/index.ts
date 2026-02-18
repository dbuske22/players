import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => origin || '*',
  })
);

// ─── In-memory data store ───────────────────────────────────────────────────

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

interface Build {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  position: Position;
  height: string;
  weight: number;
  attributes: {
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
  };
  overallRating: number;
  archetype: string;
  price: number;
  description: string;
  sold: boolean;
  createdAt: string;
}

interface Purchase {
  id: string;
  buildId: string;
  buyerId: string;
  buyerName: string;
  price: number;
  purchasedAt: string;
}

const builds: Build[] = [
  {
    id: 'b1',
    sellerId: 'user2',
    sellerName: 'KingCourt99',
    name: 'Glass Cleaner Beast',
    position: 'C',
    height: "7'0\"",
    weight: 255,
    attributes: {
      speed: 42, acceleration: 44, verticalLeap: 75, strength: 90,
      stamina: 88, ballHandling: 30, passAccuracy: 45, threePointer: 25,
      midRange: 40, layup: 72, dunkPower: 88, interiorDefense: 95,
      perimeterDefense: 55, steal: 48, block: 92, offensiveRebound: 92,
      defensiveRebound: 95,
    },
    overallRating: 93,
    archetype: 'Glass Cleaner',
    price: 25000,
    description: 'Dominant big man. Boards everything, protects the rim. Perfect for paint presence.',
    sold: false,
    createdAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'b2',
    sellerId: 'user3',
    sellerName: 'DrizzyCourt',
    name: 'Sharpshooter SG',
    position: 'SG',
    height: "6'5\"",
    weight: 195,
    attributes: {
      speed: 78, acceleration: 80, verticalLeap: 72, strength: 60,
      stamina: 85, ballHandling: 82, passAccuracy: 72, threePointer: 99,
      midRange: 96, layup: 75, dunkPower: 65, interiorDefense: 48,
      perimeterDefense: 78, steal: 70, block: 42, offensiveRebound: 48,
      defensiveRebound: 58,
    },
    overallRating: 95,
    archetype: 'Pure Sharpshooter',
    price: 35000,
    description: 'Limitless range, green window on every spot. Catch-and-shoot specialist.',
    sold: false,
    createdAt: '2026-02-11T14:00:00Z',
  },
  {
    id: 'b3',
    sellerId: 'user4',
    sellerName: 'PGElite2K',
    name: 'Playmaking PG',
    position: 'PG',
    height: "6'2\"",
    weight: 185,
    attributes: {
      speed: 92, acceleration: 94, verticalLeap: 78, strength: 58,
      stamina: 88, ballHandling: 98, passAccuracy: 97, threePointer: 82,
      midRange: 80, layup: 88, dunkPower: 70, interiorDefense: 42,
      perimeterDefense: 72, steal: 78, block: 38, offensiveRebound: 44,
      defensiveRebound: 50,
    },
    overallRating: 96,
    archetype: 'Playmaker',
    price: 45000,
    description: 'Elite court vision and dribble moves. Can run any offense. Top-tier assists.',
    sold: false,
    createdAt: '2026-02-12T09:00:00Z',
  },
  {
    id: 'b4',
    sellerId: 'user5',
    sellerName: 'SlasherKing',
    name: 'Athletic Finisher SF',
    position: 'SF',
    height: "6'7\"",
    weight: 215,
    attributes: {
      speed: 88, acceleration: 90, verticalLeap: 92, strength: 75,
      stamina: 90, ballHandling: 78, passAccuracy: 68, threePointer: 72,
      midRange: 78, layup: 95, dunkPower: 96, interiorDefense: 65,
      perimeterDefense: 80, steal: 72, block: 60, offensiveRebound: 70,
      defensiveRebound: 72,
    },
    overallRating: 94,
    archetype: 'Slasher',
    price: 30000,
    description: 'Explosive athlete who finishes above the rim. Drives and dunks on everyone.',
    sold: false,
    createdAt: '2026-02-13T16:00:00Z',
  },
];

const purchases: Purchase[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({ message: '2K26 Builds Marketplace API' }));

// GET all listings (available builds)
app.get('/builds', (c) => {
  const position = c.req.query('position');
  const maxPrice = c.req.query('maxPrice');
  const sort = c.req.query('sort') || 'newest';

  let results = builds.filter((b) => !b.sold);

  if (position) {
    results = results.filter((b) => b.position === position);
  }
  if (maxPrice) {
    results = results.filter((b) => b.price <= parseInt(maxPrice));
  }

  if (sort === 'price_asc') results.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') results.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') results.sort((a, b) => b.overallRating - a.overallRating);
  else results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return c.json(results);
});

// GET single build
app.get('/builds/:id', (c) => {
  const build = builds.find((b) => b.id === c.req.param('id'));
  if (!build) return c.json({ error: 'Build not found' }, 404);
  return c.json(build);
});

// POST create a listing
const createBuildSchema = z.object({
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
  name: z.string().min(1),
  position: z.enum(['PG', 'SG', 'SF', 'PF', 'C']),
  height: z.string().min(1),
  weight: z.number().int().min(100).max(350),
  attributes: z.object({
    speed: z.number().int().min(25).max(99),
    acceleration: z.number().int().min(25).max(99),
    verticalLeap: z.number().int().min(25).max(99),
    strength: z.number().int().min(25).max(99),
    stamina: z.number().int().min(25).max(99),
    ballHandling: z.number().int().min(25).max(99),
    passAccuracy: z.number().int().min(25).max(99),
    threePointer: z.number().int().min(25).max(99),
    midRange: z.number().int().min(25).max(99),
    layup: z.number().int().min(25).max(99),
    dunkPower: z.number().int().min(25).max(99),
    interiorDefense: z.number().int().min(25).max(99),
    perimeterDefense: z.number().int().min(25).max(99),
    steal: z.number().int().min(25).max(99),
    block: z.number().int().min(25).max(99),
    offensiveRebound: z.number().int().min(25).max(99),
    defensiveRebound: z.number().int().min(25).max(99),
  }),
  archetype: z.string().min(1),
  price: z.number().int().min(1000),
  description: z.string().min(1),
});

app.post('/builds', zValidator('json', createBuildSchema), (c) => {
  const data = c.req.valid('json');
  const attrs = data.attributes;
  const overallRating = Math.round(
    (attrs.speed + attrs.acceleration + attrs.verticalLeap + attrs.strength +
      attrs.stamina + attrs.ballHandling + attrs.passAccuracy + attrs.threePointer +
      attrs.midRange + attrs.layup + attrs.dunkPower + attrs.interiorDefense +
      attrs.perimeterDefense + attrs.steal + attrs.block +
      attrs.offensiveRebound + attrs.defensiveRebound) / 17
  );

  const newBuild: Build = {
    id: generateId(),
    ...data,
    overallRating,
    sold: false,
    createdAt: new Date().toISOString(),
  };
  builds.push(newBuild);
  return c.json(newBuild, 201);
});

// DELETE remove a listing (seller only)
app.delete('/builds/:id', (c) => {
  const idx = builds.findIndex((b) => b.id === c.req.param('id'));
  if (idx === -1) return c.json({ error: 'Build not found' }, 404);
  builds.splice(idx, 1);
  return c.json({ success: true });
});

// POST purchase a build
const purchaseSchema = z.object({
  buyerId: z.string().min(1),
  buyerName: z.string().min(1),
});

app.post('/builds/:id/purchase', zValidator('json', purchaseSchema), (c) => {
  const build = builds.find((b) => b.id === c.req.param('id'));
  if (!build) return c.json({ error: 'Build not found' }, 404);
  if (build.sold) return c.json({ error: 'Build already sold' }, 400);

  build.sold = true;
  const purchase: Purchase = {
    id: generateId(),
    buildId: build.id,
    buyerId: c.req.valid('json').buyerId,
    buyerName: c.req.valid('json').buyerName,
    price: build.price,
    purchasedAt: new Date().toISOString(),
  };
  purchases.push(purchase);
  return c.json(purchase, 201);
});

// GET my listings (by sellerId)
app.get('/users/:sellerId/builds', (c) => {
  const myBuilds = builds.filter((b) => b.sellerId === c.req.param('sellerId'));
  return c.json(myBuilds);
});

// GET my purchases (by buyerId)
app.get('/users/:buyerId/purchases', (c) => {
  const myPurchases = purchases.filter((p) => p.buyerId === c.req.param('buyerId'));
  const enriched = myPurchases.map((p) => ({
    ...p,
    build: builds.find((b) => b.id === p.buildId),
  }));
  return c.json(enriched);
});

export default {
  fetch: app.fetch,
  port: 3002,
};
