// Picks the event store: Supabase when its keys are set in .env, otherwise local files.
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
module.exports = useSupabase ? require("./supabase") : require("./file");
