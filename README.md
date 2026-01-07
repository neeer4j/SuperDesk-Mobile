<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,kotlin,nodejs,express,supabase,azure,vscode,github" alt="Tech stack" />
</p>

# SuperDesk Android

A powerful React Native mobile client for [SuperDesk](https://github.com/neeer4j/SuperDesk) - the remote desktop access software.

## 📱 Features

- **📱 Remote Desktop Control**
  - View high-quality PC screen streams with WebRTC
  - Control mouse (touch-to-click, drag-to-move, scroll)
  - Native keyboard injection for typing on remote PC
  - **Dynamic Toolbar** for quick actions

- **📡 Host Mode (Screen Sharing)**
  - Share your Android screen to a PC viewer
  - Generate temporary 8-digit session codes for secure sharing

- **📂 File Transfer**
  - **P2P File Sharing**: Send photos and documents directly to connected PC
  - **Receive Files**: Accept incoming files from PC seamlessly
  - **Transfer History**: Track recent sent and received files

- **💬 Real-Time Communication**
  - **In-Session Chat**: Text chat with the connected peer
  - **Live Notifications**: Get alerts for connection status and transfers

- **🎨 Modern UI/UX**
  - **Dynamic Theming**: Full Light/Dark mode support (syncs with system or manual toggle)
  - **Fluid Animations**: Smooth transitions and component animations
  - **Custom Design System**: Consistent typography, colors, and components

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- Android Studio (for Android development)
- JDK 17
- An Android device or emulator with Developer Options enabled

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
# Copy the example file and add your credentials
cp .env.example .env
# Then edit .env with your Supabase credentials

# 3. Start Metro bundler
npm start

# 4. Run on Android (in a separate terminal)
npm run android
```

> **Important**: Make sure to configure your `.env` file with valid Supabase credentials before running the app. See [SECURITY.md](./SECURITY.md) for details.

## 📁 Project Structure

```
SuperDesk-Android/
├── src/
│   ├── components/     # Reusable UI components (Card, Button, Input, etc.)
│   ├── context/        # React Context (Auth, Theme)
│   ├── navigation/     # Stack and Tab navigation setup
│   ├── screens/
│   │   ├── LandingScreen.tsx   # Welcome & Auth Check
│   │   ├── LoginScreen.tsx     # Email/OTP Authentication
│   │   ├── HostSession.tsx     # Host mode (Share Screen)
│   │   ├── JoinSession.tsx     # Join mode (Control PC)
│   │   ├── SessionScreen.tsx   # Active session view
│   │   ├── RemoteScreen.tsx    # Remote control interface
│   │   ├── FileTransfer.tsx    # File manager
│   │   └── ChatScreen.tsx      # In-session messaging
│   ├── services/
│   │   ├── SocketService.ts    # Signaling server (WebSocket)
│   │   ├── WebRTCService.ts    # P2P video/data channels
│   │   └── RemoteControl.ts    # Input injection service
│   └── theme/
│       └── designSystem.ts     # Theme tokens (colors, typography)
└── android/                    # Native Android code
```

## 🎮 How to Use

### 1. Control PC from Phone
1. Start **SuperDesk Agent** on your Windows PC.
2. Note the **8-digit session code** from the PC.
3. Open **SuperDesk Android** on your phone.
4. Go to the **Join** tab, enter the code, and tap **Connect**.
5. Use touch gestures to control the mouse!

### 2. Share Files
1. During an active session, navigate to the **File Transfer** tab.
2. Tap **Send File** to pick a document or image.
3. The file is sent instantly via P2P data channel.

### 3. Change Theme
1. Go to **Settings** (gear icon in header).
2. Tap **Light** or **Dark** to switch styles instantly.

## 🔧 Configuration

The app connects to the SuperDesk signaling server on Azure. To change the endpoint, modify `src/services/SocketService.ts`:

```typescript
const SOCKET_URL = 'https://supderdesk-fgasbfdze6bwbbav.centralindia-01.azurewebsites.net';
```


## 📄 License

GPL-3.0 - See [LICENSE](LICENSE)

---

Built with ❤️ using **React Native**, **WebRTC**, & **Supabase**
