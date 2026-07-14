import { createClient } from "@supabase/supabase-js";

// ★★★ 아래 2줄을 본인의 Supabase 프로젝트 정보로 교체하세요 ★★★
const SUPABASE_URL = "https://azvreasrddwpidmyeeio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dnJlYXNyZGR3cGlkbXllZWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDAwMDUsImV4cCI6MjA5OTU3NjAwNX0.GWlvhngzzfNIG-ZZy-zivW9aEhcWYMR7ZEJZg7o-xOM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
