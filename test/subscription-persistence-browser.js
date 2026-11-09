// Run in the rendered local app with preview_evaluate or browser-agent's page.evaluate.
// All API requests made during this journey are intercepted; use a credential-free
// local server with outbound requests blocked for initial page/group discovery too.
(async () => {
  const originalFetch = window.fetch;
  const originalAlert = window.alert;
  const requests = [];
  const alerts = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const waitFor = async (condition, message) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(message);
  };
  const button = text => [...document.querySelectorAll('button')]
    .find(element => element.textContent.trim() === text);
  const checkedCourses = () => [...document.querySelectorAll('input[type="checkbox"]')]
    .map(element => element.checked);
  const title = text => [...document.querySelectorAll('h3')]
    .some(element => element.textContent.trim() === text);
  const temporaryWarning = 'Temporary development URL: saved only in this server process. It may stop working after a restart or on another instance.';
  let mode = 'failed';
  window.alert = message => alerts.push(message);
  window.fetch = async (input, init) => {
    const path = new URL(typeof input === 'string' ? input : input.url, window.location.href).pathname;
    if (path !== '/api/generate-calendar') {
      return new Response(JSON.stringify({ success: false, error: 'Synthetic discovery unavailable' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify(mode === 'failed' ? {
      success: false, persistence: 'failed', retryable: true,
      error: 'Calendar persistence could not be confirmed. Please retry.'
    } : {
      success: true, persistence: mode,
      ...(mode === 'memory-only' ? { warning: temporaryWarning } : {}),
      data: { subscriptionUrl: 'https://calendar.example.test/api/calendar/synthetic-browser-token' }
    }), { status: mode === 'failed' ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const generate = button('Generate Calendar');
    assert(generate && !generate.disabled, 'Generate must be available with current selections');
    const before = checkedCourses();
    const name = document.querySelector('input[type="text"]').value;
    generate.click();
    await waitFor(() => alerts.length === 1, 'Failed save should report a retryable error');
    assert(alerts[0].includes('Please retry'), 'Failure should explain retry');
    assert(!title('Calendar Generated Successfully! 🎉'), 'Failure must not show normal success');
    assert(document.querySelector('input[type="text"]').value === name, 'Failure must retain name');
    assert(JSON.stringify(checkedCourses()) === JSON.stringify(before), 'Failure must retain selections');
    mode = 'durable';
    generate.click();
    await waitFor(() => title('Calendar Generated Successfully! 🎉'), 'Durable retry should show current success flow');
    assert(JSON.stringify(requests[0]) === JSON.stringify(requests[1]), 'Retry must send the same selections');
    assert(button('📋 Copy URL'), 'Durable success must offer copying');
    button('Close').click();
    await waitFor(() => !title('Calendar Generated Successfully! 🎉'), 'Success dialog should close');
    mode = 'memory-only';
    generate.click();
    await waitFor(() => title('Temporary Calendar URL'), 'Temporary fallback must have its own acknowledgement');
    assert(document.body.textContent.includes(temporaryWarning), 'Temporary URL must warn about process lifetime');
    assert(!title('Calendar Generated Successfully! 🎉'), 'Temporary URL must not show normal durable success');
    button('Close').click();
    await waitFor(() => !title('Temporary Calendar URL'), 'Temporary dialog should close');
    mode = 'durable';
    generate.click();
    await waitFor(() => title('Calendar Generated Successfully! 🎉'), 'Durable save after temporary fallback should clear warning');
    assert(!document.body.textContent.includes(temporaryWarning), 'Durable success must clear old temporary warning');
    button('Close').click();
    return { passed: true, interceptedWrites: requests.length, scenarios: ['failure preserves selections', 'durable retry', 'temporary warning', 'durable clears warning'] };
  } finally {
    window.fetch = originalFetch;
    window.alert = originalAlert;
  }
})()
