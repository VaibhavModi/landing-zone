export default function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).send('');
    return;
  }

  const body = request.body;
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  console.error('[csp-report]', text.slice(0, 500));
  response.status(204).send('');
}
