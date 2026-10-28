import type { APIRoute } from "astro";

export const prerender = false;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OCR_MODEL = "google/gemini-3.7-flash";
const EXTRACT_MODEL = "scaledown/extract";
const FIELD_NAMES = [
  "name_bengali",
  "name_english",
  "father_name",
  "mother_name",
  "address",
  "date_of_birth",
  "nid_number",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];
type NidFields = Record<FieldName, string>;

type ExtractedEntity = {
  text?: unknown;
  type?: unknown;
};

const FIELD_DESCRIPTIONS: Record<FieldName, string> = {
  name_bengali: "The cardholder's full name in Bengali, exactly as given in the name_bengali line.",
  name_english: "The cardholder's full name in English, exactly as given in the name_english line.",
  father_name: "The father's name in Bengali, exactly as given in the father_name line.",
  mother_name: "The mother's name in Bengali, exactly as given in the mother_name line.",
  address: "The complete Bengali address, exactly as given in the address line.",
  date_of_birth: "The date of birth exactly as given in the date_of_birth line.",
  nid_number: "The NID number exactly as given in the nid_number line.",
};

const TRANSCRIPTION_PROMPT = `Read this Bangladesh National ID card and transcribe the requested fields.
Return exactly these seven labelled lines, in this order:
name_bengali:
name_english:
father_name:
mother_name:
address:
date_of_birth:
nid_number:

Rules:
- Preserve every Bengali character, vowel sign, and conjunct exactly as printed. Do not translate, normalize, or substitute a similar-looking letter.
- Inspect the Bengali name character by character. Do not replace the printed spelling with a more common Bangladeshi name.
- For name_english and date_of_birth, verify against the machine-readable zone on the back when visible.
- Transcribe the NID number printed beside NID No on the front. Return the digits with their printed spacing, without adding or dropping digits, and verify against the machine-readable zone when visible.
- Transcribe only text visibly printed under নাম, Name, পিতা, মাতা, ঠিকানা, Date of Birth, and NID No.
- Do not guess. If a word cannot be read confidently, mark that word [unclear].
- Return no markdown, explanation, or extra lines.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function hasValidSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return (
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  );
}

function emptyFields(): NidFields {
  return Object.fromEntries(FIELD_NAMES.map((field) => [field, ""])) as NidFields;
}

function cleanValue(value: string) {
  const cleaned = value.trim().replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "").trim();
  return /^\[?unclear\]?$/i.test(cleaned) ? "" : cleaned;
}

function parseTranscript(content: string): NidFields {
  const fields = emptyFields();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(name_bengali|name_english|father_name|mother_name|address|date_of_birth|nid_number)\s*:\s*(.*)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase() as FieldName;
    if (!fields[field]) fields[field] = cleanValue(match[2]);
  }
  return fields;
}

function parseExtraction(content: string): NidFields {
  const fields = emptyFields();
  const parsed = JSON.parse(content) as {
    entities?: ExtractedEntity[];
    structured_result?: Record<string, unknown> | null;
  };
  const structured = parsed.structured_result?.bangladesh_nid ?? parsed.structured_result;

  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    for (const field of FIELD_NAMES) {
      const value = (structured as Record<string, unknown>)[field];
      if (typeof value === "string") fields[field] = cleanValue(value);
    }
  }

  for (const entity of parsed.entities ?? []) {
    if (!FIELD_NAMES.includes(entity.type as FieldName) || typeof entity.text !== "string") continue;
    const field = entity.type as FieldName;
    if (!fields[field]) fields[field] = cleanValue(entity.text);
  }

  return fields;
}

async function requestOpenRouter(apiKey: string, body: unknown) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

function upstreamError(status: number) {
  if (status === 429) {
    return json({ error: "The extraction service is busy. Please try again shortly." }, 429);
  }
  if (status === 401 || status === 402) {
    return json({ error: "NID extraction is temporarily unavailable. Please try again later." }, 503);
  }
  return json({ error: "The extraction service could not process this image. Please try again." }, 502);
}

export const POST: APIRoute = async ({ request }) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "Image exceeds the 10 MB upload limit." }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Choose an NID image to extract." }, 400);
  }

  const upload = formData.get("image");
  if (!upload || typeof upload === "string") {
    return json({ error: "Choose an NID image to extract." }, 400);
  }

  const file = upload as File;
  if (!ALLOWED_TYPES.has(file.type)) {
    return json({ error: "Upload a JPG, PNG, or WebP image." }, 415);
  }
  if (file.size === 0) {
    return json({ error: "The selected image is empty." }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return json({ error: "Image exceeds the 10 MB upload limit." }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 12 || !hasValidSignature(bytes, file.type)) {
    return json({ error: "The uploaded file is not a valid JPG, PNG, or WebP image." }, 400);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: "NID extraction is not configured on this server." }, 503);
  }

  try {
    const transcriptionResponse = await requestOpenRouter(apiKey, {
      model: OCR_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRANSCRIPTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0,
    });

    if (!transcriptionResponse.ok) return upstreamError(transcriptionResponse.status);

    const transcriptionResult = (await transcriptionResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const transcript = transcriptionResult.choices?.[0]?.message?.content;
    if (!transcript) {
      return json({ error: "The image could not be read. Try a sharper photo." }, 422);
    }

    const transcriptFields = parseTranscript(transcript);
    if (FIELD_NAMES.every((field) => !transcriptFields[field])) {
      return json({ error: "No NID fields could be read. Try a sharper image with both sides visible." }, 422);
    }

    const properties = Object.fromEntries(
      FIELD_NAMES.map((field) => [
        field,
        { type: "string", description: FIELD_DESCRIPTIONS[field] },
      ]),
    );

    let fields = transcriptFields;
    try {
      const extractionResponse = await requestOpenRouter(apiKey, {
        model: EXTRACT_MODEL,
        messages: [{ role: "user", content: transcript }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "bangladesh_nid",
            schema: {
              type: "object",
              properties,
              required: FIELD_NAMES,
              additionalProperties: false,
            },
          },
        },
        max_tokens: 1000,
        temperature: 0,
      });

      if (extractionResponse.ok) {
        const extractionResult = (await extractionResponse.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = extractionResult.choices?.[0]?.message?.content;
        if (content) {
          const structured = parseExtraction(content);
          fields = Object.fromEntries(
            FIELD_NAMES.map((field) => [field, structured[field] || transcriptFields[field]]),
          ) as NidFields;
        }
      }
    } catch {
      // The transcript is already structured, so a ScaleDown outage should not discard a valid extraction.
    }

    if (FIELD_NAMES.every((field) => !fields[field])) {
      return json({ error: "No NID fields could be read. Try a sharper image with both sides visible." }, 422);
    }

    return json({ data: fields });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return json({ error: "Extraction took too long. Please try again." }, 504);
    }
    return json({ error: "Could not reach the extraction service. Please try again." }, 502);
  }
};
