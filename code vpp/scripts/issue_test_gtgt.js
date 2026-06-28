(async () => {
  try {
    const orderNumber = 'ORD-1782287598231-497';
    const res = await fetch(`http://localhost:3000/gtgt-requests/${encodeURIComponent(orderNumber)}/issue`, { method: 'POST' });
    const text = await res.text();
    console.log('Status', res.status);
    console.log(text);
  } catch (e) {
    console.error('Error', e);
  }
})();
