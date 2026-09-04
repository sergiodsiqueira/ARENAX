#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "logo_branco.h"

// ============================================================
// ARENAX DEVICE - ESP32-WROOM-32
// Portal cativo + configuração Wi-Fi + POST por botão físico
// ============================================================

namespace Configuracao
{
  constexpr uint8_t PINO_BOTAO = 4;
  constexpr uint8_t PINO_LED = 2;
  constexpr uint32_t INTERVALO_LED_AP_MS = 120;
  constexpr uint16_t PORTA_DNS = 53;
  constexpr uint32_t TEMPO_CONEXAO_WIFI_MS = 20000;
  constexpr uint32_t DEBOUNCE_BOTAO_MS = 250;
  constexpr uint32_t INTERVALO_RECONEXAO_MS = 10000;
  constexpr uint32_t TEMPO_RETORNO_CONFIGURACAO_MS = 4000;
  constexpr uint32_t TEMPO_SINCRONIZACAO_RELOGIO_MS = 5000;

  const char* NAMESPACE_PREFERENCES = "arenax";
  const char* SENHA_ACCESS_POINT = "ArenaX@123";
  const char* CHAVE_SSID = "ssid";
  const char* CHAVE_SENHA = "senha";
  const char* CHAVE_URL = "url";
  const char* CHAVE_DEVICE_ID = "device_id";
}

WebServer Servidor(80);
DNSServer ServidorDns;
Preferences Preferencias;

String NumeroSerie;
String SsidSalvo;
String SenhaSalva;
String UrlPostSalva;
String DeviceIdSalvo;

bool UltimoEstadoBotao = HIGH;
uint32_t UltimoCliqueMs = 0;
uint32_t UltimaTentativaReconexaoMs = 0;

enum class TEstadoLed
{
  ModoAccessPoint,
  Conectado
};

TEstadoLed EstadoLed = TEstadoLed::ModoAccessPoint;
bool LedAceso = false;
uint32_t UltimaAlternanciaLedMs = 0;

String escaparHtml(const String& pTexto)
{
  String vResultado;
  vResultado.reserve(pTexto.length() + 16);

  for (size_t vIndice = 0; vIndice < pTexto.length(); vIndice++)
  {
    const char vCaractere = pTexto.charAt(vIndice);

    switch (vCaractere)
    {
      case '&': vResultado += F("&amp;"); break;
      case '<': vResultado += F("&lt;"); break;
      case '>': vResultado += F("&gt;"); break;
      case '"': vResultado += F("&quot;"); break;
      case '\'': vResultado += F("&#39;"); break;
      default: vResultado += vCaractere;
    }
  }

  return vResultado;
}

String escaparJson(const String& pTexto)
{
  String vResultado;
  vResultado.reserve(pTexto.length() + 8);

  for (size_t vIndice = 0; vIndice < pTexto.length(); vIndice++)
  {
    const char vCaractere = pTexto.charAt(vIndice);

    switch (vCaractere)
    {
      case '\\': vResultado += F("\\\\"); break;
      case '"': vResultado += F("\\\""); break;
      case '\b': vResultado += F("\\b"); break;
      case '\f': vResultado += F("\\f"); break;
      case '\n': vResultado += F("\\n"); break;
      case '\r': vResultado += F("\\r"); break;
      case '\t': vResultado += F("\\t"); break;
      default: vResultado += vCaractere;
    }
  }

  return vResultado;
}

String obterNumeroSerie()
{
  const uint64_t vMac = ESP.getEfuseMac();
  char vBuffer[18];

  snprintf(
    vBuffer,
    sizeof(vBuffer),
    "%04X%08X",
    static_cast<uint16_t>(vMac >> 32),
    static_cast<uint32_t>(vMac)
  );

  return String(vBuffer);
}

String obterNomeAccessPoint()
{
  return "ARENAX-" + NumeroSerie.substring(NumeroSerie.length() - 6);
}

