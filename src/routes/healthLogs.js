const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/health-logs?pet_id=&type=&from=&to=
router.get('/', auth, async (req, res) => {
  try {
    const { pet_id, type, from, to, limit = 50 } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let query = supabase.from('health_logs').select('*').eq('pet_id', pet_id)
      .order('logged_at', { ascending: false }).limit(parseInt(limit));

    if (type) query = query.eq('log_type', type);
    if (from) query = query.gte('logged_at', from);
    if (to) query = query.lte('logged_at', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/health-logs
router.post('/', auth, async (req, res) => {
  try {
    const { pet_id, log_type, severity, notes, logged_at } = req.body;
    if (!pet_id || !log_type) return res.status(400).json({ error: 'pet_id and log_type required' });

    const { data, error } = await supabase.from('health_logs')
      .insert({ pet_id, log_type, severity, notes, logged_at: logged_at || new Date() })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/health-logs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('health_logs').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health-logs/insights?pet_id=&period=7|14|30
router.get('/insights', auth, async (req, res) => {
  try {
    const { pet_id, period = 7 } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));

    const { data, error } = await supabase.from('health_logs').select('log_type, logged_at, severity')
      .eq('pet_id', pet_id).gte('logged_at', from.toISOString());
    if (error) throw error;

    const summary = {};
    (data || []).forEach(log => {
      summary[log.log_type] = (summary[log.log_type] || 0) + 1;
    });

    res.json({ period: parseInt(period), total: data.length, by_type: summary, logs: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
