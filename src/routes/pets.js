const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/pets — list all pets for user
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pets')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pets — create pet
router.post('/', auth, async (req, res) => {
  try {
    const { name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url } = req.body;
    if (!name || !species) return res.status(400).json({ error: 'Name and species required' });

    const { data, error } = await supabase.from('pets')
      .insert({ user_id: req.userId, name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pets')
      .select(`*, health_conditions(*), medications(*), vaccinations(*), health_conditions(*)`)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pets/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url } = req.body;
    const { data, error } = await supabase.from('pets')
      .update({ name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pets/:id (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('pets')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Pet removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id/summary — dashboard summary for one pet
router.get('/:id/summary', auth, async (req, res) => {
  try {
    const petId = req.params.id;
    const [petRes, logsRes, medsRes, routinesRes, expensesRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('health_logs').select('*').eq('pet_id', petId).order('logged_at', { ascending: false }).limit(10),
      supabase.from('medications').select('*').eq('pet_id', petId).eq('is_active', true),
      supabase.from('routines').select('*, routine_completions(completed_at)').eq('pet_id', petId).eq('is_active', true),
      supabase.from('expenses').select('category, amount').eq('pet_id', petId)
        .gte('expense_date', new Date(new Date().setDate(1)).toISOString().split('T')[0])
    ]);

    const totalMonthlySpend = (expensesRes.data || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      pet: petRes.data,
      recent_logs: logsRes.data || [],
      active_medications: medsRes.data || [],
      routines: routinesRes.data || [],
      monthly_spend: totalMonthlySpend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