String montarCabecalhoHtml(const String& pTitulo)
{
  String vHtml;
  vHtml.reserve(6200);

  vHtml += F(R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#082f24">
  <title>)rawliteral");
  vHtml += escaparHtml(pTitulo);
  vHtml += F(R"rawliteral(</title>
  <style>
    :root {
      --bg-top: #07231a;
      --bg-mid: #083224;
      --bg-bottom: #0b3b2c;
      --panel: rgba(255,255,255,.12);
      --panel-border: rgba(255,255,255,.18);
      --text: #ffffff;
      --muted: rgba(255,255,255,.72);
      --input: rgba(255,255,255,.13);
      --input-focus: rgba(255,255,255,.20);
      --shadow: rgba(9,61,120,.25);
      --button-text: #0b3b2c;
      --danger: #ffe0e0;
      --success: #dbffe9;
    }

    * { box-sizing: border-box; }

    html, body {
      min-height: 100%;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: var(--text);
      background-color: var(--bg-top);
      background-image:
        radial-gradient(circle 270px at calc(100% + 45px) 39%, rgba(24,167,112,.18) 0 99%, transparent 100%),
        radial-gradient(circle 190px at 45% calc(100% + 105px), rgba(78,211,158,.12) 0 99%, transparent 100%),
        linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
        linear-gradient(145deg, rgba(7,35,26,.98), rgba(8,50,36,.98));
      background-size: auto, auto, 72px 72px, 72px 72px, auto;
      background-attachment: fixed;
    }

    body {
      display: flex;
      justify-content: center;
      padding: 28px 16px 18px;
    }

    .page {
      width: min(100%, 480px);
      min-height: calc(100vh - 46px);
      display: flex;
      flex-direction: column;
    }

    .brand {
      margin: 36px 0 32px;
      text-align: center;
    }

    .brand img {
      display: block;
      width: min(100%, 252px);
      height: auto;
      margin: 0 auto;
    }

    .card {
      padding: 24px 20px;
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: 0 18px 46px var(--shadow);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .subtitle {
      margin: 0 0 24px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .field { margin-bottom: 18px; }

    label {
      display: block;
      margin: 0 0 8px 4px;
      font-size: 13px;
      font-weight: 700;
    }

    input, select {
      width: 100%;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 13px;
      outline: none;
      padding: 15px 16px;
      color: var(--text);
      background: var(--input);
      font: inherit;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      transition: .18s ease;
    }

    input::placeholder { color: rgba(255,255,255,.54); }

    input:focus, select:focus {
      background: var(--input-focus);
      border-color: rgba(255,255,255,.45);
      box-shadow: 0 0 0 3px rgba(255,255,255,.09);
    }

    select option { color: #173a5c; background: #ffffff; }

    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 52px; }

    .eye-button {
      position: absolute;
      top: 50%;
      right: 5px;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 11px;
      color: white;
      background: transparent;
      cursor: pointer;
    }

    .eye-button:active { background: rgba(255,255,255,.12); }
    .eye-button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; }

    .scan-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 9px;
    }

    .scan-button {
      min-width: 48px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 13px;
      color: white;
      background: rgba(255,255,255,.13);
      cursor: pointer;
    }

    .scan-button svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      transition: transform .35s ease;
    }

    .scan-button:active svg { transform: rotate(-180deg); }
    .scan-button:disabled { opacity: .55; cursor: wait; }
    .scan-button:disabled svg { animation: spin .8s linear infinite; }

    .primary {
      width: 100%;
      margin-top: 10px;
      padding: 17px 20px;
      border: 0;
      border-radius: 999px;
      color: var(--button-text);
      background: white;
      box-shadow: 0 10px 22px rgba(10,67,126,.26);
      font-size: 15px;
      font-weight: 800;
      letter-spacing: .05em;
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease;
    }

    .primary:active {
      transform: translateY(1px);
      box-shadow: 0 5px 12px rgba(10,67,126,.22);
    }

    .secondary {
      width: 100%;
      margin-top: 12px;
      padding: 15px 20px;
      border: 1px solid rgba(255,255,255,.38);
      border-radius: 999px;
      color: white;
      background: rgba(255,255,255,.10);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .05em;
      cursor: pointer;
      transition: background .15s ease, transform .15s ease;
    }

    .secondary:active {
      transform: translateY(1px);
      background: rgba(255,255,255,.18);
    }

    .hint {
      margin: 8px 4px 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.4;
    }

    .status-icon {
      width: 76px;
      height: 76px;
      display: grid;
      place-items: center;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: rgba(255,255,255,.16);
      border: 1px solid rgba(255,255,255,.24);
    }

    .status-icon svg {
      width: 44px;
      height: 44px;
      fill: currentColor;
    }

    .status-title {
      margin: 0 0 10px;
      text-align: center;
      font-size: 24px;
    }

    .status-message {
      margin: 0;
      text-align: center;
      color: var(--muted);
      line-height: 1.6;
    }

    .details {
      margin-top: 22px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(255,255,255,.10);
      color: rgba(255,255,255,.86);
      font-size: 13px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .footer {
      margin-top: auto;
      padding: 26px 4px 4px;
      text-align: center;
      color: rgba(255,255,255,.28);
      font-size: 9px;
      letter-spacing: .12em;
      user-select: text;
    }

    .loader {
      width: 18px;
      height: 18px;
      display: inline-block;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin .8s linear infinite;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 420px) {
      body { padding: 16px 12px 12px; }
      .page { min-height: calc(100vh - 28px); }
      .brand { margin-top: 22px; }
      .card { padding: 22px 16px; border-radius: 20px; }
    }
  </style>
</head>
<body>
<div class="page">
)rawliteral");

  return vHtml;
}

