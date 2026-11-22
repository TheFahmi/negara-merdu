/** @type {import('next').NextConfig} */
const nextConfig = {
  // Artefak standalone: server tipis `node server.js` untuk container runtime.
  output: "standalone",
  // Kode game di game/*.js adalah JS vanilla warisan (bukan React) — lint
  // bawaan Next tidak relevan untuknya; build tidak digagalkan oleh lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
