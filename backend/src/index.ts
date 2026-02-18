import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { pbkdf2Sync, randomBytes } from 'crypto';
import Stripe from 'stripe';
import QRCode from 'qrcode';
import { db } from './db.js';
import { signToken, verifyToken, authMiddleware, adminMiddleware, type JWTPayload } from './auth.js';
import { sendPurchaseConfirmation, sendBuildApprovedEmail } from './email.js';

// --- password helpers (replaces bcryptjs, works in Node.js and Bun) ---
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = pbkdf2Sync(password, salt, 10_000, 64, 'sha512').toString('hex');
  return attempt === hash;
}

type AppEnv = { Variables: { user: JWTPayload } };

const app = new Hono<AppEnv>();

// Defer Stripe init to avoid blocking cold start when key is placeholder
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

const PLATFORM_FEE = 0.30; // 30%

app.use('*', cors({ credentials: true, origin: (origin) => origin || '*' }));

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ message: 'Sports Builds Market API v1.0' }));

// ─── AUTH ────────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30),
});

app.post('/auth/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, username } = c.req.valid('json');
  const hash = hashPassword(password);
  const { data, error } = await db
    .from('users')
    .insert({ email, password_hash: hash, username, role: 'buyer' })
    .select('id, email, username, role, playstyle_vector, playstyle_labels, stripe_onboarded, avatar_url, total_earnings, total_spent, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return c.json({ error: 'Email or username already taken' }, 400);
    return c.json({ error: error.message }, 400);
  }
  const token = signToken({ userId: data.id, email: data.email, role: data.role, username: data.username });
  return c.json({ token, user: data }, 201);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post('/auth/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { data: user } = await db.from('users').select('*').eq('email', email).single();
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  const valid = verifyPassword(password, user.password_hash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);
  const token = signToken({ userId: user.id, email: user.email, role: user.role, username: user.username });
  const { password_hash: _, ...safeUser } = user;
  return c.json({ token, user: safeUser });
});

