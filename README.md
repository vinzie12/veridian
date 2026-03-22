# Veridian

**Emergency Response Platform** — Connect citizens with emergency services through real-time reporting and communication.

---

## What is Veridian?

Veridian is an emergency response system that helps citizens report incidents and connect with responders quickly. The platform consists of:

- **Mobile App** — For citizens to report emergencies and receive help
- **Web Dashboard** — For agency administrators (coming soon)
- **API Server** — Backend services powering the platform

---

## User Flow

### Citizen (Mobile App)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │ ──► │  Dashboard  │ ──► │ Quick Report│ ──► │   Track     │
│  / Signup   │     │             │     │  Emergency  │     │   Status    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  Receive    │
                                                            │  Call from  │
                                                            │  Responder  │
                                                            └─────────────┘
```

1. **Sign Up / Login** — Create account or sign in
2. **Dashboard** — View active incidents and quick actions
3. **Report Emergency** — One-tap reporting with location
4. **Track Status** — Real-time updates on your report
5. **Receive Call** — Answer calls from responders for more info

### Responder (Mobile App)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │ ──► │  Incident   │ ──► │   View      │ ──► │  Initiate   │
│             │     │    List     │     │  Details    │     │    Call     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  In-App     │
                                                            │ Audio Call  │
                                                            └─────────────┘
```

1. **Login** — Sign in with responder credentials
2. **Incident List** — View active emergencies in your area
3. **View Details** — See incident location, description, photos
4. **Call Citizen** — Initiate in-app audio call for verification
5. **Update Status** — Mark incidents as resolved, in-progress, etc.

---

## Features

### For Citizens
- 📍 **Location-Based Reporting** — GPS automatically included
- 🔔 **Real-Time Notifications** — Get updates on your report
- 📞 **In-App Calls** — Talk directly with responders
- 📊 **Status Tracking** — Monitor progress from submission to resolution

### For Responders
- 🗺️ **Incident Map** — See all active emergencies
- 📞 **One-Tap Calling** — Contact citizens instantly
- ✅ **Status Updates** — Update incident status in real-time
- 👥 **Multi-Agency Support** — Coordinate across departments

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile | React Native (Expo) |
| API | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Real-time | WebSocket + Supabase Realtime |
| Auth | Supabase Auth (JWT) |

---

## Getting Started

### Mobile App

```bash
cd mobile
npm install
npx expo start
```

### API Server

```bash
cd api
npm install
npm start
```

---

## Project Structure

```
veridian/
├── mobile/           # React Native mobile app
│   ├── screens/      # App screens
│   ├── src/          # Services, navigation, context
│   └── lib/          # Call providers, Supabase client
│
├── api/              # Express.js API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── middleware/ # Auth, validation
│   └── index.js      # Entry point
│
└── web/              # React web dashboard (coming soon)
```

---

## License

ISC

---

## Author

**vinzie12**

[github.com/vinzie12/veridian](https://github.com/vinzie12/veridian)
