const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/routines?pet_id=
router.get('/', auth, async (req, res) => {
  try {
    const { pet_id } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    const { data, error } = await supabase.from('routines')
      .select('*, routine_completions(id, completed_at)')
      .eq('pet_id', pet_id).eq('is_active', true)
      .order('created_at');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines
router.post('/', auth, async (req, res) => {
  try {
    const { pet_id, name, routine_type, frequency, scheduled_time, scheduled_days } = req.body;
    if (!pet_id || !name) return res.status(400).json({ error: 'pet_id and name required' });

    const { data, error } = await supabase.from('routines')
      .insert({ pet_id, name, routine_type, frequency, scheduled_time, scheduled_days })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/routines/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, routine_type, frequency, scheduled_time, scheduled_days, is_active } = req.body;
    const { data, error } = await supabase.from('routines')
      .update({ name, routine_type, frequency, scheduled_time, scheduled_days, is_active })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/routines/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('routines').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Routine removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines/:id/complete — mark routine done today
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const { pet_id, notes } = req.body;
    const { data, error } = await supabase.from('routine_completions')
      .insert({ routine_id: req.params.id, pet_id, notes })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routines/:id/streak — streak data for 7/14/30 days
router.get('/:id/streak', auth, async (req, res) => {
  try {
    const { period = 30 } = req.query;
    const days = parseInt(period);
    const from = new Date();
    from.setDate(from.getDate() - days);

    const { data: completions, error } = await supabase.from('routine_completions')
      .select('completed_at').eq('routine_id', req.params.id)
      .gte('completed_at', from.toISOString())
      .order('completed_at');
    if (error) throw error;

    // Build day-by-day consistency chart
    const chart = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const done = completions.some(c => c.completed_at.startsWith(dateStr));
      chart.push({ date: dateStr, completed: done });
    }

    // Calculate current streak
    let streak = 0;
    for (let i = chart.length - 1; i >= 0; i--) {
      if (chart[i].completed) streak++;
      else break;
    }

    const consistency = Math.round((completions.length / days) * 100);

    res.json({
      period: days,
      current_streak: streak,
      total_completions: completions.length,
      consistency_pct: consistency,
      chart
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
