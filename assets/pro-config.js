/* Pro: Supabase connection.
   Fill these in from Supabase > Project Settings > API ("Project URL" and the "anon public" / publishable key).
   Both are safe to publish: the anon key can only do what the database policies in supabase/schema.sql allow.
   Never put the service_role / secret key here; that one lives only in GitHub Actions secrets.
   While these are empty, Pro keeps using the old single password and the files in pro/. */
window.PARADE_SUPABASE = {
  url: "",
  anonKey: ""
};
