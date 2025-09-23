import { NextResponse } from 'next/server';
import { parseToLines } from '@/lib/parsers';

export const runtime = 'nodejs';

/**
 * Route handler that accepts a file (PDF/XLSX/CSV/TXT) or raw text and returns parsed lines.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const fileEntry = formData.get('file');
      const textEntry = formData.get('text');

      const file = fileEntry instanceof File ? fileEntry : undefined;
      const text = typeof textEntry === 'string' ? textEntry : undefined;

      if (!file && !text) {
        return NextResponse.json(
          { error: 'Nessun file o testo fornito per il parsing' },
          { status: 400 },
        );
      }

      const lines = await parseToLines({ file, text });
      return NextResponse.json({ lines });
    }

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      const text = typeof body?.text === 'string' ? body.text : undefined;
      if (!text) {
        return NextResponse.json(
          { error: 'Richiesta JSON non valida: manca il campo "text"' },
          { status: 400 },
        );
      }

      const lines = await parseToLines({ text });
      return NextResponse.json({ lines });
    }

    return NextResponse.json(
      { error: 'Content-Type non supportato. Usa multipart/form-data o JSON.' },
      { status: 415 },
    );
  } catch (error) {
    console.error('Errore nel parsing del file', error);
    const message = error instanceof Error ? error.message : 'Errore imprevisto durante il parsing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