String montarRodapeHtml()
{
  String vHtml;
  vHtml.reserve(420);
  vHtml += F("<footer class=\"footer\">SERIAL ");
  vHtml += escaparHtml(NumeroSerie);
  vHtml += F(R"rawliteral(</footer>
</div>
</body>
</html>)rawliteral");
  return vHtml;
}

String montarPaginaConfiguracao()
{
  String vHtml = montarCabecalhoHtml("ARENAX DEVICE");
  vHtml.reserve(13000);

  vHtml += F(R"rawliteral(
  <header class="brand"><img src="/logo.png" alt="ARENAX DEVICE" width="252" height="84"></header>

  <main class="card">
    <p class="subtitle">Configure a rede Wi-Fi e os dados enviados quando o bot&atilde;o do dispositivo for pressionado.</p>

    <form method="POST" action="/salvar" id="configForm">
      <div class="field">
        <label for="ssid">Rede Wi-Fi</label>
        <div class="scan-row">
          <select id="ssid" name="ssid" required>
            <option value="">Vasculhando redes...</option>
          </select>
          <button class="scan-button" id="scanButton" type="button" title="Atualizar redes" aria-label="Atualizar redes">
            <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
              <path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2l-41.1 41.1C372.5 55.5 315.8 32 256 32 132.3 32 32 132.3 32 256s100.3 224 224 224c50.4 0 98.5-16.9 137.6-47.5 10.4-8.2 12.3-23.3 4.1-33.7s-23.3-12.3-33.7-4.1C333.3 418.8 295.6 432 256 432 158.8 432 80 353.2 80 256S158.8 80 256 80c47.5 0 92.5 19.2 125.4 52.6L335 179c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8h111.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="field">
        <label for="senha">Senha</label>
        <div class="password-wrap">
          <input id="senha" name="senha" type="password" autocomplete="current-password" placeholder="Informe a senha da rede" value=")rawliteral");
  vHtml += escaparHtml(SenhaSalva);
  vHtml += F("\"");
  vHtml += F(R"rawliteral(>
          <button class="eye-button" id="togglePassword" type="button" aria-label="Exibir senha" title="Exibir senha">
            <svg id="eyeIcon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6-9.8-6-9.8-6Z"></path>
              <circle cx="12" cy="12" r="2.8"></circle>
              <path id="eyeSlash" d="M3 3l18 18" style="display:block"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="field">
        <label for="device_id">ID Dispositivo</label>
        <input id="device_id" name="device_id" type="text" required maxlength="100" autocomplete="off" placeholder="Ex.: botoneira" value=")rawliteral");
  vHtml += escaparHtml(DeviceIdSalvo);
  vHtml += F("\"");
  vHtml += F(R"rawliteral(>
      </div>

      <div class="field">
        <label for="url">URL do POST</label>
        <input id="url" name="url" type="url" inputmode="url" required placeholder="http://localhost:8000/api/v1/events/button-pressed" value=")rawliteral");
  vHtml += escaparHtml(UrlPostSalva);
  vHtml += F("\"");
  vHtml += F(R"rawliteral(>
      </div>

      <button class="primary" type="submit" id="submitButton">SALVAR &amp; CONECTAR</button>
    </form>

    <form method="POST" action="/resetar" id="resetForm">
      <button class="secondary" type="submit" id="resetButton">RESETAR</button>
    </form>
  </main>

  <script>
    const ssidSelect = document.getElementById('ssid');
    const scanButton = document.getElementById('scanButton');
    const passwordInput = document.getElementById('senha');
    const togglePassword = document.getElementById('togglePassword');
    const eyeSlash = document.getElementById('eyeSlash');
    const form = document.getElementById('configForm');
    const submitButton = document.getElementById('submitButton');
    const savedSsid = )rawliteral");
  vHtml += F("\"");
  vHtml += escaparHtml(SsidSalvo);
  vHtml += F("\"");
  vHtml += F(R"rawliteral(;

    function escapeHtml(value) {
      return value.replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[char]);
    }

    async function scanNetworks() {
      scanButton.disabled = true;
      ssidSelect.innerHTML = '<option value="">Vasculhando redes...</option>';

      try {
        const response = await fetch('/redes', { cache: 'no-store' });
        const networks = await response.json();

        if (!Array.isArray(networks) || networks.length === 0) {
          ssidSelect.innerHTML = '<option value="">Nenhuma rede encontrada</option>';
          return;
        }

        ssidSelect.innerHTML = '<option value="">Selecione uma rede</option>';

        networks.forEach(network => {
          const option = document.createElement('option');
          option.value = network.ssid;
          option.textContent = `${network.ssid} (${network.rssi} dBm)${network.secure ? ' \uD83D\uDD12' : ''}`;

          if (network.ssid === savedSsid) {
            option.selected = true;
          }

          ssidSelect.appendChild(option);
        });
      } catch (error) {
        ssidSelect.innerHTML = '<option value="">Falha ao buscar redes</option>';
      } finally {
        scanButton.disabled = false;
      }
    }

    togglePassword.addEventListener('click', () => {
      const show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      eyeSlash.style.display = show ? 'none' : 'block';
      togglePassword.title = show ? 'Ocultar senha' : 'Exibir senha';
      togglePassword.setAttribute('aria-label', togglePassword.title);
    });

    scanButton.addEventListener('click', scanNetworks);

    form.addEventListener('submit', () => {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="loader"></span>&nbsp;&nbsp;CONECTANDO...';
    });

    scanNetworks();
  </script>
)rawliteral");

  vHtml += montarRodapeHtml();
  return vHtml;
}

