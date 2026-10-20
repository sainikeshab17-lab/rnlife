import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

async function getSeller() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized. Please sign in as a seller." }, { status: 401 }),
    };
  }

  if (data.user.app_metadata?.role !== "seller" && data.user.app_metadata?.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Seller access required." }, { status: 403 }),
    };
  }

  return { user: data.user, response: null };
}

export async function POST(request: NextRequest) {
  const auth = await getSeller();
  if (auth.response || !auth.user) return auth.response!;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP images are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image file exceeds maximum allowed size of 5 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `product_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // 1. Attempt upload to Supabase Storage bucket 'products'
    try {
      const db = createAdminSupabaseClient();
      const storagePath = `seller_${auth.user.id}/${fileName}`;
      const { data: uploadData, error: uploadError } = await db.storage
        .from("products")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = db.storage.from("products").getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            storage: "supabase",
          });
        }
      }
    } catch {
      // Fallback to local public storage if Supabase bucket is unconfigured
    }

    // 2. Local public fallback
    const uploadDir = path.join(process.cwd(), "public", "products", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/products/uploads/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      storage: "local",
    });
  } catch (error) {
    console.error("Seller image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}
