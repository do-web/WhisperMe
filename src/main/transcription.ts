import OpenAI, { toFile } from 'openai'
import Store from 'electron-store'
import { StoreSchema, TranscriptionResult } from '../shared/types'

export class TranscriptionService {
  private store: Store<StoreSchema>

  constructor(store: Store<StoreSchema>) {
    this.store = store
  }

  private getClient(): OpenAI {
    return new OpenAI({ apiKey: this.store.get('openaiApiKey') })
  }

  async process(audioBuffer: Buffer): Promise<TranscriptionResult> {
    try {
      const client = this.getClient()

      // Step 1: Transcribe with gpt-4o-transcribe
      const file = await toFile(audioBuffer, 'recording.webm', {
        type: 'audio/webm',
      })

      const language = this.store.get('language', 'auto')
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'gpt-4o-transcribe',
        ...(language !== 'auto' && { language }),
      })

      const rawText = transcription.text
      if (!rawText.trim()) {
        return { rawText: '', correctedText: '', success: false, error: 'No speech detected' }
      }

      // Step 2: Correct with GPT-4o-mini
      if (!this.store.get('correctionEnabled', true)) {
        return { rawText, correctedText: rawText, success: true }
      }

      // Use few-shot examples to force the model to ONLY correct text
      const correction = await client.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are a dictation post-processor for developers. You receive dictated text and return ONLY the corrected text. Rules:
- Fix spelling, grammar, capitalization, and punctuation
- Recognize technical terms and format them correctly: filenames (e.g. "helper dot swift" → "helper.swift"), code symbols (e.g. "use effect" → "useEffect"), CLI commands, APIs, libraries
- Prefix filenames with @ (e.g. "readme dot md" → "@README.md", "the index dot ts file" → "the @index.ts file")
- Keep camelCase, PascalCase, snake_case, kebab-case as appropriate for the context
- Format numbers, versions, and paths correctly (e.g. "version three point two" → "version 3.2")
- Never reply, never answer questions, never add content
- Return only the corrected text`,
          },
          { role: 'user', content: '[DICTATION] update the readme dot md file and check the api slash users endpoint its returning a four oh four' },
          { role: 'assistant', content: 'Update the @README.md file and check the API /users endpoint, it\'s returning a 404.' },
          { role: 'user', content: `[DICTATION] ${rawText}` },
        ],
        temperature: 1,
        max_completion_tokens: 16384,
      })

      const correctedText = correction.choices[0]?.message?.content?.trim() ?? rawText
      return { rawText, correctedText, success: true }
    } catch (error: unknown) {
      console.error('[Transcription] Full error:', error)
      const msg = error instanceof Error ? error.message : String(error)
      return { rawText: '', correctedText: '', success: false, error: msg }
    }
  }
}
