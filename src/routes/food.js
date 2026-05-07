const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/food — list food items for user
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('food_items').select('*')
      .eq('user_id', req.userId).order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/food — create food item
router.post('/', auth, async (req, res) => {
  try {
    const { name, brand, calories_per_100g, cost_per_unit, unit, current_stock, low_stock_threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase.from('food_items')
      .insert({ user_id: req.userId, name, brand, calories_per_100g, cost_per_unit, unit, current_stock, low_stock_threshold })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/food/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, brand, calories_per_100g, cost_per_unit, unit, current_stock, low_stock_threshold } = req.body;
    const { data, error } = await supabase.from('food_items')
      .update({ name, brand, calories_per_100g, cost_per_unit, unit, current_stock, low_stock_threshold, updated_at: new Date() })
      .eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/food/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('food_items').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Food item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/food/logs?pet_id=&from=&to=
router.get('/logs', auth, async (req, res) => {
  try {
    const { pet_id, from, to, limit = 50 } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let query = supabase.from('feeding_logs')
      .select('*, food_items(name, brand, calories_per_100g)')
      .eq('pet_id', pet_id)
      .order('fed_at', { ascending: false })
      .limit(parseInt(limit));

    if (from) query = query.gte('fed_at', from);
    if (to) query = query.lte('fed_at', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/food/logs — log a feeding (auto-deducts stock)
router.post('/logs', auth, async (req, res) => {
  try {
    const { pet_id, food_item_id, quantity, unit, notes, fed_at } = req.body;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let calories = null;
    let cost = null;

    // Auto-calculate calories and cost from food item
    if (food_item_id) {
      const { data: food } = await supabase.from('food_items').select('*').eq('id', food_item_id).single();
      if (food) {
        if (food.calories_per_100g && quantity) {
          calories = (food.calories_per_100g / 100) * parseFloat(quantity);
        }
        if (food.cost_per_unit && quantity) {
          cost = food.cost_per_unit * parseFloat(quantity);
        }
        // Auto-deduct stock
        if (food.current_stock && quantity) {
          const newStock = Math.max(0, parseFloat(food.current_stock) - parseFloat(quantity));
          await supabase.from('food_items').update({ current_stock: newStock, updated_at: new Date() }).eq('id', food_item_id);

          // Low stock notification
          if (newStock <= (food.low_stock_threshold || 0)) {
            await supabase.from('notifications').insert({
              user_id: req.userId, pet_id,
              title: `Low stock: ${food.name}`,
              body: `Only ${newStock} ${food.unit || 'units'} remaining of ${food.name}.`,
              type: 'custom'
            });
          }
        }
      }
    }

    const { data, error } = await supabase.from('feeding_logs')
      .insert({ pet_id, food_item_id, quantity, unit, calories, cost, notes, fed_at: fed_at || new Date() })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/food/logs/summary?pet_id=&period=7
router.get('/logs/summary', auth, async (req, res) => {
  try {
    const { pet_id, period = 7 } = req.query;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));

    const { data, error } = await supabase.from('feeding_logs')
      .select('calories, cost, fed_at').eq('pet_id', pet_id).gte('fed_at', from.toISOString());
    if (error) throw error;

    const totalCalories = (data || []).reduce((s, l) => s + (parseFloat(l.calories) || 0), 0);
    const totalCost = (data || []).reduce((s, l) => s + (parseFloat(l.cost) || 0), 0);

    res.json({ period: parseInt(period), meals: data.length, total_calories: totalCalories, total_cost: totalCost });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
