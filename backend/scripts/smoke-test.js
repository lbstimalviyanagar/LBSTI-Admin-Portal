const baseUrl = process.env.API_BASE_URL;
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;
const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!baseUrl || !username || !password) {
  console.error('Set API_BASE_URL, TEST_USERNAME and TEST_PASSWORD to run the live API CRUD check.');
  process.exit(1);
}

const apiBase = `${baseUrl.replace(/\/+$/, '')}/api`;
const call = async (path, options = {}, token) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${body?.message || ''}`);
  return { response, body };
};

async function main() {
  const { body: health } = await call('/health');
  if (!health.ok) throw new Error('API health check did not pass.');
  console.log('PASS API health and database connection');

  if (frontendOrigin) {
    const allowed = await fetch(`${apiBase}/health`, { headers: { Origin: frontendOrigin } });
    if (allowed.headers.get('access-control-allow-origin') !== frontendOrigin) throw new Error('Configured frontend origin was not allowed by CORS.');
    const denied = await fetch(`${apiBase}/health`, { headers: { Origin: 'https://not-allowed.invalid' } });
    if (denied.status !== 403) throw new Error('Unexpected origin was not rejected by CORS.');
    console.log('PASS restricted CORS policy');
  }

  const privateResponse = await fetch(`${apiBase}/enquiries`);
  if (privateResponse.status !== 401) throw new Error('Enquiry records must require authentication.');
  console.log('PASS protected enquiry routes');

  const { body: auth } = await call('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  if (!auth.token) throw new Error('Login did not return an API token.');
  const token = auth.token;
  console.log('PASS authentication');

  let enquiryId;
  let feeId;
  try {
    const marker = `API check ${Date.now()}`;
    const { body: created } = await call('/enquiries', { method: 'POST', body: JSON.stringify({ name: marker, phone: '0000000000', course: 'API verification', status: 'New' }) }, token);
    enquiryId = created.id;
    if (!enquiryId) throw new Error('Enquiry create response did not include an ID.');
    console.log('PASS enquiry create');

    const { body: listed } = await call('/enquiries', {}, token);
    if (!listed.some((item) => String(item.id) === String(enquiryId))) throw new Error('Created enquiry was not returned from the read endpoint.');
    console.log('PASS enquiry read');

    const { body: updated } = await call(`/enquiries/${enquiryId}`, { method: 'PATCH', body: JSON.stringify({ notes: marker }) }, token);
    if (updated.notes !== marker) throw new Error('Enquiry update was not persisted.');
    console.log('PASS enquiry update');

    await call(`/enquiries/${enquiryId}/remarks`, { method: 'POST', body: JSON.stringify({ text: marker }) }, token);
    const { body: remarks } = await call(`/enquiries/${enquiryId}/remarks`, {}, token);
    if (!remarks.some((item) => item.text === marker)) throw new Error('Remark was not persisted.');
    console.log('PASS remarks create and read');

    const { body: fee } = await call('/fees', { method: 'POST', body: JSON.stringify({ enquiryId, amount: 1, paymentDate: new Date().toISOString().slice(0, 10), mode: 'Other' }) }, token);
    feeId = fee.id;
    const { body: payments } = await call('/fees', {}, token);
    if (!payments.some((item) => String(item.id) === String(feeId))) throw new Error('Payment was not returned from the read endpoint.');
    console.log('PASS fee create and read');

    const { body: receipt } = await call('/receipts', { method: 'POST', body: JSON.stringify({ paymentId: feeId }) }, token);
    if (!receipt.receiptNumber) throw new Error('Receipt endpoint did not return a receipt number.');
    console.log('PASS receipt generation');

    await call(`/fees/${feeId}`, { method: 'DELETE' }, token);
    feeId = null;
    await call(`/enquiries/${enquiryId}`, { method: 'DELETE' }, token);
    enquiryId = null;
    const { body: afterDelete } = await call('/enquiries', {}, token);
    if (afterDelete.some((item) => String(item.id) === String(created.id))) throw new Error('Deleted enquiry is still present.');
    console.log('PASS fee and enquiry delete');
  } finally {
    if (feeId) await call(`/fees/${feeId}`, { method: 'DELETE' }, token).catch(() => {});
    if (enquiryId) await call(`/enquiries/${enquiryId}`, { method: 'DELETE' }, token).catch(() => {});
  }
}

main().catch((error) => {
  console.error('API verification failed:', error.message);
  process.exitCode = 1;
});