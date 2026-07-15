import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import { LLMProvider, LLMResponse, LLMStreamChunk, PromptContext } from './LLMProvider';
import { AppError } from '../../middleware/errorHandler';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';

  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateSummary(transcript: string): Promise<LLMResponse> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings: SAFETY_SETTINGS,
    });

    const prompt = `You are an expert video analyst. Given the following YouTube video transcript, produce a detailed, well-structured summary. Include:
- A 2-3 sentence overview
- The main topics covered (as bullet points)
- Key takeaways or conclusions

Transcript:
${transcript.slice(0, 30_000)}`;

    try {
      const result = await model.generateContent(prompt);
      return { text: result.response.text() };
    } catch (err) {
      throw new AppError('LLM_ERROR', `Gemini summary generation failed: ${String(err)}`, 502);
    }
  }

  async *generateResponse(
    question: string,
    context: PromptContext,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings: SAFETY_SETTINGS,
    });

    const chunksSection = context.chunks
      ?.map((c) => `[${formatTime(c.startSeconds)}] ${c.text}`)
      .join('\n\n') ?? '';

    const historySection = context.history
      ?.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n') ?? '';

    const prompt = `You are a helpful assistant that answers questions about a YouTube video.
Answer ONLY using the transcript excerpts provided below. If the answer isn't in the excerpts, say so clearly.
Always cite the timestamp(s) that support your answer in the format [MM:SS].

${chunksSection ? `Transcript excerpts:\n${chunksSection}` : ''}

${historySection ? `Conversation history:\n${historySection}` : ''}

User question: ${question}

Answer:`;

    try {
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const delta = chunk.text();
        if (delta) {
          yield { delta, done: false };
        }
      }
      yield { delta: '', done: true };
    } catch (err) {
      throw new AppError('LLM_ERROR', `Gemini chat generation failed: ${String(err)}`, 502);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      throw new AppError('LLM_ERROR', `Gemini embedding failed: ${String(err)}`, 502);
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
