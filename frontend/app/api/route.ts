import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return new Response('Proxy route placeholder');
}