app.get('/auth/me', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { data: user } = await db
    .from('users')
    .select('id, email, username, role, playstyle_vector, playstyle_labels, preferred_sport, stripe_onboarded, stripe_account_id, avatar_url, total_earnings, total_spent, created_at')
    .eq('id', userId)
    .single();
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

// ─── PLAYSTYLE SCAN ──────────────────────────────────────────────────────────
const playstyleSchema = z.object({
  vector: z.array(z.number().min(1).max(10)).length(8),
  preferred_sport: z.enum(['basketball', 'football', 'hockey']).optional(),
  labels: z.object({
    shootVsDrive: z.number(),
    soloVsSquad: z.number(),
    defenseSkill: z.number(),
    reactionTiming: z.number(),
    offensiveStyle: z.number(),
    physicalPlay: z.number(),
    pacePreference: z.number(),
    consistencyVsHighRisk: z.number(),
  }),
});

app.post('/users/playstyle', authMiddleware, zValidator('json', playstyleSchema), async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { vector, labels, preferred_sport } = c.req.valid('json');
  const updatePayload: Record<string, unknown> = {
    playstyle_vector: vector,
    playstyle_labels: labels,
    updated_at: new Date().toISOString(),
  };
  if (preferred_sport) updatePayload.preferred_sport = preferred_sport;
  const { data, error } = await db
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select('id, playstyle_vector, playstyle_labels, preferred_sport')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

// ─── STRIPE CONNECT ONBOARDING ───────────────────────────────────────────────
app.post('/stripe/connect', authMiddleware, async (c) => {
  const { userId, email } = c.get('user') as JWTPayload;
  const { data: user } = await db.from('users').select('stripe_account_id').eq('id', userId).single();

  let accountId = user?.stripe_account_id;
  if (!accountId) {
    try {
      const account = await getStripe().accounts.create({ type: 'express', email });
      accountId = account.id;
      await db.from('users').update({ stripe_account_id: accountId }).eq('id', userId);
    } catch {
      return c.json({ error: 'Stripe unavailable in test mode without valid key' }, 200);
    }
  }

  try {
    const origin = c.req.header('origin') || 'http://localhost:8081';
    const link = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/seller/onboarding?refresh=true`,
      return_url: `${origin}/seller/onboarding?success=true`,
      type: 'account_onboarding',
    });
    return c.json({ url: link.url });
  } catch {
    return c.json({ error: 'Could not create onboarding link' }, 500);
  }
});

app.get('/stripe/connect/status', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { data: user } = await db.from('users').select('stripe_account_id, stripe_onboarded').eq('id', userId).single();
  if (!user?.stripe_account_id) return c.json({ onboarded: false });
  try {
    const account = await getStripe().accounts.retrieve(user.stripe_account_id);
    const onboarded = account.charges_enabled && account.details_submitted;
    if (onboarded && !user.stripe_onboarded) {
      await db.from('users').update({ stripe_onboarded: true }).eq('id', userId);
    }
    return c.json({ onboarded, account_id: user.stripe_account_id });
  } catch {
    return c.json({ onboarded: user.stripe_onboarded });
  }
});

// ─── BUILDS ──────────────────────────────────────────────────────────────────
app.get('/builds', async (c) => {
  const gameType = c.req.query('game_type');
  const position = c.req.query('position');
  const minPrice = c.req.query('min_price');
  const maxPrice = c.req.query('max_price');
  const sort = c.req.query('sort') || 'newest';
  const search = c.req.query('search');
  const featured = c.req.query('featured');

  let query = db
    .from('builds')
    .select(`
      id, title, game_type, position, archetype, description, price,
      build_vector, attributes, badges, performance, status, featured,
      view_count, created_at,
      seller:seller_id(id, username, avatar_url, stripe_onboarded)
    `)
    .eq('status', 'active');

  if (gameType) query = query.eq('game_type', gameType);
  if (position) query = query.ilike('position', `%${position}%`);
  if (minPrice) query = query.gte('price', parseFloat(minPrice));
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
  if (featured === 'true') query = query.eq('featured', true);
  if (search) query = query.or(`title.ilike.%${search}%,archetype.ilike.%${search}%,description.ilike.%${search}%`);

  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else if (sort === 'popular') query = query.order('view_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  // Attach avg rating
  const buildIds = (data || []).map((b) => b.id);
  let ratingsMap: Record<string, number> = {};
  if (buildIds.length > 0) {
    const { data: reviews } = await db
      .from('reviews')
      .select('build_id, rating')
      .in('build_id', buildIds);
    if (reviews) {
      const sums: Record<string, { sum: number; count: number }> = {};
      reviews.forEach((r) => {
        if (!sums[r.build_id]) sums[r.build_id] = { sum: 0, count: 0 };
        sums[r.build_id].sum += r.rating;
        sums[r.build_id].count++;
      });
      Object.entries(sums).forEach(([id, { sum, count }]) => {
        ratingsMap[id] = Math.round((sum / count) * 10) / 10;
      });
    }
  }

  const enriched = (data || []).map((b) => ({ ...b, avg_rating: ratingsMap[b.id] || null }));
  return c.json(enriched);
});

app.get('/builds/:id', async (c) => {
  const { data, error } = await db
    .from('builds')
    .select(`*, seller:seller_id(id, username, avatar_url, stripe_onboarded, total_earnings)`)
    .eq('id', c.req.param('id'))
    .single();
  if (error || !data) return c.json({ error: 'Build not found' }, 404);

  // Increment view count
  await db.from('builds').update({ view_count: (data.view_count || 0) + 1 }).eq('id', data.id);

  // Get reviews
  const { data: reviews } = await db
    .from('reviews')
    .select('*, reviewer:buyer_id(username, avatar_url)')
    .eq('build_id', data.id)
    .order('created_at', { ascending: false });

  const avgRating = reviews && reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  // Check if requester has purchased — only then reveal attributes, badges, import_code
  let hasPurchased = false;
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      if (payload) {
        const { data: purchase } = await db
          .from('purchases')
          .select('id')
          .eq('build_id', data.id)
          .eq('buyer_id', payload.userId)
          .eq('status', 'completed')
          .maybeSingle();
        hasPurchased = !!purchase;
      }
    } catch { /* invalid token — treat as unauthenticated */ }
  }

    const response = {
      ...data,
      description: hasPurchased ? data.description : null,
      attributes: hasPurchased ? data.attributes : [],
      badges: hasPurchased ? data.badges : [],
      import_code: hasPurchased ? data.import_code : null,
      height_in: hasPurchased ? data.height_in : null,
      weight_lbs: hasPurchased ? data.weight_lbs : null,
      badge_count: (data.badges ?? []).length,
      attribute_count: (data.attributes ?? []).length,
      reviews: reviews || [],
      avg_rating: avgRating,
    };

  return c.json(response);
});

const createBuildSchema = z.object({
  title: z.string().min(3),
  game_type: z.enum(['basketball', 'football', 'hockey']),
  position: z.string().min(1),
  archetype: z.string().min(1),
  description: z.string().optional(),
    price: z.number().min(1.00).max(10.00),
  import_code: z.string().optional(),
  preview_url: z.string().optional(),
  build_vector: z.array(z.number().min(1).max(10)).length(8).optional(),
  attributes: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number()]) })),
  badges: z.array(z.string()),
    performance: z.object({
      speed: z.number().min(0).max(100).optional(),
      shooting: z.number().min(0).max(100).optional(),
      defense: z.number().min(0).max(100).optional(),
      playmaking: z.number().min(0).max(100).optional(),
      athleticism: z.number().min(0).max(100).optional(),
      win_rate: z.number().min(0).max(100).optional(),
      mode_played: z.string().optional(),
      avg_grade: z.string().optional(),
      shot_efficiency: z.number().min(0).max(100).optional(),
      patch_version: z.string(),
    }),
});

app.post('/builds', authMiddleware, zValidator('json', createBuildSchema), async (c) => {
  const user = c.get('user') as JWTPayload;
  const body = c.req.valid('json');

  const { data, error } = await db
    .from('builds')
    .insert({
      seller_id: user.userId,
      ...body,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data, 201);
});

app.put('/builds/:id', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;
  const body = await c.req.json();
  const { data: build } = await db.from('builds').select('seller_id').eq('id', c.req.param('id')).single();
  if (!build) return c.json({ error: 'Build not found' }, 404);
  if (build.seller_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const { data, error } = await db
    .from('builds')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.delete('/builds/:id', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;
  const { data: build } = await db.from('builds').select('seller_id, status').eq('id', c.req.param('id')).single();
  if (!build) return c.json({ error: 'Build not found' }, 404);
  if (build.seller_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  if (build.status === 'sold') return c.json({ error: 'Cannot delete sold build' }, 400);
  await db.from('builds').delete().eq('id', c.req.param('id'));
  return c.json({ success: true });
});

// ─── QR CODE ─────────────────────────────────────────────────────────────────
app.get('/builds/:id/qr', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  // Check they own this purchase
  const { data: purchase } = await db
    .from('purchases')
    .select('build_id')
    .eq('buyer_id', userId)
    .eq('build_id', c.req.param('id'))
    .single();
  if (!purchase) return c.json({ error: 'Purchase not found' }, 403);

  const { data: build } = await db.from('builds').select('import_code, title').eq('id', c.req.param('id')).single();
  if (!build) return c.json({ error: 'Build not found' }, 404);

  const qrDataUrl = await QRCode.toDataURL(build.import_code || build.title, {
    width: 300,
    margin: 2,
    color: { dark: '#1e1b4b', light: '#ffffff' },
  });
  return c.json({ qr: qrDataUrl, import_code: build.import_code });
});

// ─── PURCHASES / PAYMENTS ────────────────────────────────────────────────────
app.post('/builds/:id/checkout', authMiddleware, async (c) => {
  const { userId, email } = c.get('user') as JWTPayload;
  const { data: build } = await db
    .from('builds')
    .select('*, seller:seller_id(id, username, email, stripe_account_id, stripe_onboarded)')
    .eq('id', c.req.param('id'))
    .single();

  if (!build) return c.json({ error: 'Build not found' }, 404);
  if (build.status !== 'active') return c.json({ error: 'Build is not available' }, 400);
  if (build.seller_id === userId) return c.json({ error: 'Cannot buy your own build' }, 400);

  const alreadyPurchased = await db.from('purchases').select('id').eq('buyer_id', userId).eq('build_id', build.id).single();
  if (alreadyPurchased.data) return c.json({ error: 'Already purchased' }, 400);

  const amountCents = Math.round(build.price * 100);
  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE);

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const hasValidStripeKey = stripeKey.startsWith('sk_') && stripeKey.length > 20 && !stripeKey.includes('placeholder');

  if (!hasValidStripeKey) {
    // Demo mode: complete purchase without Stripe
    const { data: purchase } = await db
      .from('purchases')
      .insert({
        buyer_id: userId,
        build_id: build.id,
        seller_id: build.seller_id,
        amount: build.price,
        platform_fee: build.price * PLATFORM_FEE,
        seller_payout: build.price * (1 - PLATFORM_FEE),
        status: 'completed',
      })
      .select('*')
      .single();

    await db.from('builds').update({ status: 'sold' }).eq('id', build.id);

    return c.json({ demo: true, purchase, message: 'Demo purchase completed (Stripe not configured)' });
  }

  // Real Stripe payment
  const paymentIntentData: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: 'usd',
    receipt_email: email,
    metadata: { buildId: build.id, buyerId: userId, sellerId: build.seller_id },
  };

  if (build.seller?.stripe_account_id && build.seller?.stripe_onboarded) {
    paymentIntentData.application_fee_amount = platformFeeCents;
    paymentIntentData.transfer_data = { destination: build.seller.stripe_account_id };
  }

  const intent = await getStripe().paymentIntents.create(paymentIntentData);
  return c.json({ client_secret: intent.client_secret, payment_intent_id: intent.id, amount: build.price });
});

app.post('/builds/:id/purchase/confirm', authMiddleware, async (c) => {
  const { userId, email, username } = c.get('user') as JWTPayload;
  const { payment_intent_id } = await c.req.json();

  const { data: build } = await db
    .from('builds')
    .select('*, seller:seller_id(username, stripe_account_id)')
    .eq('id', c.req.param('id'))
    .single();
  if (!build) return c.json({ error: 'Build not found' }, 404);

  let intentStatus = 'succeeded';
  let transferId: string | undefined;

  if (payment_intent_id && !payment_intent_id.startsWith('demo_')) {
    const intent = await getStripe().paymentIntents.retrieve(payment_intent_id);
    intentStatus = intent.status;
    if (intentStatus !== 'succeeded') return c.json({ error: 'Payment not completed' }, 400);
  }

  const { data: purchase, error } = await db
    .from('purchases')
    .insert({
      buyer_id: userId,
      build_id: build.id,
      seller_id: build.seller_id,
      amount: build.price,
      platform_fee: build.price * PLATFORM_FEE,
      seller_payout: build.price * (1 - PLATFORM_FEE),
      stripe_payment_intent_id: payment_intent_id,
      stripe_transfer_id: transferId,
      status: 'completed',
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 400);

  await db.from('builds').update({ status: 'sold', updated_at: new Date().toISOString() }).eq('id', build.id);
  await db.from('users').update({ total_spent: build.price }).eq('id', userId);
  await db.from('users')
    .update({ total_earnings: build.price * (1 - PLATFORM_FEE) })
    .eq('id', build.seller_id);

  // Send email
  await sendPurchaseConfirmation({
    buyerEmail: email,
    buyerName: username,
    buildTitle: build.title,
    importCode: build.import_code || 'N/A',
    amount: build.price,
  });

  return c.json(purchase);
});

// ─── USER DASHBOARD ──────────────────────────────────────────────────────────
app.get('/users/me/builds', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { data } = await db
    .from('builds')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  return c.json(data || []);
});

app.get('/users/me/purchases', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { data } = await db
    .from('purchases')
    .select('*, build:build_id(id, title, game_type, position, archetype, import_code, preview_url, attributes, badges, performance, price)')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });
  return c.json(data || []);
});

app.get('/users/me/earnings', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { data } = await db
    .from('purchases')
    .select('amount, platform_fee, seller_payout, created_at, build:build_id(title)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  const total = (data || []).reduce((s, p) => s + p.seller_payout, 0);
  return c.json({ sales: data || [], total_earned: total });
});

// ─── REVIEWS ─────────────────────────────────────────────────────────────────
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  purchase_id: z.string().uuid(),
});

app.post('/builds/:id/reviews', authMiddleware, zValidator('json', reviewSchema), async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { rating, comment, purchase_id } = c.req.valid('json');

  // Verify purchase
  const { data: purchase } = await db
    .from('purchases')
    .select('id')
    .eq('id', purchase_id)
    .eq('buyer_id', userId)
    .eq('build_id', c.req.param('id'))
    .single();
  if (!purchase) return c.json({ error: 'No valid purchase found' }, 403);

  const existing = await db.from('reviews').select('id').eq('buyer_id', userId).eq('build_id', c.req.param('id')).single();
  if (existing.data) return c.json({ error: 'Already reviewed' }, 400);

  const { data, error } = await db
    .from('reviews')
    .insert({ build_id: c.req.param('id'), buyer_id: userId, purchase_id, rating, comment })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data, 201);
});

// ─── MODERATION FLAGS ────────────────────────────────────────────────────────
app.post('/builds/:id/flag', authMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;
  const { reason } = await c.req.json();
  const { data, error } = await db
    .from('moderation_flags')
    .insert({ build_id: c.req.param('id'), flagged_by: userId, reason })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data, 201);
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────
app.use('/admin/*', authMiddleware, adminMiddleware);

app.get('/admin/builds', async (c) => {
  const status = c.req.query('status');
  let query = db
    .from('builds')
    .select('*, seller:seller_id(username, email)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return c.json(data || []);
});

app.post('/admin/builds/:id/approve', async (c) => {
  const { data: build } = await db
    .from('builds')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('*, seller:seller_id(username, email)')
    .single();
  if (!build) return c.json({ error: 'Not found' }, 404);

  const seller = build.seller as { username: string; email: string } | null;
  if (seller?.email) {
    await sendBuildApprovedEmail({
      sellerEmail: seller.email,
      sellerName: seller.username,
      buildTitle: build.title,
    });
  }
  return c.json(build);
});

app.post('/admin/builds/:id/reject', async (c) => {
  const { data } = await db
    .from('builds')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  return c.json(data);
});

app.get('/admin/flags', async (c) => {
  const { data } = await db
    .from('moderation_flags')
    .select('*, build:build_id(title, game_type), reporter:flagged_by(username)')
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  return c.json(data || []);
});

app.post('/admin/flags/:id/resolve', async (c) => {
  const user = c.get('user') as JWTPayload;
  const { data } = await db
    .from('moderation_flags')
    .update({ resolved: true, resolved_by: user.userId })
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  return c.json(data);
});

app.get('/admin/users', async (c) => {
  const { data } = await db
    .from('users')
    .select('id, email, username, role, stripe_onboarded, total_earnings, total_spent, created_at')
    .order('created_at', { ascending: false });
  return c.json(data || []);
});

app.put('/admin/builds/:id/feature', async (c) => {
  const { featured } = await c.req.json();
  const { data } = await db.from('builds').update({ featured }).eq('id', c.req.param('id')).select('id, featured').single();
  return c.json(data);
});

// ─── STATS (public) ──────────────────────────────────────────────────────────
app.get('/stats', async (c) => {
  const [{ count: totalBuilds }, { count: totalUsers }, { count: totalSales }] = await Promise.all([
    db.from('builds').select('*', { count: 'exact', head: true }).eq('status', 'active').then((r) => r),
    db.from('users').select('*', { count: 'exact', head: true }).then((r) => r),
    db.from('purchases').select('*', { count: 'exact', head: true }).then((r) => r),
  ]);
  return c.json({ total_builds: totalBuilds, total_users: totalUsers, total_sales: totalSales });
});

// ─── LEADERBOARD (public) ────────────────────────────────────────────────────
app.get('/leaderboard', async (c) => {
  const gameType = c.req.query('game_type');
  let query = db
    .from('builds')
    .select('id, title, game_type, position, archetype, price, performance, view_count, created_at, seller:seller_id(username, avatar_url)')
    .eq('status', 'active');
  if (gameType) query = query.eq('game_type', gameType);
  query = query.order('view_count', { ascending: false }).limit(20);
  const { data: builds } = await query;

  // Attach purchase counts and avg ratings
  const ids = (builds || []).map((b) => b.id);
  const [purchaseRes, reviewRes] = await Promise.all([
    ids.length ? db.from('purchases').select('build_id').in('build_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from('reviews').select('build_id, rating').in('build_id', ids) : Promise.resolve({ data: [] }),
  ]);

  const saleCounts: Record<string, number> = {};
  (purchaseRes.data || []).forEach((p) => { saleCounts[p.build_id] = (saleCounts[p.build_id] || 0) + 1; });

  const ratingMap: Record<string, { sum: number; count: number }> = {};
  (reviewRes.data || []).forEach((r) => {
    if (!ratingMap[r.build_id]) ratingMap[r.build_id] = { sum: 0, count: 0 };
    ratingMap[r.build_id].sum += r.rating;
    ratingMap[r.build_id].count++;
  });

  const enriched = (builds || []).map((b, i) => ({
    ...b,
    rank: i + 1,
    sales_count: saleCounts[b.id] || 0,
    avg_rating: ratingMap[b.id] ? Math.round((ratingMap[b.id].sum / ratingMap[b.id].count) * 10) / 10 : null,
  }));

  // Sort by sales desc, then views
  enriched.sort((a, b) => b.sales_count - a.sales_count || (b.view_count || 0) - (a.view_count || 0));
  enriched.forEach((b, i) => { b.rank = i + 1; });

  return c.json(enriched);
});

// ─── SEED (admin only) ───────────────────────────────────────────────────────
app.post('/admin/seed', authMiddleware, adminMiddleware, async (c) => {
  const { userId } = c.get('user') as JWTPayload;

  const seedBuilds = [
    {
      seller_id: userId,
      title: 'Elite Guard Template',
      game_type: 'basketball',
      position: 'Point Guard',
      archetype: 'Pure Scorer',
      description: 'A lightning-fast guard build optimized for scoring and creating. Dominates in transition and pick-and-roll situations.',
      price: 4.99,
      import_code: '{"build":"elite-guard-v1","archetype":"pure_scorer","sport":"basketball"}',
      build_vector: [8, 4, 3, 7, 9, 4, 9, 6],
      attributes: [
        { key: 'Speed', value: 92 }, { key: 'Acceleration', value: 90 },
        { key: 'Ball Handling', value: 88 }, { key: '3-Point Shot', value: 85 },
        { key: 'Mid-Range Shot', value: 82 }, { key: 'Layup', value: 86 },
        { key: 'Pass Accuracy', value: 75 }, { key: 'Perimeter Defense', value: 64 },
      ],
      badges: ['Limitless Range', 'Handles For Days', 'Quick First Step', 'Slithery', 'Clamp Breaker'],
      performance: { speed: 92, shooting: 85, defense: 64, playmaking: 78, athleticism: 87, patch_version: '1.0' },
      status: 'active',
      featured: true,
      view_count: 412,
    },
    {
      seller_id: userId,
      title: 'Lockdown Defender',
      game_type: 'basketball',
      position: 'Small Forward',
      archetype: 'Wing Stopper',
      description: 'Built to shut down elite scorers. High lateral quickness and steal tendencies make this a nightmare for opponents.',
      price: 3.99,
      import_code: '{"build":"lockdown-sf-v1","archetype":"wing_stopper","sport":"basketball"}',
      build_vector: [3, 6, 9, 8, 3, 8, 5, 7],
      attributes: [
        { key: 'Speed', value: 85 }, { key: 'Perimeter Defense', value: 95 },
        { key: 'Steal', value: 88 }, { key: 'Block', value: 72 },
        { key: 'Strength', value: 80 }, { key: 'Vertical', value: 78 },
        { key: '3-Point Shot', value: 65 }, { key: 'Ball Handling', value: 62 },
      ],
      badges: ['Clamps', 'Interceptor', 'Rim Protector', 'Hustler', 'Pick Dodger'],
      performance: { speed: 85, shooting: 63, defense: 95, playmaking: 58, athleticism: 82, patch_version: '1.0' },
      status: 'active',
      view_count: 287,
    },
    {
      seller_id: userId,
      title: 'Balanced QB Template',
      game_type: 'football',
      position: 'Quarterback',
      archetype: 'Scrambler',
      description: 'A mobile QB that can make plays with his legs and arm. Perfect for users who love extending plays.',
      price: 4.99,
      import_code: '{"build":"scrambler-qb-v1","archetype":"scrambler","sport":"football"}',
      build_vector: [7, 5, 4, 6, 8, 6, 8, 5],
      attributes: [
        { key: 'Speed', value: 88 }, { key: 'Acceleration', value: 86 },
        { key: 'Throw Power', value: 84 }, { key: 'Throw Accuracy', value: 86 },
        { key: 'Ball Carrier Vision', value: 80 }, { key: 'Agility', value: 85 },
        { key: 'Stamina', value: 78 }, { key: 'Strength', value: 65 },
      ],
      badges: ['Scrambler', 'Strong Arm', 'Field General', 'Evasive'],
      performance: { speed: 88, shooting: 84, defense: 55, playmaking: 82, athleticism: 86, patch_version: '1.0' },
      status: 'active',
      view_count: 198,
    },
    {
      seller_id: userId,
      title: 'Power Forward Finisher',
      game_type: 'basketball',
      position: 'Power Forward',
      archetype: 'Glass Cleaner',
      description: 'Dominant in the paint. This build crashes the boards and finishes through contact at an elite level.',
      price: 3.99,
      import_code: '{"build":"pf-glass-v1","archetype":"glass_cleaner","sport":"basketball"}',
      build_vector: [3, 7, 7, 5, 4, 9, 4, 8],
      attributes: [
        { key: 'Strength', value: 90 }, { key: 'Vertical', value: 82 },
        { key: 'Dunk Power', value: 92 }, { key: 'Interior Defense', value: 85 },
        { key: 'Block', value: 78 }, { key: 'Speed', value: 68 },
        { key: 'Ball Handling', value: 45 }, { key: '3-Point Shot', value: 38 },
      ],
      badges: ['Posterizer', 'Brick Wall', 'Pogo Stick', 'Physical Finisher', 'Bulldozer'],
      performance: { speed: 68, shooting: 55, defense: 87, playmaking: 45, athleticism: 91, patch_version: '1.0' },
      status: 'active',
      view_count: 155,
    },
    {
      seller_id: userId,
      title: 'Two-Way Winger',
      game_type: 'hockey',
      position: 'Left Wing',
      archetype: 'Power Forward',
      description: 'A physical winger who can score in the dirty areas and play rugged defense. Built for sim hockey dominance.',
      price: 4.49,
      import_code: '{"build":"twoway-lw-v1","archetype":"power_forward","sport":"hockey"}',
      build_vector: [6, 6, 7, 6, 6, 8, 6, 6],
      attributes: [
        { key: 'Speed', value: 80 }, { key: 'Slap Shot Power', value: 86 },
        { key: 'Wrist Shot Accuracy', value: 82 }, { key: 'Checking', value: 88 },
        { key: 'Defensive Awareness', value: 82 }, { key: 'Stickhandling', value: 74 },
        { key: 'Passing', value: 72 }, { key: 'Endurance', value: 85 },
      ],
      badges: ['Net Front Presence', 'Big Hitter', 'Sniper', 'Back-Checker'],
      performance: { speed: 80, shooting: 82, defense: 84, playmaking: 72, athleticism: 83, patch_version: '1.0' },
      status: 'active',
      view_count: 102,
    },
  ];

  const inserted = [];
  for (const build of seedBuilds) {
    const { data, error } = await db.from('builds').upsert(build, { onConflict: 'title' }).select('id, title').single();
    if (!error && data) inserted.push(data);
  }

  return c.json({ seeded: inserted.length, builds: inserted });
});

export { app };

export default {
  fetch: app.fetch,
  port: 3002,
};
