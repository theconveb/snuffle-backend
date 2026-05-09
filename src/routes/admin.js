const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// ─── Admin middleware ─────────────────────
const adminOnly = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users').select('role').eq('id', req.userId).single();
    if (error || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DASHBOARD STATS ─────────────────────

// GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalPetOwners },
      { count: totalStoreOwners },
      { count: totalStores },
      { count: pendingStores },
      { count: verifiedStores },
      { count: totalPets },
      { count: totalMedicines },
      { count: totalHealthLogs },
      { count: totalExpenses },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'pet_owner'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'store_owner'),
      supabase.from('medicine_stores').select('*', { count: 'exact', head: true }),
      supabase.from('medicine_stores').select('*', { count: 'exact', head: true }).eq('is_verified', false).eq('is_active', true),
      supabase.from('medicine_stores').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('pets').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('store_inventory').select('*', { count: 'exact', head: true }),
      supabase.from('health_logs').select('*', { count: 'exact', head: true }),
      supabase.from('expenses').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      users: { total: totalUsers, pet_owners: totalPetOwners, store_owners: totalStoreOwners },
      stores: { total: totalStores, pending: pendingStores, verified: verifiedStores },
      pets: totalPets,
      medicines: totalMedicines,
      health_logs: totalHealthLogs,
      expenses: totalExpenses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER MANAGEMENT ─────────────────────

// GET /api/admin/users?role=&search=&limit=&offset=
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('users')
      .select('id, email, full_name, phone, role, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (role) query = query.eq('role', role);
    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ users: data || [], total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/:id — full user detail
router.get('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users')
      .select('id, email, full_name, phone, role, avatar_url, created_at')
      .eq('id', req.params.id).single();
    if (error) throw error;

    // Get pets if pet owner
    const { data: pets } = await supabase.from('pets')
      .select('*').eq('user_id', req.params.id);

    // Get store if store owner
    const { data: store } = await supabase.from('medicine_stores')
      .select('*').eq('owner_id', req.params.id).single();

    res.json({ ...user, pets: pets || [], store: store || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id — update user role
router.patch('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { role, full_name, phone } = req.body;
    const validRoles = ['pet_owner', 'store_owner', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const { data, error } = await supabase.from('users')
      .update({ role, full_name, phone, updated_at: new Date() })
      .eq('id', req.params.id)
      .select('id, email, full_name, phone, role').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    // Prevent deleting self
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STORE MANAGEMENT ────────────────────

// GET /api/admin/stores?verified=&search=
router.get('/stores', auth, adminOnly, async (req, res) => {
  try {
    const { verified, search, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('medicine_stores')
      .select('*, users(full_name, email)')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (verified === 'true') query = query.eq('is_verified', true);
    if (verified === 'false') query = query.eq('is_verified', false);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ stores: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stores/:id — full store detail with inventory
router.get('/stores/:id', auth, adminOnly, async (req, res) => {
  try {
    const { data: store, error } = await supabase.from('medicine_stores')
      .select('*, users(full_name, email, phone)')
      .eq('id', req.params.id).single();
    if (error) throw error;

    const { data: inventory } = await supabase.from('store_inventory')
      .select('*').eq('store_id', req.params.id).order('medicine_name');

    res.json({ ...store, inventory: inventory || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/stores/:id/verify — verify or reject store
router.patch('/stores/:id/verify', auth, adminOnly, async (req, res) => {
  try {
    const { is_verified, is_active } = req.body;
    const { data, error } = await supabase.from('medicine_stores')
      .update({ is_verified, is_active, updated_at: new Date() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/stores/:id — edit any store field
router.patch('/stores/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, address, city, state, pincode, phone, email,
      lat, lng, opening_time, closing_time, listing_plan } = req.body;
    const { data, error } = await supabase.from('medicine_stores')
      .update({ name, address, city, state, pincode, phone, email,
        lat, lng, opening_time, closing_time, listing_plan, updated_at: new Date() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/stores/:id — remove store
router.delete('/stores/:id', auth, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase.from('medicine_stores').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Store deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INVENTORY MANAGEMENT ────────────────

// GET /api/admin/inventory?store_id=&search=
router.get('/inventory', auth, adminOnly, async (req, res) => {
  try {
    const { store_id, search } = req.query;
    let query = supabase.from('store_inventory')
      .select('*, medicine_stores(name, city)')
      .order('medicine_name');

    if (store_id) query = query.eq('store_id', store_id);
    if (search) query = query.ilike('medicine_name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ inventory: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/inventory/:id — remove medicine
router.delete('/inventory/:id', auth, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase.from('store_inventory').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Medicine removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PET MANAGEMENT ──────────────────────

// GET /api/admin/pets?search=
router.get('/pets', auth, adminOnly, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('pets')
      .select('*, users(full_name, email)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ pets: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NOTIFICATIONS ───────────────────────

// POST /api/admin/notify — send notification to all users or specific user
router.post('/notify', auth, adminOnly, async (req, res) => {
  try {
    const { user_id, title, body, type = 'custom' } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    if (user_id) {
      // Send to specific user
      await supabase.from('notifications')
        .insert({ user_id, title, body, type });
    } else {
      // Send to all users
      const { data: users } = await supabase.from('users').select('id');
      const notifications = (users || []).map(u => ({ user_id: u.id, title, body, type }));
      await supabase.from('notifications').insert(notifications);
    }
    res.json({ message: 'Notification sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH LOGS (read only) ──────────────

// GET /api/admin/health-logs?pet_id=
router.get('/health-logs', auth, adminOnly, async (req, res) => {
  try {
    const { pet_id, limit = 100 } = req.query;
    let query = supabase.from('health_logs').select('*, pets(name)')
      .order('logged_at', { ascending: false }).limit(parseInt(limit));
    if (pet_id) query = query.eq('pet_id', pet_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPENSES (read only) ─────────────────

// GET /api/admin/expenses
router.get('/expenses', auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase.from('expenses')
      .select('*, pets(name)')
      .order('expense_date', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;