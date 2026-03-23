export async function GET() {
  return Response.json({
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev',
  })
}
