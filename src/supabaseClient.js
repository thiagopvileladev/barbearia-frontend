import { createClient } from '@supabase/supabase-js';

// Você pega essas chaves lá no painel do Supabase em: Project Settings > API
const supabaseUrl = 'https://jxnnurmxqxbyxqccgvlv.supabase.co/rest/v1/';
const supabaseKey = 'SUA_CHAVE_ANON_PUBLIC';

export const supabase = createClient(supabaseUrl, supabaseKey);