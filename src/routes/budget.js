const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/budget?pet_id=&from=&to=
router.get('/', auth, async (req, res) => {
  try {
    const { pet_id, from, to, limit = 100 } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let query = supabase.from('expenses').select('*')
      .eq('pet_id', pet_id).order('expense_date', { ascending: false }).limit(parseInt(limit));

    if (from) query = query.gte('expense_date', from);
    if (to) query = query.lte('expense_date', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budget
router.post('/', auth, async (req, res) => {
  try {
    const { pet_id, category, amount, description, expense_date, receipt_url } = req.body;
    if (!pet_id || !category || !amount) return res.status(400).json({ error: 'pet_id, category, and amount required' });

    const { data, error } = await supabase.from('expenses')
      .insert({ pet_id, category, amount, description, expense_date: expense_date || new Date().toISOString().split('T')[0], receipt_url })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/budget/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { category, amount, description, expense_date, receipt_url } = req.body;
    const { data, error } = await supabase.from('expenses')
      .update({ category, amount, description, expense_date, receipt_url })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budget/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Expense removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget/insights?pet_id=&year=&month=
router.get('/insights', auth, async (req, res) => {
  try {
    const { pet_id } = req.query;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;

    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = new Date(year, month, 0);
    const to = toDate.toISOString().split('T')[0];

    const { data, error } = await supabase.from('expenses').select('category, amount')
      .eq('pet_id', pet_id).gte('expense_date', from).lte('expense_date', to);
    if (error) throw error;

    const byCategory = {};
    let total = 0;
    (data || []).forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount);
      total += parseFloat(e.amount);
    });

    const breakdown = Object.entries(byCategory).map(([category, amount]) => ({
      category, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    res.json({ year, month, total, breakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
