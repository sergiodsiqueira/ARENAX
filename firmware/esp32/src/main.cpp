#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <time.h>

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

constexpr uint8_t BUTTON_PIN = 4;
constexpr unsigned long DEBOUNCE_MS = 250;
unsigned long lastPress = 0;

void connectNetwork() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void publishButtonPressed() {
  if (WiFi.status() != WL_CONNECTED) connectNetwork();
  const unsigned long now = millis();
  struct tm utc;
  if (!getLocalTime(&utc, 5000)) {
    Serial.println("NTP time unavailable; physical event not sent");
    return;
  }
  char timestampBuffer[25];
  strftime(timestampBuffer, sizeof(timestampBuffer), "%Y-%m-%dT%H:%M:%SZ", &utc);
  const String timestamp(timestampBuffer);
  const String idempotencyKey = String(AX_DEVICE_ID) + "-" + String(time(nullptr)) + "-" + String(now);
  const String body = "{\"device_id\":\"" + String(AX_DEVICE_ID) +
                      "\",\"timestamp\":\"" + timestamp + "\"}";
  HTTPClient http;
  http.begin(AX_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Idempotency-Key", idempotencyKey);
  const int status = http.POST(body);
  Serial.printf("Physical event acknowledgement: %d\n", status);
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  connectNetwork();
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW && millis() - lastPress > DEBOUNCE_MS) {
    lastPress = millis();
    publishButtonPressed();
  }
  delay(10);
}
