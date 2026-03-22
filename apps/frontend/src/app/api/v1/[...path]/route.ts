const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:4000';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function buildTargetUrl(request: Request, path: string[]) {
  const incomingUrl = new URL(request.url);
  const targetPath = path.join('/');
  return new URL(`/api/v1/${targetPath}${incomingUrl.search}`, BACKEND_ORIGIN);
}

function createForwardHeaders(request: Request) {
  const headers = new Headers();

  const headerNames = ['accept', 'authorization', 'content-type', 'cookie', 'x-request-id', 'x-user-id'];
  for (const headerName of headerNames) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

async function forwardRequest(request: Request, path: string[]) {
  const targetUrl = buildTargetUrl(request, path);
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const backendResponse = await fetch(targetUrl, {
    method,
    headers: createForwardHeaders(request),
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}
