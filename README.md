Gemini Live Voice Client
A modern, low-latency web interface for real-time, two-way voice conversations with Google's Gemini Multimodal Live API.

![alt text](https://img.shields.io/badge/license-MIT-blue.svg)

![alt text](https://img.shields.io/badge/React-19-blue)

![alt text](https://img.shields.io/badge/TypeScript-5-blue)

![alt text](https://img.shields.io/badge/Gemini-Live%20API-8E75B2)

📖 About
This application demonstrates how to implement a full-duplex voice interface using the Gemini Multimodal Live API. Unlike standard text-based LLM interactions, this app streams raw audio to and from the model via WebSockets, allowing for natural interruption, emotional intonation, and sub-second latency.

It features a clean, dark-themed UI with a real-time audio visualizer and chat history bubbles.

✨ Features
Real-time Voice Conversation: Full-duplex audio streaming using the gemini-2.5-flash-native-audio-preview model.

Audio Visualization: Smooth, real-time waveform visualization using the HTML5 Canvas API.

Transcription History: Displays a scrollable chat log of user input and AI responses for accessibility and reference.

Raw PCM Audio Handling: Custom implementation for encoding/decoding raw PCM 16-bit audio chunks for browser compatibility.

Modern UI: Built with Tailwind CSS, featuring glassmorphism effects, dark mode, and responsive design.

🛠️ Tech Stack
Frontend Framework: React 19

Language: TypeScript

Styling: Tailwind CSS

AI SDK: @google/genai (Google GenAI SDK)

Audio: Web Audio API (AudioContext, ScriptProcessor, AnalyserNode)

🚀 Getting Started
Prerequisites
Node.js (v18+)

A Google Cloud Project with the Gemini API enabled

An API Key from Google AI Studio

Installation
Clone the repository

code
Bash
git clone https://github.com/yourusername/gemini-live-voice-client.git
cd gemini-live-voice-client
Install dependencies

code
Bash
npm install
Configure Environment
Create a .env file in the root directory and add your API key:

code
Env
REACT_APP_API_KEY=your_actual_api_key_here
# OR if using Vite
VITE_API_KEY=your_actual_api_key_here
Note: You may need to adjust App.tsx to read the specific environment variable format depending on your bundler (Vite, Parcel, CRA).

Run the application

code
Bash
npm start
# or
npm run dev
🧩 Key Implementation Details
Audio Streaming
The app uses AudioContext and ScriptProcessorNode to capture microphone input, downsamples it to 16kHz PCM, and streams it to Gemini. Conversely, it receives 24kHz PCM audio chunks from Gemini, decodes them, and queues them for playback to ensure gapless audio.

The "Live" Connection
The connection is handled via ai.live.connect, utilizing WebSockets to maintain a persistent session. This allows the model to "listen" while "speaking," enabling users to interrupt the model naturally.

🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

📄 License
This project is open source and available under the MIT License.
