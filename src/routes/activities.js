const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/activities?pet_id=&type=&from=&to=
router.get('/', auth, async (req, res) => {
  try {
    const { pet_id, type, from, to, limit = 50 } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let query = supabase.from('activity_sessions').select('*')
      .eq('pet_id', pet_id).order('started_at', { ascending: false }).limit(parseInt(limit));

    if (type) query = query.eq('session_type', type);
    if (from) query = query.gte('started_at', from);
    if (to) query = query.lte('started_at', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities — start or log a session
router.post('/', auth, async (req, res) => {
  try {
    const { pet_id, session_type, started_at, ended_at, duration_seconds, distance_km, route_geojson, calories_burned, notes } = req.body;
    if (!pet_id || !session_type) return res.status(400).json({ error: 'pet_id and session_type required' });

    const { data, error } = await supabase.from('activity_sessions')
      .insert({ pet_id, session_type, started_at, ended_at, duration_seconds, distance_km, route_geojson, calories_burned, notes })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/activities/:id — end a live session / update route
router.patch('/:id', auth, async (req, res) => {
  try {
    const { ended_at, duration_seconds, distance_km, route_geojson, calories_burned, notes } = req.body;
    const { data, error } = await supabase.from('activity_sessions')
      .update({ ended_at, duration_seconds, distance_km, route_geojson, calories_burned, notes })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/activities/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('activity_sessions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Session removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/activities/stats?pet_id=&period=7
router.get('/stats', auth, async (req, res) => {
  try {
    const { pet_id, period = 7 } = req.query;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));

    const { data, error } = await supabase.from('activity_sessions')
      .select('session_type, duration_seconds, distance_km, calories_burned')
      .eq('pet_id', pet_id).gte('started_at', from.toISOString());
    if (error) throw error;

    const stats = { walks: 0, play: 0, total_distance_km: 0, total_duration_min: 0, total_calories: 0 };
    (data || []).forEach(s => {
      if (s.session_type === 'walk' || s.session_type === 'run') stats.walks++;
      else stats.play++;
      stats.total_distance_km += parseFloat(s.distance_km || 0);
      stats.total_duration_min += Math.round((s.duration_seconds || 0) / 60);
      stats.total_calories += parseFloat(s.calories_burned || 0);
    });

    res.json({ period: parseInt(period), sessions: data.length, ...stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
