import { NextResponse } from "next/server";

type TtsRequest = {
  text?: string;
  coachVoice?: "female" | "male";
};

const DEFAULT_VOICE_NAMES = {
  female: "en-US-Wavenet-F",
  male: "en-US-Wavenet-D",
} as const;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Cloud TTS is not configured." },
      { status: 503 },
    );
  }

  let body: TtsRequest;

  try {
    body = (await request.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = body.text?.trim();
  const coachVoice = body.coachVoice === "male" ? "male" : "female";

  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  const voiceName =
    coachVoice === "male"
      ? process.env.GOOGLE_TTS_VOICE_MALE || DEFAULT_VOICE_NAMES.male
      : process.env.GOOGLE_TTS_VOICE_FEMALE || DEFAULT_VOICE_NAMES.female;

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "en-US",
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      {
        error: "Google Cloud TTS request failed.",
        details: message,
      },
      { status: response.status },
    );
  }

  const data = await response.json() as { audioContent?: string };

  if (!data.audioContent) {
    return NextResponse.json(
      { error: "Google Cloud TTS response did not contain audioContent." },
      { status: 500 },
    );
  }

  // Convert base64 to binary buffer
  const audioBuffer = Buffer.from(data.audioContent, "base64");

  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "x-connectrole-tts-provider": "google-cloud",
      "x-connectrole-voice-name": voiceName,
    },
  });
}
