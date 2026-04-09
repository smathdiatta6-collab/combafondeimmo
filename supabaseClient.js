import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://mmlukdzcjtyaycimaqen.supabase.co"
const supabaseKey = "sb_publishable_CfSYydaadArckIquDUTBcQ_2BPuDi2a"

export const supabase = createClient(supabaseUrl, supabaseKey)
