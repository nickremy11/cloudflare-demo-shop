export async function onRequest({ request, next }) {
  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const bm = request.cf?.botManagement ?? {};
  const script = `<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'cfBotScore': ${bm.score ?? 'null'},
  'cfVerifiedBot': ${String(bm.verifiedBot ?? false)},
  'cfDetectionIds': ${JSON.stringify(bm.detectionIds ?? [])}
});
</script>`;

  let injected = false;
  return new HTMLRewriter()
    .on('script', {
      element(el) {
        if (!injected) {
          el.before(script, { html: true });
          injected = true;
        }
      }
    })
    .transform(response);
}