String montarPaginaResetRealizado()
{
  String vHtml = montarCabecalhoHtml("ARENAX DEVICE");
  vHtml.reserve(7600);

  vHtml += F(R"rawliteral(
  <header class="brand"><img src="/logo.png" alt="ARENAX DEVICE" width="252" height="84"></header>
  <main class="card">
    <div class="status-icon">
      <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
        <path d="M256 48a208 208 0 1 0 208 208A208.24 208.24 0 0 0 256 48zm0 368a160 160 0 1 1 160-160 160.18 160.18 0 0 1-160 160zm92.69-214.07-112 112a24 24 0 0 1-33.94 0l-48-48a24 24 0 0 1 33.94-33.94l31 31 95-95a24 24 0 0 1 33.94 33.94z"/>
      </svg>
    </div>

    <h1 class="status-title">Dados resetados</h1>
    <p class="status-message">As configura&ccedil;&otilde;es foram removidas com sucesso. Em alguns segundos, a tela de configura&ccedil;&atilde;o ser&aacute; exibida novamente.</p>

    <div class="details">
      <span class="loader"></span>&nbsp;&nbsp;Preparando nova configura&ccedil;&atilde;o...
    </div>
  </main>

  <script>
    window.setTimeout(() => {
      window.location.replace('/');
    }, )rawliteral");
  vHtml += String(Configuracao::TEMPO_RETORNO_CONFIGURACAO_MS);
  vHtml += F(R"rawliteral();
  </script>
)rawliteral");

  vHtml += montarRodapeHtml();
  return vHtml;
}

String montarPaginaFeedback(
  const bool pSucesso,
  const String& pTitulo,
  const String& pMensagem,
  const String& pDetalhes
)
{
  String vHtml = montarCabecalhoHtml("ARENAX DEVICE");
  vHtml.reserve(7600);

  vHtml += F("<header class=\"brand\"><img src=\"/logo.png\" alt=\"ARENAX DEVICE\" width=\"252\" height=\"84\"></header><main class=\"card\">");
  vHtml += F("<div class=\"status-icon\">");

  if (pSucesso)
  {
    vHtml += F(R"rawliteral(
      <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
        <path d="M256 48a208 208 0 1 0 208 208A208.24 208.24 0 0 0 256 48zm0 368a160 160 0 1 1 160-160 160.18 160.18 0 0 1-160 160zm92.69-214.07-112 112a24 24 0 0 1-33.94 0l-48-48a24 24 0 0 1 33.94-33.94l31 31 95-95a24 24 0 0 1 33.94 33.94z"/>
      </svg>
    )rawliteral");
  }
  else
  {
    vHtml += F(R"rawliteral(
      <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false">
        <path d="M256 48a208 208 0 1 0 208 208A208.24 208.24 0 0 0 256 48zm0 368a160 160 0 1 1 160-160 160.18 160.18 0 0 1-160 160zm24-88a24 24 0 1 1-24-24 24 24 0 0 1 24 24zm0-72a24 24 0 0 1-48 0V160a24 24 0 0 1 48 0z"/>
      </svg>
    )rawliteral");
  }

  vHtml += F("</div><h1 class=\"status-title\">");
  vHtml += pTitulo;
  vHtml += F("</h1><p class=\"status-message\">");
  vHtml += pMensagem;
  vHtml += F("</p>");

  if (!pDetalhes.isEmpty())
  {
    vHtml += F("<div class=\"details\">");
    vHtml += escaparHtml(pDetalhes);
    vHtml += F("</div>");
  }

  vHtml += F(R"rawliteral(
    <form method="GET" action="/">
      <button class="primary" type="submit">VOLTAR &Agrave; CONFIGURA&Ccedil;&Atilde;O</button>
    </form>
  </main>
)rawliteral");

  vHtml += montarRodapeHtml();
  return vHtml;
}

void enviarPagina(const String& pHtml, const int pCodigoHttp = 200)
{
  Servidor.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  Servidor.sendHeader("Pragma", "no-cache");
  Servidor.send(pCodigoHttp, "text/html; charset=utf-8", pHtml);
}

void definirEstadoLed(const TEstadoLed pEstado)
{
  EstadoLed = pEstado;
  UltimaAlternanciaLedMs = millis();

  if (pEstado == TEstadoLed::Conectado)
  {
    LedAceso = true;
    digitalWrite(Configuracao::PINO_LED, HIGH);
  }
  else
  {
    LedAceso = false;
    digitalWrite(Configuracao::PINO_LED, LOW);
  }
}

void atualizarLed()
{
  if (EstadoLed == TEstadoLed::Conectado)
  {
    if (digitalRead(Configuracao::PINO_LED) != HIGH)
      digitalWrite(Configuracao::PINO_LED, HIGH);

    return;
  }

  const uint32_t vAgora = millis();

  if (vAgora - UltimaAlternanciaLedMs < Configuracao::INTERVALO_LED_AP_MS)
    return;

  UltimaAlternanciaLedMs = vAgora;
  LedAceso = !LedAceso;
  digitalWrite(Configuracao::PINO_LED, LedAceso ? HIGH : LOW);
}

void atualizarEstadoLedPelaConexao()
{
  const TEstadoLed vNovoEstado = WiFi.status() == WL_CONNECTED
    ? TEstadoLed::Conectado
    : TEstadoLed::ModoAccessPoint;

  if (vNovoEstado != EstadoLed)
    definirEstadoLed(vNovoEstado);
}

void carregarConfiguracao()
{
  Preferencias.begin(Configuracao::NAMESPACE_PREFERENCES, true);
  SsidSalvo = Preferencias.getString(Configuracao::CHAVE_SSID, "");
  SenhaSalva = Preferencias.getString(Configuracao::CHAVE_SENHA, "");
  UrlPostSalva = Preferencias.getString(Configuracao::CHAVE_URL, "");
  DeviceIdSalvo = Preferencias.getString(Configuracao::CHAVE_DEVICE_ID, "");
  Preferencias.end();
}

void salvarConfiguracao()
{
  Preferencias.begin(Configuracao::NAMESPACE_PREFERENCES, false);
  Preferencias.putString(Configuracao::CHAVE_SSID, SsidSalvo);
  Preferencias.putString(Configuracao::CHAVE_SENHA, SenhaSalva);
  Preferencias.putString(Configuracao::CHAVE_URL, UrlPostSalva);
  Preferencias.putString(Configuracao::CHAVE_DEVICE_ID, DeviceIdSalvo);
  Preferencias.remove("body");
  Preferencias.end();
}

bool conectarWifi(const String& pSsid, const String& pSenha, String& pDetalhes)
{
  WiFi.disconnect(false, false);
  delay(250);

  Serial.printf("Conectando à rede: %s\n", pSsid.c_str());
  WiFi.begin(pSsid.c_str(), pSenha.c_str());

  const uint32_t vInicio = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - vInicio < Configuracao::TEMPO_CONEXAO_WIFI_MS
  )
  {
    ServidorDns.processNextRequest();
    delay(150);
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    pDetalhes = "Status Wi-Fi: " + String(static_cast<int>(WiFi.status()));
    definirEstadoLed(TEstadoLed::ModoAccessPoint);
    return false;
  }

  pDetalhes = "Rede: " + WiFi.SSID() + " | IP: " + WiFi.localIP().toString();
  Serial.println(pDetalhes);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  definirEstadoLed(TEstadoLed::Conectado);
  return true;
}

