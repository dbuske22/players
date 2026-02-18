import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import QRCode from 'qrcode';
import { db } from './db.js';
import { signToken, authMiddleware, adminMiddleware, type JWTPayload } from './auth.js';
import { sendPurchaseConfirmation, sendBuildApprovedEmail } from './email.js';

type AppEnv = { Variables: { user: JWTPayload } };

const app = new Hono<AppEnv>();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-01-28.clover',
});

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
  const hash = await bcrypt.hash(password, 12);
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
  const valid = await bcrypt.compare(password, user.password_hash);
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
      const account = await stripe.accounts.create({ type: 'express', email });
      accountId = account.id;
      await db.from('users').update({ stripe_account_id: accountId }).eq('id', userId);
    } catch {
      return c.json({ error: 'Stripe unavailable in test mode without valid key' }, 200);
    }
  }

  try {
    const origin = c.req.header('origin') || 'http://localhost:8081';
    const link = await stripe.accountLinks.create({
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
    const account = await stripe.accounts.retrieve(user.stripe_account_id);
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
      const { verifyToken } = await import('./auth.js');
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
  price: z.number().min(3.99).max(7.99),
  import_code: z.string().optional(),
  preview_url: z.string().optional(),
  build_vector: z.array(z.number().min(1).max(10)).length(8).optional(),
  attributes: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number()]) })),
  badges: z.array(z.string()),
  performance: z.object({
    win_rate: z.number().min(0).max(100),
    mode_played: z.string(),
    avg_grade: z.string(),
    shot_efficiency: z.number().min(0).max(100),
    patch_version: z.string(),
  }),
});

app.post('/builds', authMiddleware, adminMiddleware, zValidator('json', createBuildSchema), async (c) => {
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

app.put('/builds/:id', authMiddleware, adminMiddleware, async (c) => {
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

  const intent = await stripe.paymentIntents.create(paymentIntentData);
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
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
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

export { app };

export default {
  fetch: app.fetch,
  port: 3002,
};
