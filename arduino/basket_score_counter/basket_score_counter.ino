#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include "secrets.h"

using namespace websockets;

unsigned long reconnectDelay = 1000;
unsigned long lastReconnectTime = 0;

const int sensorPin = 23;
int sensorState = LOW;
int lastSensorState = LOW;

unsigned long lastDebounceTime = 0;  // the last time the output pin was toggled
unsigned long debounceDelay = 5;

const int blueLedPin = 25;
const int orangeLedPin = 26;
const int greenLedPin = 27;
const int basketSelectionPin = 32;

WebsocketsClient client;

hw_timer_t * timer = NULL;

void onTimer(){
  digitalWrite(blueLedPin, !digitalRead(blueLedPin));
}

void startTimer() {
  timer = timerBegin(0, 80, true); // timer_id = 0; divider=80; countUp = true;
  timerAttachInterrupt(timer, &onTimer, true); // edge = true
  timerAlarmWrite(timer, 1000000, true);  //1000 ms
  timerAlarmEnable(timer);
}

void endTimer() {
  timerEnd(timer);
  timer = NULL; 
}

void onMessageCallback(WebsocketsMessage message) {
    Serial.print("Got Message: ");
    Serial.println(message.data());
}

void onEventsCallback(WebsocketsEvent event, String data) {
    if(event == WebsocketsEvent::ConnectionOpened) {
        digitalWrite(orangeLedPin, LOW);
        Serial.println("Connnection Opened");
    } else if(event == WebsocketsEvent::ConnectionClosed) {
        digitalWrite(orangeLedPin, HIGH);
        Serial.println("Connnection Closed");
    } else if(event == WebsocketsEvent::GotPing) {
        Serial.println("Got a Ping!");
    } else if(event == WebsocketsEvent::GotPong) {
        Serial.println("Got a Pong!");
    }
}

void setup() {
    Serial.begin(115200);

    pinMode(sensorPin, INPUT);
    pinMode(blueLedPin, OUTPUT);
    pinMode(orangeLedPin, OUTPUT);
    pinMode(greenLedPin, OUTPUT);
    pinMode(basketSelectionPin, INPUT);

    digitalWrite(blueLedPin, HIGH);
    digitalWrite(orangeLedPin, HIGH);
    
    // Connect to wifi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Wait some time to connect to wifi
    for(int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++) {
        Serial.print(".");
        delay(1000);
    }

    digitalWrite(blueLedPin, LOW);

    startTimer();

    Serial.println("\nConnected to WiFi");

    // Setup Callbacks
    client.onMessage(onMessageCallback);
    client.onEvent(onEventsCallback);
    
    // Connect to server
    client.connect(WEBSOCKETS_SERVER);

    // Send a ping
    client.ping();
}

void loop() {
    int currentSensorState = digitalRead(sensorPin);

    if (sensorState == HIGH) {
      // turn LED on:
      digitalWrite(greenLedPin, HIGH);
    } else {
      // turn LED off:
      digitalWrite(greenLedPin, LOW);
    }

    unsigned long time_ms = millis();

    if (currentSensorState != lastSensorState) {
        lastDebounceTime = time_ms;
    }

    if ((time_ms - lastDebounceTime) > debounceDelay) {
      if (currentSensorState != sensorState) {
        sensorState = currentSensorState;

        int currentBasketSelection = digitalRead(basketSelectionPin);

        if (sensorState == HIGH) {
          if (currentBasketSelection == HIGH) {
            client.send("magenta");
          } else {
            client.send("blue");
          }
        }
       }
    }

    lastSensorState = currentSensorState;

    if (!client.available() && (time_ms - lastReconnectTime) > reconnectDelay) {
      lastReconnectTime = time_ms;
      Serial.println("Reconnecting websocket");
      client.connect(WEBSOCKETS_SERVER);
    }
  
    client.poll();
}