void tratarPaginaInicial()
{
  enviarPagina(montarPaginaConfiguracao());
}

void tratarListaRedes()
{
  const int vQuantidade = WiFi.scanNetworks(false, true);
  String vJson = "[";

  for (int vIndice = 0; vIndice < vQuantidade; vIndice++)
  {
    if (vIndice > 0)
      vJson += ',';

    String vSsid = WiFi.SSID(vIndice);
    vSsid.replace("\\", "\\\\");
    vSsid.replace("\"", "\\\"");

    vJson += F("{\"ssid\":\"");
    vJson += vSsid;
    vJson += F("\",\"rssi\":");
    vJson += String(WiFi.RSSI(vIndice));
    vJson += F(",\"secure\":");
    vJson += WiFi.encryptionType(vIndice) == WIFI_AUTH_OPEN ? F("false") : F("true");
    vJson += '}';
  }

  vJson += ']';
  WiFi.scanDelete();

  Servidor.sendHeader("Cache-Control", "no-store");
  Servidor.send(200, "application/json; charset=utf-8", vJson);
}

void tratarSalvar()
{
  if (
    !Servidor.hasArg("ssid") ||
    !Servidor.hasArg("url") ||
    !Servidor.hasArg("device_id")
  )
  {
    enviarPagina(
      montarPaginaFeedback(
        false,
        "Dados incompletos",
        "Preencha a rede, o ID Dispositivo e a URL do POST.",
        ""
      ),
      400
    );
    return;
  }

  const String vSsid = Servidor.arg("ssid");
  const String vSenha = Servidor.arg("senha");
  const String vUrl = Servidor.arg("url");
  String vDeviceId = Servidor.arg("device_id");
  vDeviceId.trim();

  if (vSsid.isEmpty() || vUrl.isEmpty() || vDeviceId.isEmpty())
  {
    enviarPagina(
      montarPaginaFeedback(false, "Dados inv&aacute;lidos", "Existem campos obrigat&oacute;rios vazios.", ""),
      400
    );
    return;
  }

  String vDetalhes;
  const bool vConectado = conectarWifi(vSsid, vSenha, vDetalhes);

  if (vConectado)
  {
    SsidSalvo = vSsid;
    SenhaSalva = vSenha;
    UrlPostSalva = vUrl;
    DeviceIdSalvo = vDeviceId;
    salvarConfiguracao();

    enviarPagina(
      montarPaginaFeedback(
        true,
        "Conex&atilde;o realizada",
        "A configura&ccedil;&atilde;o foi salva. O dispositivo est&aacute; pronto para enviar o POST quando o bot&atilde;o for pressionado.",
        vDetalhes
      )
    );
  }
  else
  {
    enviarPagina(
      montarPaginaFeedback(
        false,
        "N&atilde;o foi poss&iacute;vel conectar",
        "Confira a senha, a intensidade do sinal e se a rede opera em 2,4 GHz.",
        vDetalhes
      ),
      503
    );
  }
}

