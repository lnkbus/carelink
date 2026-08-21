/** @type {import('next').NextConfig} */
const nextConfig = {
  // packages/ui·shared-types는 소스 그대로 들어온다. 별도 빌드 단계를 두면
  // 토큰 하나 고칠 때마다 두 번 빌드하게 된다.
  transpilePackages: ['@carelink/ui', '@carelink/shared-types'],
  reactStrictMode: true,
};
export default nextConfig;
