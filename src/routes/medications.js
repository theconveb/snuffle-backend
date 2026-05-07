const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// ─── HEALTH CONDITIONS ────────────────────────────────────

// GET /api/medications/conditions?pet_id=
router.get('/conditions', auth, async (req, res) => {
  try {
    const { pet_id } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });
    const { data, error } = await supabase.from('health_conditions')
      .select('*, medications(*)')
      .eq('pet_id', pet_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medications/conditions
router.post('/conditions', auth, async (req, res) => {
  try {
    const { pet_id, name, type, diagnosed_date, notes } = req.body;
    if (!pet_id || !name) return res.status(400).json({ error: 'pet_id and name required' });
    const { data, error } = await supabase.from('health_conditions')
      .insert({ pet_id, name, type, diagnosed_date, notes })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/medications/conditions/:id
router.patch('/conditions/:id', auth, async (req, res) => {
  try {
    const { name, type, diagnosed_date, notes, is_active } = req.body;
    const { data, error } = await supabase.from('health_conditions')
      .update({ name, type, diagnosed_date, notes, is_active })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/medications/conditions/:id
router.delete('/conditions/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('health_conditions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Condition removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MEDICATIONS ────────────────────────────────────────

// GET /api/medications?pet_id=&active=true
router.get('/', auth, async (req, res) => {
  try {
    const { pet_id, active } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    let query = supabase.from('medications').select('*, health_conditions(name)')
      .eq('pet_id', pet_id).order('created_at', { ascending: false });
    if (active === 'true') query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medications
router.post('/', auth, async (req, res) => {
  try {
    const { pet_id, condition_id, name, dosage, frequency, start_date, end_date, refill_date, notes } = req.body;
    if (!pet_id || !name) return res.status(400).json({ error: 'pet_id and name required' });

    const { data, error } = await supabase.from('medications')
      .insert({ pet_id, condition_id, name, dosage, frequency, start_date, end_date, refill_date, notes })
      .select().single();
    if (error) throw error;

    // Auto-create notification for refill date
    if (refill_date) {
      await supabase.from('notifications').insert({
        user_id: req.userId,
        pet_id,
        title: `Refill needed: ${name}`,
        body: `Time to refill ${name} for your pet.`,
        type: 'refill',
        scheduled_at: new Date(refill_date)
      });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/medications/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, dosage, frequency, start_date, end_date, refill_date, notes, is_active, condition_id } = req.body;
    const { data, error } = await supabase.from('medications')
      .update({ name, dosage, frequency, start_date, end_date, refill_date, notes, is_active, condition_id, updated_at: new Date() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/medications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('medications').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Medication removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VACCINATIONS ────────────────────────────────────────

// GET /api/medications/vaccinations?pet_id=
router.get('/vaccinations', auth, async (req, res) => {
  try {
    const { pet_id } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });
    const { data, error } = await supabase.from('vaccinations')
      .select('*').eq('pet_id', pet_id).order('administered_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medications/vaccinations
router.post('/vaccinations', auth, async (req, res) => {
  try {
    const { pet_id, name, administered_date, next_due_date, vet_name, clinic_name, batch_number, notes } = req.body;
    if (!pet_id || !name) return res.status(400).json({ error: 'pet_id and name required' });

    const { data, error } = await supabase.from('vaccinations')
      .insert({ pet_id, name, administered_date, next_due_date, vet_name, clinic_name, batch_number, notes })
      .select().single();
    if (error) throw error;

    if (next_due_date) {
      await supabase.from('notifications').insert({
        user_id: req.userId, pet_id,
        title: `Vaccination due: ${name}`,
        body: `Time for ${name} vaccination.`,
        type: 'vaccination',
        scheduled_at: new Date(next_due_date)
      });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/medications/vaccinations/:id
router.delete('/vaccinations/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('vaccinations').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Vaccination removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