void limparConfiguracao()
{
  Preferencias.begin(Configuracao::NAMESPACE_PREFERENCES, false);
  Preferencias.clear();
  Preferencias.end();

  SsidSalvo = "";
  SenhaSalva = "";
  UrlPostSalva = "";
  DeviceIdSalvo = "";

  WiFi.disconnect(false, false);
  delay(150);
  WiFi.mode(WIFI_AP_STA);
  definirEstadoLed(TEstadoLed::ModoAccessPoint);
}

void tratarResetar()
{
  limparConfiguracao();
  Serial.println("Configurações resetadas com sucesso.");
  enviarPagina(montarPaginaResetRealizado());
}

void redirecionarParaPortal()
{
  Servidor.sendHeader("Location", String("http://") + WiFi.softAPIP().toString(), true);
  Servidor.sendHeader("Cache-Control", "no-store");
  Servidor.send(302, "text/plain", "");
}

void servirDeteccaoPortal()
{
  enviarPagina(montarPaginaConfiguracao());
}

void servirLogo()
{
  Servidor.sendHeader("Cache-Control", "public, max-age=86400");
  Servidor.send_P(
    200,
    PSTR("image/png"),
    reinterpret_cast<PGM_P>(LOGO_BRANCO_PNG),
    LOGO_BRANCO_PNG_SIZE
  );
}

