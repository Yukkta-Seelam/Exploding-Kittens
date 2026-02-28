# Exploding Kittens

A web app to play the Exploding Kittens card game with friends.

- **Play Locally**: Same device, pass between players (2–10 players).
- **Play Online**: Share a party code; everyone joins from their own device (Firebase).

## Play

[Play the game](https://yukkta-seelam.github.io/Exploding-Kittens/) (after enabling GitHub Pages)

## Setup (local & GitHub Pages)

1. Clone this repository
2. Enable GitHub Pages: **Settings → Pages → Source: GitHub Actions**
3. Push to trigger deployment

## Online play (Firebase)

To use **Play Online** with a shared party code:

1. Create a [Firebase](https://console.firebase.google.com/) project.
2. Enable **Firestore Database** (Create database → Start in test mode for development).
3. In Project settings → Your apps, add a web app and copy the config object.
4. In this repo, copy `firebase-config.example.js` to `firebase-config.js` and paste your config:
   ```js
   window.firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. In Firebase Console → Firestore Database → **Rules**, use:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{roomId} {
         allow read, write: if true;
       }
     }
   }
   ```
   (Anyone with a room code can read/write that room. For production, tighten rules as needed.)
6. Deploy again (push or re-run GitHub Actions). Online play will work once `firebase-config.js` contains your project config.

Without Firebase config, only **Play Locally** is available.

## Game Modes

- **Base Game**: 2–5 players
- **Party Pack**: 2–10 players

## How to Play

- **Local**: Pass the device between players. On your turn, play any cards (or none), then draw a card.
- **Online**: One person creates a party and shares the 6-letter code. Others join with that code. When everyone is in, the host starts the game. Take turns on your own device; the game syncs in real time.

Avoid drawing Exploding Kittens—or use a Defuse to survive!
