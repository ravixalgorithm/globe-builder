import { readFile } from "fs/promises"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { NextResponse } from "next/server"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Serves the raw .tsx source of the globe component so the export modal
// can show it to users who want to paste it into Framer.
export async function GET() {
  try {
    const path = join(
      __dirname,
      "..",
      "..",
      "..",
      "components",
      "ui",
      "wireframe-dotted-globe.tsx",
    )
    const content = await readFile(path, "utf-8")
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return new NextResponse("// failed to read component source\n", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    })
  }
}
