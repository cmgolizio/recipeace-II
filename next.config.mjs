// Recipe images are served from Supabase Storage. Next.js loads .env.local
// before evaluating this config, so the host can be derived from
// NEXT_PUBLIC_SUPABASE_URL (works for both local and hosted projects).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const isLocalSupabase =
  supabaseUrl?.hostname === "127.0.0.1" ||
  supabaseUrl?.hostname === "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/**", supabaseUrl)]
      : [],
    // Next 16 refuses to optimize images from local IPs unless opted in;
    // needed when running against a local `supabase start` stack.
    ...(isLocalSupabase ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
