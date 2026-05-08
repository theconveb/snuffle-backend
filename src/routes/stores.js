const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// ─── PUBLIC ENDPOINTS (no auth needed) ───────────────────

// GET /api/stores/search?medicine=&lat=&lng=&radius_km=&species=
// THE CORE FEATURE — find stores near you that have the medicine
router.get('/search', async (req, res) => {
  try {
    const { medicine, lat, lng, radius_km = 10, species, city } = req.query;
    if (!medicine) return res.status(400).json({ error: 'medicine name required' });

    // Search inventory for matching medicine
    let invQuery = supabase.from('store_inventory')
      .select('*, medicine_stores(id, name, address, city, lat, lng, phone, opening_time, closing_time, open_days, is_verified)')
      .ilike('medicine_name', `%${medicine}%`)
      .eq('in_stock', true)
      .eq('medicine_stores.is_active', true);

    if (species) invQuery = invQuery.contains('for_species', [species]);

    const { data: inventory, error } = await invQuery;
    if (error) throw error;

    let results = (inventory || []).filter(i => i.medicine_stores);

    // Filter by distance if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radius = parseFloat(radius_km);

      results = results.map(item => {
        const store = item.medicine_stores;
        if (!store.lat || !store.lng) return null;
        const distance = haversine(userLat, userLng, store.lat, store.lng);
        return { ...item, distance_km: Math.round(distance * 10) / 10 };
      }).filter(item => item && item.distance_km <= radius)
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    // Filter by city if no GPS
    if (city && !lat) {
      results = results.filter(i => i.medicine_stores?.city?.toLowerCase().includes(city.toLowerCase()));
    }

    res.json({
      medicine,
      results_count: results.length,
      results: results.map(i => ({
        store: i.medicine_stores,
        medicine_name: i.medicine_name,
        brand: i.brand,
        price: i.price,
        stock_quantity: i.stock_quantity,
        category: i.category,
        distance_km: i.distance_km || null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores/nearby?lat=&lng=&radius_km= — show all stores on map
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius_km = 10, city } = req.query;

    const { data: stores, error } = await supabase.from('medicine_stores')
      .select('id, name, address, city, lat, lng, phone, opening_time, closing_time, open_days, is_verified, listing_plan')
      .eq('is_active', true);
    if (error) throw error;

    let results = stores || [];

    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radius = parseFloat(radius_km);

      results = results.map(store => {
        if (!store.lat || !store.lng) return null;
        const distance = haversine(userLat, userLng, store.lat, store.lng);
        return { ...store, distance_km: Math.round(distance * 10) / 10 };
      }).filter(s => s && s.distance_km <= radius)
        .sort((a, b) => a.distance_km - b.distance_km);
    } else if (city) {
      results = results.filter(s => s.city?.toLowerCase().includes(city.toLowerCase()));
    }

    res.json({ count: results.length, stores: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores/:id — single store with full inventory
router.get('/:id', async (req, res) => {
  try {
    const { data: store, error: storeErr } = await supabase.from('medicine_stores')
      .select('*').eq('id', req.params.id).single();
    if (storeErr) throw storeErr;

    const { data: inventory } = await supabase.from('store_inventory')
      .select('*').eq('store_id', req.params.id).order('medicine_name');

    res.json({ ...store, inventory: inventory || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STORE OWNER ENDPOINTS (auth required) ───────────────

// POST /api/stores — register your store
router.post('/', auth, async (req, res) => {
  try {
    const { name, address, city, state, pincode, phone, email, lat, lng, opening_time, closing_time, open_days } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const { data, error } = await supabase.from('medicine_stores')
      .insert({ owner_id: req.userId, name, address, city, state, pincode, phone, email, lat, lng, opening_time, closing_time, open_days })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores/my-store — get store owned by logged-in user
router.get('/my-store', auth, async (req, res) => {
  try {
    const { data: store, error } = await supabase
      .from('medicine_stores')
      .select('*')
      .eq('owner_id', req.userId)
      .single();

    if (error || !store) return res.status(404).json({ error: 'No store found for this account' });

    const { data: inventory } = await supabase
      .from('store_inventory')
      .select('*')
      .eq('store_id', store.id)
      .order('medicine_name');

    res.json({ ...store, inventory: inventory || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:id — update store info
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, address, phone, lat, lng, opening_time, closing_time, open_days } = req.body;
    const { data, error } = await supabase.from('medicine_stores')
      .update({ name, address, phone, lat, lng, opening_time, closing_time, open_days, updated_at: new Date() })
      .eq('id', req.params.id).eq('owner_id', req.userId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INVENTORY MANAGEMENT ────────────────────────────────

// GET /api/stores/:id/inventory
router.get('/:id/inventory', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_inventory')
      .select('*').eq('store_id', req.params.id).order('medicine_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/inventory — add medicine to store
router.post('/:id/inventory', auth, async (req, res) => {
  try {
    const { medicine_name, brand, category, for_species, price, in_stock, stock_quantity } = req.body;
    if (!medicine_name) return res.status(400).json({ error: 'medicine_name required' });

    const { data, error } = await supabase.from('store_inventory')
      .insert({ store_id: req.params.id, medicine_name, brand, category, for_species: for_species || ['dog', 'cat'], price, in_stock: in_stock !== false, stock_quantity })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:id/inventory/:itemId — update stock
router.patch('/:id/inventory/:itemId', auth, async (req, res) => {
  try {
    const { in_stock, stock_quantity, price } = req.body;
    const { data, error } = await supabase.from('store_inventory')
      .update({ in_stock, stock_quantity, price, updated_at: new Date() })
      .eq('id', req.params.itemId).eq('store_id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stores/:id/inventory/:itemId
router.delete('/:id/inventory/:itemId', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('store_inventory')
      .delete().eq('id', req.params.itemId).eq('store_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPER: Haversine distance formula ──────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(deg) { return deg * Math.PI / 180; }

module.exports = router;
