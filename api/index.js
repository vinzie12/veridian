const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test route
app.get('/', async (req, res) => {
  const { data, error } = await supabase.from('agencies').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Veridian API is running', agencies: data });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});