void configurarRotas()
{
  Servidor.on("/", HTTP_GET, tratarPaginaInicial);
  Servidor.on("/logo.png", HTTP_GET, servirLogo);
  Servidor.on("/redes", HTTP_GET, tratarListaRedes);
  Servidor.on("/salvar", HTTP_POST, tratarSalvar);
  Servidor.on("/resetar", HTTP_POST, tratarResetar);

  // Android, Chrome e ChromeOS esperam 204 quando existe acesso à internet.
  Servidor.on("/generate_204", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/gen_204", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/canonical.html", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/mobile/status.php", HTTP_ANY, redirecionarParaPortal);

  // Apple e Firefox abrem melhor o assistente quando recebem o portal diretamente.
  Servidor.on("/hotspot-detect.html", HTTP_ANY, servirDeteccaoPortal);
  Servidor.on("/library/test/success.html", HTTP_ANY, servirDeteccaoPortal);
  Servidor.on("/success.html", HTTP_ANY, servirDeteccaoPortal);
  Servidor.on("/success.txt", HTTP_ANY, servirDeteccaoPortal);

  // Windows identifica o portal ao não receber os conteúdos de teste esperados.
  Servidor.on("/ncsi.txt", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/connecttest.txt", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/redirect", HTTP_ANY, redirecionarParaPortal);
  Servidor.on("/fwlink", HTTP_ANY, redirecionarParaPortal);
  Servidor.onNotFound(redirecionarParaPortal);
}

void iniciarAccessPoint()
{
  WiFi.mode(WIFI_AP_STA);
  definirEstadoLed(TEstadoLed::ModoAccessPoint);

  const String vNomeAp = obterNomeAccessPoint();
  const bool vIniciado = WiFi.softAP(
    vNomeAp.c_str(),
    Configuracao::SENHA_ACCESS_POINT
  );

  Serial.printf("Access Point: %s\n", vNomeAp.c_str());
  Serial.println("Segurança do Access Point: WPA2-PSK");
  Serial.printf("Status AP: %s\n", vIniciado ? "OK" : "FALHA");
  Serial.printf("IP do portal: %s\n", WiFi.softAPIP().toString().c_str());

  ServidorDns.start(
    Configuracao::PORTA_DNS,
    "*",
    WiFi.softAPIP()
  );
}

bool obterDadosTemporais(String& pChaveIdempotencia, String& pTimestamp)
{
  struct tm vDataHora;

  if (!getLocalTime(&vDataHora, Configuracao::TEMPO_SINCRONIZACAO_RELOGIO_MS))
  {
    Serial.println("Relógio não sincronizado. POST não enviado.");
    return false;
  }

  char vDataHoraFormatada[15];
  strftime(vDataHoraFormatada, sizeof(vDataHoraFormatada), "%d%m%Y%H%M%S", &vDataHora);

  char vTimestampFormatado[21];
  strftime(vTimestampFormatado, sizeof(vTimestampFormatado), "%Y-%m-%dT%H:%M:%SZ", &vDataHora);

  pChaveIdempotencia = DeviceIdSalvo + "_" + vDataHoraFormatada;
  pTimestamp = vTimestampFormatado;
  return true;
}

bool enviarPost()
{
  if (UrlPostSalva.isEmpty() || DeviceIdSalvo.isEmpty())
  {
    Serial.println("POST não configurado.");
    return false;
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    String vDetalhes;

    if (!conectarWifi(SsidSalvo, SenhaSalva, vDetalhes))
    {
      Serial.println("Sem conexão Wi-Fi para enviar o POST.");
      return false;
    }
  }

  HTTPClient vHttp;
  int vCodigoHttp = -1;
  String vChaveIdempotencia;
  String vTimestamp;

  if (!obterDadosTemporais(vChaveIdempotencia, vTimestamp))
    return false;

  const String vBody = F("{\"device_id\":\"");
  String vBodyPost = vBody + escaparJson(DeviceIdSalvo) +
    F("\",\"timestamp\":\"") + vTimestamp + F("\"}");

  if (UrlPostSalva.startsWith("https://"))
  {
    WiFiClientSecure vClienteSeguro;

    // Para produção, substitua setInsecure() pela validação do certificado raiz.
    vClienteSeguro.setInsecure();

    if (!vHttp.begin(vClienteSeguro, UrlPostSalva))
    {
      Serial.println("Falha ao iniciar conexão HTTPS.");
      return false;
    }

    vHttp.addHeader("Content-Type", "application/json");
    vHttp.addHeader("Idempotency-Key", vChaveIdempotencia);
    vHttp.setTimeout(10000);
    vCodigoHttp = vHttp.POST(vBodyPost);
  }
  else
  {
    WiFiClient vCliente;

    if (!vHttp.begin(vCliente, UrlPostSalva))
    {
      Serial.println("Falha ao iniciar conexão HTTP.");
      return false;
    }

    vHttp.addHeader("Content-Type", "application/json");
    vHttp.addHeader("Idempotency-Key", vChaveIdempotencia);
    vHttp.setTimeout(10000);
    vCodigoHttp = vHttp.POST(vBodyPost);
  }

  Serial.printf("Código HTTP: %d\n", vCodigoHttp);

  if (vCodigoHttp > 0)
  {
    const String vResposta = vHttp.getString();
    Serial.printf("Resposta: %s\n", vResposta.c_str());
  }
  else
  {
    Serial.printf("Erro HTTP: %s\n", vHttp.errorToString(vCodigoHttp).c_str());
  }

  vHttp.end();
  return vCodigoHttp >= 200 && vCodigoHttp < 300;
}

void processarBotao()
{
  const bool vEstadoAtual = digitalRead(Configuracao::PINO_BOTAO);
  const uint32_t vAgora = millis();

  if (
    UltimoEstadoBotao == HIGH &&
    vEstadoAtual == LOW &&
    vAgora - UltimoCliqueMs >= Configuracao::DEBOUNCE_BOTAO_MS
  )
  {
    UltimoCliqueMs = vAgora;
    Serial.println("Botão pressionado. Enviando POST...");
    enviarPost();
  }

  UltimoEstadoBotao = vEstadoAtual;
}

void tentarReconectarAutomaticamente()
{
  if (
    WiFi.status() == WL_CONNECTED ||
    SsidSalvo.isEmpty() ||
    millis() - UltimaTentativaReconexaoMs < Configuracao::INTERVALO_RECONEXAO_MS
  )
    return;

  UltimaTentativaReconexaoMs = millis();
  Serial.println("Tentando reconectar ao Wi-Fi salvo...");
  definirEstadoLed(TEstadoLed::ModoAccessPoint);
  WiFi.begin(SsidSalvo.c_str(), SenhaSalva.c_str());
}

void setup()
{
  Serial.begin(115200);
  delay(300);

  pinMode(Configuracao::PINO_BOTAO, INPUT_PULLUP);
  pinMode(Configuracao::PINO_LED, OUTPUT);
  definirEstadoLed(TEstadoLed::ModoAccessPoint);

  NumeroSerie = obterNumeroSerie();
  carregarConfiguracao();
  iniciarAccessPoint();
  configurarRotas();
  Servidor.begin();

  Serial.printf("Número de série: %s\n", NumeroSerie.c_str());
  Serial.println("Servidor HTTP iniciado.");

  if (!SsidSalvo.isEmpty())
  {
    String vDetalhes;
    conectarWifi(SsidSalvo, SenhaSalva, vDetalhes);
  }
}

void loop()
{
  ServidorDns.processNextRequest();
  Servidor.handleClient();
  processarBotao();
  tentarReconectarAutomaticamente();
  atualizarEstadoLedPelaConexao();
  atualizarLed();
  delay(2);
}
