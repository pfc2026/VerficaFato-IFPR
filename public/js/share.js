// This action shares the public site, without including private queries or account data.
export async function shareSite({ status = document.getElementById('shareStatus'), nav = navigator, origin = window.location.origin } = {}) {
  const data = { title: 'VerificaFato — Aprenda a verificar', text: 'Investigue informações e aprenda a verificar antes de compartilhar.', url: origin + '/' };
  const message = value => { if (status) status.textContent = value; };
  if (typeof nav.share === 'function') {
    try { await nav.share(data); message('Compartilhamento do site concluído.'); return; }
    catch (error) { if (error.name === 'AbortError') { message('Compartilhamento cancelado.'); return; } }
  }
  if (nav.clipboard?.writeText) {
    try { await nav.clipboard.writeText(data.url); message('Link do site copiado. Esta análise não está incluída.'); return; }
    catch { /* Provide the address when clipboard permission is unavailable. */ }
  }
  message('Copie o endereço do site: ' + data.url + ' Esta análise não está incluída.');
}
