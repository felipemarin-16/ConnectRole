# RoleReady — AI Mock Interview Coach

RoleReady is a premium, high-fidelity mock interview platform designed to help candidates practice for specific roles using their own background and target job descriptions. Built with **Next.js**, **Tailwind CSS**, and **TypeScript**, it leverages advanced LLMs to provide a realistic, adaptive, and supportive interview experience.

![RoleReady Screenshot](https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=2000&ixlib=rb-4.0.3)

## ✨ Key Features

- **Personalized Setup**: Upload your PDF resume and paste a job posting to generate an interview tailored specifically to you.
- **Adaptive AI Interviewer**: The coach analyzes your answers in real-time, asking relevant follow-up questions and probing deeper into your skills.
- **Voice Selection**: Choose between professional male (Mark) and female (Rachel) voices for your interviewer.
- **Live Feedback & Coaching**: Get instant "Coach Tips" during the interview to help you structure your answers more effectively.
- **Comprehensive Results**: Receive a detailed performance report after each session, including:
  - **Strengths**: What you did well.
  - **Areas for Improvement**: Specific, actionable advice.
  - **Sample Answers**: High-quality examples of how to improve your specific responses.
  - **Skill Scoring**: Metrics on relevance, specificity, confidence, and role alignment.
- **Premium Design**: A smooth, modern UI with glassmorphism, fluid animations, and a focus on clarity.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- An API Key for one of the supported LLM providers (OpenAI or Groq)
- A Google Cloud TTS API Key (optional, for high-quality voice)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/felipemarin-16/RoleReady.git
   cd RoleReady
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your API keys (e.g., `OPENAI_API_KEY` or `GROQ_API_KEY`).

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠 Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Voice**: [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech) & Browser Web Speech API
- **AI/LLM**: [OpenAI](https://openai.com/) / [Groq](https://groq.com/)
- **PDF Parsing**: Client-side text extraction

## 📝 License

Built with ❤️ by [Felipe Marin](https://github.com/felipemarin-16).
